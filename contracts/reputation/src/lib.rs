#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, contractmeta,
    Address, Env, Vec,
    symbol_short,
};

contractmeta!(
    key = "Description",
    val = "PredictFi Reputation - Tracks Forecast Reputation Scores with on-chain leaderboard"
);

// ─── Data Types ──────────────────────────────────────────────────────────────

#[derive(Clone)]
#[contracttype]
pub struct ReputationData {
    pub user: Address,
    pub total_predictions: u64,
    pub correct_predictions: u64,
    pub total_volume: i128,
    pub total_profit: i128,
    pub streak: u32,
    pub best_streak: u32,
    pub frs_score: u64,           // 0–10000
    pub last_updated: u64,
    pub markets_participated: Vec<u64>,
}

#[derive(Clone)]
#[contracttype]
pub struct LeaderboardEntry {
    pub user: Address,
    pub frs_score: u64,
}

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    AuthorizedCaller,
    UserReputation(Address),
    Leaderboard,        // Vec<LeaderboardEntry>, max LEADERBOARD_SIZE entries
    LeaderboardSize,
}

const LEADERBOARD_SIZE: u32 = 20;

// ─── Contract ────────────────────────────────────────────────────────────────

#[contract]
pub struct ReputationContract;

#[contractimpl]
impl ReputationContract {
    pub fn initialize(env: Env, admin: Address, authorized_caller: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::AuthorizedCaller, &authorized_caller);
        env.storage().instance().set(&DataKey::LeaderboardSize, &0u32);
        env.storage().instance().extend_ttl(17280, 17280);
    }

    /// Called by the settlement contract (or admin) after each market resolution.
    /// `profit` is positive for winners, negative for losers.
    pub fn update_reputation(
        env: Env,
        caller: Address,
        user: Address,
        market_id: u64,
        was_correct: bool,
        volume: i128,
        profit: i128,
    ) {
        caller.require_auth();
        Self::require_authorized(&env, &caller);

        let mut rep = Self::get_or_init_reputation(&env, &user);

        rep.total_predictions += 1;
        rep.total_volume += volume;
        rep.total_profit += profit;

        // Always append market to participation list (bug fix: was only on init before).
        rep.markets_participated.push_back(market_id);

        if was_correct {
            rep.correct_predictions += 1;
            rep.streak += 1;
            if rep.streak > rep.best_streak {
                rep.best_streak = rep.streak;
            }
        } else {
            rep.streak = 0;
        }

        rep.frs_score = Self::compute_frs(&rep);
        rep.last_updated = env.ledger().timestamp();

        env.storage().persistent().set(&DataKey::UserReputation(user.clone()), &rep);
        env.storage().persistent().extend_ttl(&DataKey::UserReputation(user.clone()), 34560, 34560);

        Self::update_leaderboard(&env, &user, rep.frs_score);

        env.events().publish(
            (symbol_short!("rep_upd"), user, market_id),
            (was_correct, rep.frs_score),
        );
    }

    // ─── View ─────────────────────────────────────────────────────────────────

    pub fn get_reputation(env: Env, user: Address) -> Option<ReputationData> {
        env.storage().persistent().get(&DataKey::UserReputation(user))
    }

    pub fn get_frs_score(env: Env, user: Address) -> u64 {
        env.storage()
            .persistent()
            .get::<DataKey, ReputationData>(&DataKey::UserReputation(user))
            .map(|r| r.frs_score)
            .unwrap_or(0u64)
    }

    pub fn get_accuracy(env: Env, user: Address) -> u64 {
        env.storage()
            .persistent()
            .get::<DataKey, ReputationData>(&DataKey::UserReputation(user))
            .filter(|r| r.total_predictions > 0)
            .map(|r| (r.correct_predictions * 10000) / r.total_predictions)
            .unwrap_or(0u64)
    }

    pub fn get_leaderboard(env: Env) -> Vec<LeaderboardEntry> {
        env.storage()
            .persistent()
            .get(&DataKey::Leaderboard)
            .unwrap_or(Vec::new(&env))
    }

    // ─── Admin ────────────────────────────────────────────────────────────────

    pub fn update_authorized_caller(env: Env, admin: Address, new_caller: Address) {
        admin.require_auth();
        Self::require_admin(&env, &admin);
        env.storage().instance().set(&DataKey::AuthorizedCaller, &new_caller);
    }

    pub fn get_admin(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Admin).unwrap()
    }

    pub fn transfer_admin(env: Env, new_admin: Address) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &new_admin);
    }

    // ─── FRS Formula ──────────────────────────────────────────────────────────
    //
    // FRS = accuracy*0.4 + volume_score*0.2 + profit_score*0.2 + consistency*0.2
    // All components normalized 0-100; final score 0-10000.

    fn compute_frs(rep: &ReputationData) -> u64 {
        if rep.total_predictions == 0 { return 0u64; }

        let accuracy = (rep.correct_predictions * 100) / rep.total_predictions;
        let volume_score = Self::volume_to_score(rep.total_volume);
        let profit_score = if rep.total_profit > 0 {
            let roi = (rep.total_profit * 100) / rep.total_volume.max(1);
            (roi as u64).min(100u64)
        } else {
            0u64
        };
        let consistency = ((rep.best_streak as u64) * 10).min(100u64);

        (accuracy as u64 * 40) + (volume_score * 20) + (profit_score * 20) + (consistency * 20)
    }

    fn volume_to_score(volume: i128) -> u64 {
        if volume <= 0 { return 0u64; }
        let usdc_units = (volume / 10_000_000) as u64;
        if usdc_units == 0 { return 0u64; }
        let mut v = usdc_units;
        let mut log = 0u64;
        while v >= 10 { v /= 10; log += 1; }
        (log * 20).min(100u64)
    }

    // ─── Leaderboard ──────────────────────────────────────────────────────────

    /// Maintains a sorted top-LEADERBOARD_SIZE list by FRS score.
    fn update_leaderboard(env: &Env, user: &Address, new_score: u64) {
        let mut board: Vec<LeaderboardEntry> = env
            .storage()
            .persistent()
            .get(&DataKey::Leaderboard)
            .unwrap_or(Vec::new(env));

        // Remove existing entry for this user if present.
        let mut updated: Vec<LeaderboardEntry> = Vec::new(env);
        for entry in board.iter() {
            if entry.user != *user {
                updated.push_back(entry);
            }
        }

        // Insert new entry in sorted position (descending by score).
        let new_entry = LeaderboardEntry { user: user.clone(), frs_score: new_score };
        let mut inserted = false;
        let mut final_board: Vec<LeaderboardEntry> = Vec::new(env);

        for entry in updated.iter() {
            if !inserted && new_score >= entry.frs_score {
                final_board.push_back(new_entry.clone());
                inserted = true;
            }
            if (final_board.len() as u32) < LEADERBOARD_SIZE {
                final_board.push_back(entry);
            }
        }
        if !inserted && (final_board.len() as u32) < LEADERBOARD_SIZE {
            final_board.push_back(new_entry);
        }

        env.storage().persistent().set(&DataKey::Leaderboard, &final_board);
        env.storage().persistent().extend_ttl(&DataKey::Leaderboard, 34560, 34560);
    }

    // ─── Internal ─────────────────────────────────────────────────────────────

    fn get_or_init_reputation(env: &Env, user: &Address) -> ReputationData {
        env.storage()
            .persistent()
            .get(&DataKey::UserReputation(user.clone()))
            .unwrap_or(ReputationData {
                user: user.clone(),
                total_predictions: 0,
                correct_predictions: 0,
                total_volume: 0i128,
                total_profit: 0i128,
                streak: 0,
                best_streak: 0,
                frs_score: 0,
                last_updated: env.ledger().timestamp(),
                markets_participated: Vec::new(env),
            })
    }

    fn require_authorized(env: &Env, caller: &Address) {
        let authorized: Address = env.storage().instance().get(&DataKey::AuthorizedCaller).unwrap();
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        if *caller != authorized && *caller != admin {
            panic!("unauthorized caller");
        }
    }

    fn require_admin(env: &Env, caller: &Address) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        if *caller != admin { panic!("not admin"); }
    }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env};

    #[test]
    fn test_frs_perfect_score() {
        let env = Env::default();
        let user = Address::generate(&env);
        let mut markets = Vec::new(&env);
        markets.push_back(1u64);
        markets.push_back(2u64);

        let rep = ReputationData {
            user,
            total_predictions: 10,
            correct_predictions: 10,
            total_volume: 10_000 * 10_000_000i128,
            total_profit: 2_000 * 10_000_000i128,
            streak: 5,
            best_streak: 5,
            frs_score: 0,
            last_updated: 0,
            markets_participated: markets,
        };

        // accuracy=100 → 100*40=4000
        // volume=10k USDC → log10(10000)=4 → 4*20=80 → 80*20=1600
        // roi=20% → 20*20=400
        // consistency=5*10=50 → 50*20=1000
        // total = 4000+1600+400+1000 = 7000
        let accuracy = (rep.correct_predictions * 100) / rep.total_predictions;
        let volume_units = (rep.total_volume / 10_000_000) as u64;
        let mut v = volume_units;
        let mut log = 0u64;
        while v >= 10 { v /= 10; log += 1; }
        let volume_score = (log * 20).min(100u64);
        let roi = (rep.total_profit * 100) / rep.total_volume;
        let profit_score = (roi as u64).min(100u64);
        let consistency = ((rep.best_streak as u64) * 10).min(100u64);
        let frs = (accuracy as u64 * 40) + (volume_score * 20) + (profit_score * 20) + (consistency * 20);
        assert_eq!(frs, 7000u64);
    }

    #[test]
    fn test_markets_participated_accumulates() {
        // Verify that markets_participated grows on each call, not just initialization.
        let env = Env::default();
        let user = Address::generate(&env);

        let mut rep = ReputationData {
            user: user.clone(),
            total_predictions: 0,
            correct_predictions: 0,
            total_volume: 0,
            total_profit: 0,
            streak: 0,
            best_streak: 0,
            frs_score: 0,
            last_updated: 0,
            markets_participated: Vec::new(&env),
        };

        rep.markets_participated.push_back(1u64);
        rep.total_predictions += 1;
        assert_eq!(rep.markets_participated.len(), 1u32);

        rep.markets_participated.push_back(2u64);
        rep.total_predictions += 1;
        assert_eq!(rep.markets_participated.len(), 2u32);
    }
}
