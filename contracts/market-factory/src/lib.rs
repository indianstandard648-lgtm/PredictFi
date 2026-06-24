#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, contractmeta,
    Address, Env, String, Symbol, Vec, Map,
    symbol_short, log,
};

contractmeta!(
    key = "Description",
    val = "PredictFi Market Factory - Creates and manages prediction markets"
);

// ─── Storage Keys ────────────────────────────────────────────────────────────

const ADMIN_KEY: Symbol = symbol_short!("ADMIN");
const MARKET_COUNT_KEY: Symbol = symbol_short!("MKTCOUNT");

// ─── Data Types ──────────────────────────────────────────────────────────────

#[derive(Clone, PartialEq)]
#[contracttype]
pub enum MarketStatus {
    Open,
    Locked,
    Resolved,
    Cancelled,
}

#[derive(Clone, PartialEq)]
#[contracttype]
pub enum Outcome {
    Yes,
    No,
}

#[derive(Clone)]
#[contracttype]
pub struct Market {
    pub id: u64,
    pub creator: Address,
    pub title: String,
    pub description: String,
    pub category: String,
    pub oracle: Address,
    pub oracle_source: String,
    pub end_date: u64,
    pub resolution_date: u64,
    pub status: MarketStatus,
    pub yes_pool: i128,
    pub no_pool: i128,
    pub total_volume: i128,
    pub outcome: Option<Outcome>,
    pub resolver: Option<Address>,
    pub evidence_url: Option<String>,
    pub created_at: u64,
}

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Market(u64),
    MarketsByCreator(Address),
    OracleWhitelist(Address),
    Admin,
    MarketCount,
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

// ─── Errors ──────────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    Unauthorized = 1,
    MarketNotFound = 2,
    MarketNotOpen = 3,
    MarketNotLocked = 4,
    InvalidEndDate = 5,
    OracleNotWhitelisted = 6,
    AlreadyResolved = 7,
    InvalidMarketId = 8,
}

impl From<Error> for soroban_sdk::Error {
    fn from(e: Error) -> soroban_sdk::Error {
        soroban_sdk::Error::from_contract_error(e as u32)
    }
}

// ─── Contract ────────────────────────────────────────────────────────────────

#[contract]
pub struct MarketFactory;

#[contractimpl]
impl MarketFactory {
    /// Initialize the contract with an admin address
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::MarketCount, &0u64);
        env.storage().instance().extend_ttl(17280, 17280);
    }

    /// Create a new prediction market
    pub fn create_market(
        env: Env,
        creator: Address,
        title: String,
        description: String,
        category: String,
        oracle: Address,
        oracle_source: String,
        end_date: u64,
        resolution_date: u64,
    ) -> u64 {
        creator.require_auth();

        let current_time = env.ledger().timestamp();
        if end_date <= current_time {
            panic!("end_date must be in the future");
        }
        if resolution_date < end_date {
            panic!("resolution_date must be after end_date");
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
            title: title.clone(),
            description,
            category,
            oracle,
            oracle_source,
            end_date,
            resolution_date,
            status: MarketStatus::Open,
            yes_pool: 0i128,
            no_pool: 0i128,
            total_volume: 0i128,
            outcome: None,
            resolver: None,
            evidence_url: None,
            created_at: current_time,
        };

        env.storage()
            .persistent()
            .set(&DataKey::Market(new_id), &market);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::Market(new_id), 34560, 34560);

        env.storage()
            .instance()
            .set(&DataKey::MarketCount, &new_id);

        // Track markets by creator
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
            (symbol_short!("mkt_create"), creator),
            MarketCreatedEvent {
                market_id: new_id,
                creator: market.creator,
                title,
                end_date,
            },
        );

        log!(&env, "Market created with id: {}", new_id);
        new_id
    }

    /// Lock a market after end_date passes (no more trading)
    pub fn lock_market(env: Env, market_id: u64) {
        let mut market = Self::get_market_internal(&env, market_id);
        let current_time = env.ledger().timestamp();

        if market.status != MarketStatus::Open {
            panic!("market is not open");
        }
        if current_time < market.end_date {
            panic!("market end_date not reached");
        }

        market.status = MarketStatus::Locked;
        env.storage()
            .persistent()
            .set(&DataKey::Market(market_id), &market);

        env.events().publish(
            (symbol_short!("mkt_lock"),),
            market_id,
        );
    }

    /// Resolve a market with YES or NO outcome
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
            panic!("market already resolved");
        }
        if market.status == MarketStatus::Cancelled {
            panic!("market is cancelled");
        }

        // Validate resolver is either admin or market oracle
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .unwrap();

        if resolver != admin && resolver != market.oracle {
            panic!("unauthorized: not admin or oracle");
        }

        market.status = MarketStatus::Resolved;
        market.outcome = Some(outcome.clone());
        market.resolver = Some(resolver.clone());
        market.evidence_url = Some(evidence_url);

        env.storage()
            .persistent()
            .set(&DataKey::Market(market_id), &market);

        env.events().publish(
            (symbol_short!("mkt_resolv"), resolver.clone()),
            MarketResolvedEvent {
                market_id,
                outcome,
                resolver,
            },
        );
    }

    /// Cancel a market (admin only)
    pub fn cancel_market(env: Env, market_id: u64) {
        let admin = Self::require_admin(&env);
        admin.require_auth();

        let mut market = Self::get_market_internal(&env, market_id);
        if market.status == MarketStatus::Resolved {
            panic!("cannot cancel resolved market");
        }

        market.status = MarketStatus::Cancelled;
        env.storage()
            .persistent()
            .set(&DataKey::Market(market_id), &market);
    }

    /// Update pool amounts (called by PositionVault after trades)
    pub fn update_pools(
        env: Env,
        caller: Address,
        market_id: u64,
        yes_delta: i128,
        no_delta: i128,
    ) {
        caller.require_auth();
        // Only position vault contract can call this
        let mut market = Self::get_market_internal(&env, market_id);

        if market.status != MarketStatus::Open {
            panic!("market is not open");
        }

        market.yes_pool += yes_delta;
        market.no_pool += no_delta;
        market.total_volume += yes_delta + no_delta;

        env.storage()
            .persistent()
            .set(&DataKey::Market(market_id), &market);
    }

    // ─── View Functions ───────────────────────────────────────────────────────

    pub fn get_market(env: Env, market_id: u64) -> Market {
        Self::get_market_internal(&env, market_id)
    }

    pub fn get_market_count(env: Env) -> u64 {
        env.storage()
            .instance()
            .get(&DataKey::MarketCount)
            .unwrap_or(0u64)
    }

    pub fn get_markets_by_creator(env: Env, creator: Address) -> Vec<u64> {
        env.storage()
            .persistent()
            .get(&DataKey::MarketsByCreator(creator))
            .unwrap_or(Vec::new(&env))
    }

    pub fn get_probability_yes(env: Env, market_id: u64) -> i128 {
        let market = Self::get_market_internal(&env, market_id);
        let total = market.yes_pool + market.no_pool;
        if total == 0 {
            return 50i128; // 50% default
        }
        (market.yes_pool * 100) / total
    }

    pub fn get_probability_no(env: Env, market_id: u64) -> i128 {
        let market = Self::get_market_internal(&env, market_id);
        let total = market.yes_pool + market.no_pool;
        if total == 0 {
            return 50i128; // 50% default
        }
        (market.no_pool * 100) / total
    }

    pub fn get_admin(env: Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .unwrap()
    }

    // ─── Admin Functions ──────────────────────────────────────────────────────

    pub fn transfer_admin(env: Env, new_admin: Address) {
        let admin = Self::require_admin(&env);
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &new_admin);
    }

    // ─── Internal Helpers ─────────────────────────────────────────────────────

    fn get_market_internal(env: &Env, market_id: u64) -> Market {
        env.storage()
            .persistent()
            .get(&DataKey::Market(market_id))
            .unwrap_or_else(|| panic!("market not found"))
    }

    fn require_admin(env: &Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .unwrap()
    }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::{Address as _, Ledger}, Env};

    #[test]
    fn test_create_market() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, MarketFactory);
        let client = MarketFactoryClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let creator = Address::generate(&env);
        let oracle = Address::generate(&env);

        client.initialize(&admin);

        env.ledger().with_mut(|l| l.timestamp = 1000);

        let market_id = client.create_market(
            &creator,
            &String::from_str(&env, "Will ETH reach $5000 by end of 2025?"),
            &String::from_str(&env, "ETH price prediction market"),
            &String::from_str(&env, "Crypto"),
            &oracle,
            &String::from_str(&env, "admin"),
            &2000u64,
            &3000u64,
        );

        assert_eq!(market_id, 1u64);

        let market = client.get_market(&1u64);
        assert_eq!(market.status, MarketStatus::Open);
        assert_eq!(market.yes_pool, 0i128);
        assert_eq!(market.no_pool, 0i128);
    }

    #[test]
    fn test_probability_default_50() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, MarketFactory);
        let client = MarketFactoryClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let creator = Address::generate(&env);
        let oracle = Address::generate(&env);

        client.initialize(&admin);
        env.ledger().with_mut(|l| l.timestamp = 1000);

        let market_id = client.create_market(
            &creator,
            &String::from_str(&env, "Test market"),
            &String::from_str(&env, "Description"),
            &String::from_str(&env, "General"),
            &oracle,
            &String::from_str(&env, "admin"),
            &2000u64,
            &3000u64,
        );

        assert_eq!(client.get_probability_yes(&market_id), 50i128);
        assert_eq!(client.get_probability_no(&market_id), 50i128);
    }

    #[test]
    fn test_resolve_market() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, MarketFactory);
        let client = MarketFactoryClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let creator = Address::generate(&env);
        let oracle = Address::generate(&env);

        client.initialize(&admin);
        env.ledger().with_mut(|l| l.timestamp = 1000);

        let market_id = client.create_market(
            &creator,
            &String::from_str(&env, "Test market"),
            &String::from_str(&env, "Description"),
            &String::from_str(&env, "General"),
            &oracle,
            &String::from_str(&env, "admin"),
            &2000u64,
            &3000u64,
        );

        client.resolve_market(
            &admin,
            &market_id,
            &Outcome::Yes,
            &String::from_str(&env, "https://evidence.example.com"),
        );

        let market = client.get_market(&market_id);
        assert_eq!(market.status, MarketStatus::Resolved);
        assert_eq!(market.outcome, Some(Outcome::Yes));
    }
}
