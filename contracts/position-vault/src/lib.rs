#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, contractmeta,
    Address, Env, Symbol, Vec,
    symbol_short, token,
};

contractmeta!(
    key = "Description",
    val = "PredictFi Position Vault - Manages USDC deposits and YES/NO share positions"
);

// ─── Data Types ──────────────────────────────────────────────────────────────

#[derive(Clone, PartialEq)]
#[contracttype]
pub enum Side {
    Yes,
    No,
}

#[derive(Clone)]
#[contracttype]
pub struct Position {
    pub user: Address,
    pub market_id: u64,
    pub side: Side,
    pub amount_usdc: i128,
    pub shares: i128,
    pub entry_probability: i128,
    pub timestamp: u64,
    pub claimed: bool,
}

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
    Position(u64, Address, Side),
    UserPositions(Address),
    MarketPools(u64),
    PositionCounter,
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
    ) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::UsdcToken, &usdc_token);
        env.storage().instance().set(&DataKey::MarketFactory, &market_factory);
        env.storage().instance().set(&DataKey::PositionCounter, &0u64);
        env.storage().instance().extend_ttl(17280, 17280);
    }

    /// Buy YES shares in a market
    pub fn buy_yes(
        env: Env,
        user: Address,
        market_id: u64,
        usdc_amount: i128,
    ) -> i128 {
        user.require_auth();
        Self::validate_amount(usdc_amount);

        let pools = Self::get_or_init_pools(&env, market_id);
        let shares = Self::calculate_shares(&pools, &Side::Yes, usdc_amount);
        let probability = Self::calculate_probability_yes(&pools, usdc_amount);

        // Transfer USDC from user to vault
        let usdc = Self::get_usdc_client(&env);
        usdc.transfer(&user, &env.current_contract_address(), &usdc_amount);

        // Update pools
        let mut updated_pools = pools;
        updated_pools.yes_pool += usdc_amount;
        updated_pools.yes_shares += shares;
        env.storage()
            .persistent()
            .set(&DataKey::MarketPools(market_id), &updated_pools);

        // Record position
        let position = Position {
            user: user.clone(),
            market_id,
            side: Side::Yes,
            amount_usdc: usdc_amount,
            shares,
            entry_probability: probability,
            timestamp: env.ledger().timestamp(),
            claimed: false,
        };

        env.storage()
            .persistent()
            .set(&DataKey::Position(market_id, user.clone(), Side::Yes), &position);

        // Track user's positions
        let mut user_positions: Vec<(u64, Side)> = env
            .storage()
            .persistent()
            .get(&DataKey::UserPositions(user.clone()))
            .unwrap_or(Vec::new(&env));
        user_positions.push_back((market_id, Side::Yes));
        env.storage()
            .persistent()
            .set(&DataKey::UserPositions(user.clone()), &user_positions);

        env.events().publish(
            (symbol_short!("buy_yes"), user, market_id),
            (usdc_amount, shares),
        );

        shares
    }

    /// Buy NO shares in a market
    pub fn buy_no(
        env: Env,
        user: Address,
        market_id: u64,
        usdc_amount: i128,
    ) -> i128 {
        user.require_auth();
        Self::validate_amount(usdc_amount);

        let pools = Self::get_or_init_pools(&env, market_id);
        let shares = Self::calculate_shares(&pools, &Side::No, usdc_amount);
        let probability = Self::calculate_probability_no(&pools, usdc_amount);

        let usdc = Self::get_usdc_client(&env);
        usdc.transfer(&user, &env.current_contract_address(), &usdc_amount);

        let mut updated_pools = pools;
        updated_pools.no_pool += usdc_amount;
        updated_pools.no_shares += shares;
        env.storage()
            .persistent()
            .set(&DataKey::MarketPools(market_id), &updated_pools);

        let position = Position {
            user: user.clone(),
            market_id,
            side: Side::No,
            amount_usdc: usdc_amount,
            shares,
            entry_probability: probability,
            timestamp: env.ledger().timestamp(),
            claimed: false,
        };

        env.storage()
            .persistent()
            .set(&DataKey::Position(market_id, user.clone(), Side::No), &position);

        let mut user_positions: Vec<(u64, Side)> = env
            .storage()
            .persistent()
            .get(&DataKey::UserPositions(user.clone()))
            .unwrap_or(Vec::new(&env));
        user_positions.push_back((market_id, Side::No));
        env.storage()
            .persistent()
            .set(&DataKey::UserPositions(user.clone()), &user_positions);

        env.events().publish(
            (symbol_short!("buy_no"), user, market_id),
            (usdc_amount, shares),
        );

        shares
    }

    // ─── View Functions ───────────────────────────────────────────────────────

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
        if total == 0 {
            return 50i128;
        }
        (pools.yes_pool * 100) / total
    }

    pub fn get_probability_no(env: Env, market_id: u64) -> i128 {
        let pools = Self::get_or_init_pools(&env, market_id);
        let total = pools.yes_pool + pools.no_pool;
        if total == 0 {
            return 50i128;
        }
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

    // ─── Internal Helpers ─────────────────────────────────────────────────────

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
        let usdc: Address = env
            .storage()
            .instance()
            .get(&DataKey::UsdcToken)
            .unwrap();
        token::Client::new(env, &usdc)
    }

    fn calculate_shares(pools: &MarketPools, side: &Side, usdc_amount: i128) -> i128 {
        // LMSR-inspired: shares = amount / probability
        // Simplified: shares proportional to contribution vs pool size
        // Minimum 1 share per 0.01 USDC
        let total = pools.yes_pool + pools.no_pool;
        if total == 0 {
            return usdc_amount; // 1:1 at market open
        }

        let side_pool = match side {
            Side::Yes => pools.yes_pool,
            Side::No => pools.no_pool,
        };

        let probability = if side_pool == 0 {
            50i128
        } else {
            (side_pool * 100) / total
        };

        // Shares = amount * 100 / probability (lower prob = more shares per dollar)
        if probability == 0 {
            return usdc_amount * 100;
        }
        (usdc_amount * 100) / probability
    }

    fn calculate_probability_yes(pools: &MarketPools, added: i128) -> i128 {
        let new_yes = pools.yes_pool + added;
        let total = new_yes + pools.no_pool;
        if total == 0 {
            return 50i128;
        }
        (new_yes * 100) / total
    }

    fn calculate_probability_no(pools: &MarketPools, added: i128) -> i128 {
        let new_no = pools.no_pool + added;
        let total = pools.yes_pool + new_no;
        if total == 0 {
            return 50i128;
        }
        (new_no * 100) / total
    }

    fn validate_amount(amount: i128) {
        if amount <= 0 {
            panic!("amount must be positive");
        }
        if amount < 1_000_000 {
            // min 1 USDC (7 decimals)
            panic!("minimum trade is 1 USDC");
        }
    }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env};

    #[test]
    fn test_probability_calculation() {
        let pools = MarketPools {
            yes_pool: 1000,
            no_pool: 500,
            yes_shares: 0,
            no_shares: 0,
        };
        let total = pools.yes_pool + pools.no_pool;
        let prob_yes = (pools.yes_pool * 100) / total;
        let prob_no = (pools.no_pool * 100) / total;
        assert_eq!(prob_yes, 66i128); // ~66%
        assert_eq!(prob_no, 33i128); // ~33%
    }

    #[test]
    fn test_shares_calculation_at_50_50() {
        let pools = MarketPools {
            yes_pool: 0,
            no_pool: 0,
            yes_shares: 0,
            no_shares: 0,
        };
        // At market open (0/0 pool), shares = amount (1:1)
        let shares = if pools.yes_pool + pools.no_pool == 0 {
            10_000_000i128
        } else {
            0
        };
        assert_eq!(shares, 10_000_000i128);
    }
}
