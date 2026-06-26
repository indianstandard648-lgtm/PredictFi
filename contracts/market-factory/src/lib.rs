#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, contractmeta,
    Address, Env, String, Vec,
    symbol_short,
};

contractmeta!(
    key = "Description",
    val = "PredictFi Market Factory - Creates and manages prediction market definitions"
);

// ─── Data Types ──────────────────────────────────────────────────────────────

/// Expanded lifecycle: every state is explicit and transition-safe.
#[derive(Clone, PartialEq)]
#[contracttype]
pub enum MarketStatus {
    Draft,
    Open,
    TradingPaused,
    Locked,
    AwaitingOracle,
    Disputed,
    Resolved,
    Cancelled,
}

#[derive(Clone, PartialEq)]
#[contracttype]
pub enum Outcome {
    Yes,
    No,
}

/// Enum saves gas vs heap-allocated String and enables exhaustive filtering.
#[derive(Clone, PartialEq)]
#[contracttype]
pub enum Category {
    Crypto,
    Sports,
    Politics,
    Weather,
    AI,
    Finance,
    Custom,
}

/// Bundled creation params — keeps create_market within Soroban's 10-param limit.
#[derive(Clone)]
#[contracttype]
pub struct CreateMarketParams {
    pub title: String,
    pub description: String,
    pub category: Category,
    pub oracle: Address,
    pub oracle_source: String,
    pub end_date: u64,
    pub resolution_date: u64,
    pub min_bet: i128,
    pub max_bet: i128,        // 0 = no upper limit
    pub trading_fee_bps: u32, // per-market fee override (0 = use platform default)
}

/// MarketFactory owns market *definitions* only — no pool or volume state.
/// All financial state lives in PositionVault.
#[derive(Clone)]
#[contracttype]
pub struct Market {
    pub id: u64,
    pub creator: Address,
    pub title: String,
    pub description: String,
    pub category: Category,
    pub oracle: Address,
    pub oracle_source: String,
    pub end_date: u64,
    pub resolution_date: u64,
    pub status: MarketStatus,
    pub outcome: Option<Outcome>,
    pub resolver: Option<Address>,
    pub evidence_url: Option<String>,
    pub created_at: u64,
    pub min_bet: i128,
    pub max_bet: i128,        // 0 = no upper limit
    pub trading_fee_bps: u32, // per-market fee override (0 = use platform default)
}

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    MarketCount,
    Market(u64),
    MarketsByCreator(Address),
}

// ─── Events ──────────────────────────────────────────────────────────────────

#[contracttype]
pub struct MarketCreatedEvent {
    pub market_id: u64,
    pub creator: Address,
    pub title: String,
    pub end_date: u64,
}

#[contracttype]
pub struct MarketResolvedEvent {
    pub market_id: u64,
    pub outcome: Outcome,
    pub resolver: Address,
}

// ─── Contract ────────────────────────────────────────────────────────────────

#[contract]
pub struct MarketFactory;

#[contractimpl]
impl MarketFactory {
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::MarketCount, &0u64);
        env.storage().instance().extend_ttl(17280, 17280);
    }

    pub fn create_market(env: Env, creator: Address, params: CreateMarketParams) -> u64 {
        creator.require_auth();

        let now = env.ledger().timestamp();
        if params.end_date <= now {
            panic!("end_date must be in the future");
        }
        if params.resolution_date < params.end_date {
            panic!("resolution_date must be >= end_date");
        }
        if params.min_bet < 1_000_000 {
            panic!("min_bet must be at least 1 USDC");
        }
        if params.max_bet > 0 && params.max_bet < params.min_bet {
            panic!("max_bet must be >= min_bet");
        }
        if params.trading_fee_bps > 1000 {
            panic!("trading_fee_bps cannot exceed 10%");
        }

        let market_id: u64 = env
            .storage()
            .instance()
            .get(&DataKey::MarketCount)
            .unwrap_or(0u64);
        let new_id = market_id + 1;

        let market = Market {
            id: new_id,
            creator: creator.clone(),
            title: params.title.clone(),
            description: params.description,
            category: params.category,
            oracle: params.oracle,
            oracle_source: params.oracle_source,
            end_date: params.end_date,
            resolution_date: params.resolution_date,
            status: MarketStatus::Open,
            outcome: None,
            resolver: None,
            evidence_url: None,
            created_at: now,
            min_bet: params.min_bet,
            max_bet: params.max_bet,
            trading_fee_bps: params.trading_fee_bps,
        };

        env.storage().persistent().set(&DataKey::Market(new_id), &market);
        env.storage().persistent().extend_ttl(&DataKey::Market(new_id), 34560, 34560);
        env.storage().instance().set(&DataKey::MarketCount, &new_id);

        let mut creator_markets: Vec<u64> = env
            .storage()
            .persistent()
            .get(&DataKey::MarketsByCreator(creator.clone()))
            .unwrap_or(Vec::new(&env));
        creator_markets.push_back(new_id);
        env.storage()
            .persistent()
            .set(&DataKey::MarketsByCreator(creator.clone()), &creator_markets);

        env.events().publish(
            (symbol_short!("mkt_crt"), creator),
            MarketCreatedEvent {
                market_id: new_id,
                creator: market.creator,
                title: params.title,
                end_date: params.end_date,
            },
        );

        new_id
    }

    /// Anyone can call once end_date is passed — no auth required.
    pub fn lock_market(env: Env, market_id: u64) {
        let mut market = Self::get_market_internal(&env, market_id);
        if market.status != MarketStatus::Open {
            panic!("market is not open");
        }
        if env.ledger().timestamp() < market.end_date {
            panic!("market end_date not reached");
        }
        market.status = MarketStatus::Locked;
        env.storage().persistent().set(&DataKey::Market(market_id), &market);
        env.events().publish((symbol_short!("mkt_lock"),), market_id);
    }

    pub fn pause_trading(env: Env, market_id: u64) {
        let admin = Self::require_admin(&env);
        admin.require_auth();
        let mut market = Self::get_market_internal(&env, market_id);
        if market.status != MarketStatus::Open {
            panic!("market is not open");
        }
        market.status = MarketStatus::TradingPaused;
        env.storage().persistent().set(&DataKey::Market(market_id), &market);
    }

    pub fn resume_trading(env: Env, market_id: u64) {
        let admin = Self::require_admin(&env);
        admin.require_auth();
        let mut market = Self::get_market_internal(&env, market_id);
        if market.status != MarketStatus::TradingPaused {
            panic!("market is not paused");
        }
        market.status = MarketStatus::Open;
        env.storage().persistent().set(&DataKey::Market(market_id), &market);
    }

    /// Signals that oracle data is being awaited after locking.
    pub fn request_oracle(env: Env, market_id: u64) {
        let mut market = Self::get_market_internal(&env, market_id);
        if market.status != MarketStatus::Locked {
            panic!("market must be locked first");
        }
        market.status = MarketStatus::AwaitingOracle;
        env.storage().persistent().set(&DataKey::Market(market_id), &market);
    }

    /// Admin can flag a market for dispute review.
    pub fn dispute_market(env: Env, market_id: u64) {
        let admin = Self::require_admin(&env);
        admin.require_auth();
        let mut market = Self::get_market_internal(&env, market_id);
        if market.status != MarketStatus::AwaitingOracle && market.status != MarketStatus::Locked {
            panic!("can only dispute locked or awaiting-oracle markets");
        }
        market.status = MarketStatus::Disputed;
        env.storage().persistent().set(&DataKey::Market(market_id), &market);
    }

    pub fn resolve_market(
        env: Env,
        resolver: Address,
        market_id: u64,
        outcome: Outcome,
        evidence_url: String,
    ) {
        resolver.require_auth();
        let mut market = Self::get_market_internal(&env, market_id);
        if market.status == MarketStatus::Resolved {
            panic!("already resolved");
        }
        if market.status == MarketStatus::Cancelled {
            panic!("market is cancelled");
        }

        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        if resolver != admin && resolver != market.oracle {
            panic!("unauthorized: not admin or oracle");
        }

        market.status = MarketStatus::Resolved;
        market.outcome = Some(outcome.clone());
        market.resolver = Some(resolver.clone());
        market.evidence_url = Some(evidence_url);
        env.storage().persistent().set(&DataKey::Market(market_id), &market);

        env.events().publish(
            (symbol_short!("mkt_res"), resolver.clone()),
            MarketResolvedEvent { market_id, outcome, resolver },
        );
    }

    pub fn cancel_market(env: Env, market_id: u64) {
        let admin = Self::require_admin(&env);
        admin.require_auth();
        let mut market = Self::get_market_internal(&env, market_id);
        if market.status == MarketStatus::Resolved {
            panic!("cannot cancel resolved market");
        }
        market.status = MarketStatus::Cancelled;
        env.storage().persistent().set(&DataKey::Market(market_id), &market);
    }

    // ─── View ─────────────────────────────────────────────────────────────────

    pub fn get_market(env: Env, market_id: u64) -> Market {
        Self::get_market_internal(&env, market_id)
    }

    pub fn get_market_count(env: Env) -> u64 {
        env.storage().instance().get(&DataKey::MarketCount).unwrap_or(0u64)
    }

    pub fn get_markets_by_creator(env: Env, creator: Address) -> Vec<u64> {
        env.storage()
            .persistent()
            .get(&DataKey::MarketsByCreator(creator))
            .unwrap_or(Vec::new(&env))
    }

    pub fn get_admin(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Admin).unwrap()
    }

    pub fn transfer_admin(env: Env, new_admin: Address) {
        let admin = Self::require_admin(&env);
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &new_admin);
    }

    // ─── Internal ─────────────────────────────────────────────────────────────

    fn get_market_internal(env: &Env, market_id: u64) -> Market {
        env.storage()
            .persistent()
            .get(&DataKey::Market(market_id))
            .unwrap_or_else(|| panic!("market not found"))
    }

    fn require_admin(env: &Env) -> Address {
        env.storage().instance().get(&DataKey::Admin).unwrap()
    }
}

