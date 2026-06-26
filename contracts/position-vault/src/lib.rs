#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, contractmeta,
    Address, Env, Vec,
    symbol_short, token,
};

contractmeta!(
    key = "Description",
    val = "PredictFi Position Vault - Single source of truth for all funds and share positions"
);

// ─── Data Types ──────────────────────────────────────────────────────────────

#[derive(Clone, PartialEq)]
#[contracttype]
pub enum Side {
    Yes,
    No,
}

/// One record per (market, user, side). Buying again accumulates — never overwrites.
#[derive(Clone)]
#[contracttype]
pub struct Position {
    pub user: Address,
    pub market_id: u64,
    pub side: Side,
    pub amount_usdc: i128,       // total USDC deposited across all buys
    pub shares: i128,            // total shares accumulated
    pub entry_probability: i128, // probability at most recent buy (bps, 0-10000)
    pub timestamp: u64,          // most recent buy time
    pub claimed: bool,
}

/// All pool accounting lives here, never in MarketFactory.
#[derive(Clone)]
#[contracttype]
pub struct MarketPools {
    pub yes_pool: i128,
    pub no_pool: i128,
    pub yes_shares: i128,
    pub no_shares: i128,
}

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    UsdcToken,
    MarketFactory,
    Settlement,
    Position(u64, Address, Side),
    /// Set<(market_id, side)> membership flag — avoids O(n) Vec scan on repeated buys.
    HasPosition(Address, u64, Side),
    UserPositions(Address),
    MarketPools(u64),
}

// ─── Contract ────────────────────────────────────────────────────────────────

#[contract]
pub struct PositionVault;

#[contractimpl]
impl PositionVault {
    pub fn initialize(
        env: Env,
        admin: Address,
        usdc_token: Address,
        market_factory: Address,
        settlement: Address,
    ) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::UsdcToken, &usdc_token);
        env.storage().instance().set(&DataKey::MarketFactory, &market_factory);
        env.storage().instance().set(&DataKey::Settlement, &settlement);
        env.storage().instance().extend_ttl(17280, 17280);
    }

    pub fn buy_yes(env: Env, user: Address, market_id: u64, usdc_amount: i128) -> i128 {
        user.require_auth();
        Self::validate_amount(usdc_amount);

        let pools = Self::get_or_init_pools(&env, market_id);
        let shares = Self::calculate_shares(&pools, &Side::Yes, usdc_amount);
        let probability = Self::calculate_entry_probability(&pools, &Side::Yes, usdc_amount);

        let usdc = Self::get_usdc_client(&env);
        usdc.transfer(&user, &env.current_contract_address(), &usdc_amount);

        let mut updated_pools = pools;
        updated_pools.yes_pool += usdc_amount;
        updated_pools.yes_shares += shares;
        env.storage().persistent().set(&DataKey::MarketPools(market_id), &updated_pools);
        env.storage().persistent().extend_ttl(&DataKey::MarketPools(market_id), 34560, 34560);

        Self::upsert_position(&env, &user, market_id, Side::Yes, usdc_amount, shares, probability);
        Self::track_user_market(&env, &user, market_id, Side::Yes);

        env.events().publish(
            (symbol_short!("buy_yes"), user, market_id),
            (usdc_amount, shares),
        );

        shares
    }

    pub fn buy_no(env: Env, user: Address, market_id: u64, usdc_amount: i128) -> i128 {
        user.require_auth();
        Self::validate_amount(usdc_amount);

        let pools = Self::get_or_init_pools(&env, market_id);
        let shares = Self::calculate_shares(&pools, &Side::No, usdc_amount);
        let probability = Self::calculate_entry_probability(&pools, &Side::No, usdc_amount);

        let usdc = Self::get_usdc_client(&env);
        usdc.transfer(&user, &env.current_contract_address(), &usdc_amount);

        let mut updated_pools = pools;
        updated_pools.no_pool += usdc_amount;
        updated_pools.no_shares += shares;
        env.storage().persistent().set(&DataKey::MarketPools(market_id), &updated_pools);
        env.storage().persistent().extend_ttl(&DataKey::MarketPools(market_id), 34560, 34560);

        Self::upsert_position(&env, &user, market_id, Side::No, usdc_amount, shares, probability);
        Self::track_user_market(&env, &user, market_id, Side::No);

        env.events().publish(
            (symbol_short!("buy_no"), user, market_id),
            (usdc_amount, shares),
        );

        shares
    }

    /// Only callable by the settlement contract. Marks position as claimed after payout.
    pub fn mark_claimed(
        env: Env,
        caller: Address,
        market_id: u64,
        user: Address,
        side: Side,
    ) {
        caller.require_auth();
        let settlement: Address = env.storage().instance().get(&DataKey::Settlement).unwrap();
        if caller != settlement {
            panic!("only settlement contract can mark claimed");
        }

        let key = DataKey::Position(market_id, user.clone(), side.clone());
        let mut position: Position = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or_else(|| panic!("position not found"));

        if position.claimed {
            panic!("already claimed");
        }

        position.claimed = true;
        env.storage().persistent().set(&key, &position);
    }

    // ─── View ─────────────────────────────────────────────────────────────────

    pub fn get_position(env: Env, market_id: u64, user: Address, side: Side) -> Option<Position> {
        env.storage()
            .persistent()
            .get(&DataKey::Position(market_id, user, side))
    }

    pub fn get_pools(env: Env, market_id: u64) -> MarketPools {
        Self::get_or_init_pools(&env, market_id)
    }

    pub fn get_probability_yes(env: Env, market_id: u64) -> i128 {
        let pools = Self::get_or_init_pools(&env, market_id);
        let total = pools.yes_pool + pools.no_pool;
        if total == 0 { return 50i128; }
        (pools.yes_pool * 100) / total
    }

    pub fn get_probability_no(env: Env, market_id: u64) -> i128 {
        let pools = Self::get_or_init_pools(&env, market_id);
        let total = pools.yes_pool + pools.no_pool;
        if total == 0 { return 50i128; }
        (pools.no_pool * 100) / total
    }

    pub fn get_user_positions(env: Env, user: Address) -> Vec<(u64, Side)> {
        env.storage()
            .persistent()
            .get(&DataKey::UserPositions(user))
            .unwrap_or(Vec::new(&env))
    }

    pub fn get_total_pool(env: Env, market_id: u64) -> i128 {
        let pools = Self::get_or_init_pools(&env, market_id);
        pools.yes_pool + pools.no_pool
    }

    pub fn get_admin(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Admin).unwrap()
    }

    pub fn get_settlement(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Settlement).unwrap()
    }

    /// Admin can update the settlement contract address (for upgrades).
    pub fn set_settlement(env: Env, new_settlement: Address) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        env.storage().instance().set(&DataKey::Settlement, &new_settlement);
    }

    // ─── Internal ─────────────────────────────────────────────────────────────

    /// Accumulates into an existing position or creates a new one.
    fn upsert_position(
        env: &Env,
        user: &Address,
        market_id: u64,
        side: Side,
        usdc_amount: i128,
        shares: i128,
        probability: i128,
    ) {
        let key = DataKey::Position(market_id, user.clone(), side.clone());
        let position = env
            .storage()
            .persistent()
            .get::<DataKey, Position>(&key)
            .map(|mut p| {
                p.amount_usdc += usdc_amount;
                p.shares += shares;
                p.entry_probability = probability;
                p.timestamp = env.ledger().timestamp();
                p
            })
            .unwrap_or(Position {
                user: user.clone(),
                market_id,
                side,
                amount_usdc: usdc_amount,
                shares,
                entry_probability: probability,
                timestamp: env.ledger().timestamp(),
                claimed: false,
            });

        env.storage().persistent().set(&key, &position);
        env.storage().persistent().extend_ttl(&key, 34560, 34560);
    }

    /// Adds (market_id, side) to the user's position index only on first buy.
    fn track_user_market(env: &Env, user: &Address, market_id: u64, side: Side) {
        let membership_key = DataKey::HasPosition(user.clone(), market_id, side.clone());
        if env.storage().persistent().has(&membership_key) {
            return;
        }
        env.storage().persistent().set(&membership_key, &true);

        let list_key = DataKey::UserPositions(user.clone());
        let mut positions: Vec<(u64, Side)> = env
            .storage()
            .persistent()
            .get(&list_key)
            .unwrap_or(Vec::new(env));
        positions.push_back((market_id, side));
        env.storage().persistent().set(&list_key, &positions);
        env.storage().persistent().extend_ttl(&list_key, 34560, 34560);
    }

    fn get_or_init_pools(env: &Env, market_id: u64) -> MarketPools {
        env.storage()
            .persistent()
            .get(&DataKey::MarketPools(market_id))
            .unwrap_or(MarketPools {
                yes_pool: 0i128,
                no_pool: 0i128,
                yes_shares: 0i128,
                no_shares: 0i128,
            })
    }

    fn get_usdc_client(env: &Env) -> token::Client {
        let usdc: Address = env.storage().instance().get(&DataKey::UsdcToken).unwrap();
        token::Client::new(env, &usdc)
    }

    /// Simplified LMSR-inspired share formula: lower probability → more shares per dollar.
    fn calculate_shares(pools: &MarketPools, side: &Side, usdc_amount: i128) -> i128 {
        let total = pools.yes_pool + pools.no_pool;
        if total == 0 {
            return usdc_amount; // 1:1 at market open
        }
        let side_pool = match side {
            Side::Yes => pools.yes_pool,
            Side::No => pools.no_pool,
        };
        let probability = if side_pool == 0 { 50i128 } else { (side_pool * 100) / total };
        if probability == 0 { return usdc_amount * 100; }
        (usdc_amount * 100) / probability
    }

    /// Returns entry probability in percentage (0-100) after the new amount is added.
    fn calculate_entry_probability(pools: &MarketPools, side: &Side, added: i128) -> i128 {
        let (new_side, total) = match side {
            Side::Yes => (pools.yes_pool + added, pools.yes_pool + added + pools.no_pool),
            Side::No  => (pools.no_pool  + added, pools.yes_pool + pools.no_pool + added),
        };
        if total == 0 { return 50i128; }
        (new_side * 100) / total
    }

    fn validate_amount(amount: i128) {
        if amount < 1_000_000 {
            panic!("minimum trade is 1 USDC");
        }
    }
}

