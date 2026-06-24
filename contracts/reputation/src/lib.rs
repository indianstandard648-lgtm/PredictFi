#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, contractmeta,
    Address, Env, Vec,
    symbol_short,
};

contractmeta!(
    key = "Description",
    val = "PredictFi Reputation Contract - Tracks forecasting reputation scores (FRS)"
);

// ─── Data Types ──────────────────────────────────────────────────────────────

#[derive(Clone)]
#[contracttype]
pub struct ReputationData {
    pub user: Address,
    pub total_predictions: u64,
    pub correct_predictions: u64,
    pub total_volume: i128,       // total USDC wagered (scaled 1e7)
    pub total_profit: i128,       // net PnL in USDC (scaled 1e7)
    pub streak: u32,              // current winning streak
    pub best_streak: u32,
    pub frs_score: u64,           // Forecast Reputation Score (0-10000, scaled x100)
    pub last_updated: u64,
    pub markets_participated: Vec<u64>,
}

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    AuthorizedCaller,
    UserReputation(Address),
    LeaderboardSlot(u32),
    LeaderboardSize,
}

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

    /// Update reputation after a market resolves
    /// Called by the settlement contract or admin
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

        let mut rep = Self::get_or_init_reputation(&env, &user, market_id);

        rep.total_predictions += 1;
        rep.total_volume += volume;
        rep.total_profit += profit;

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

        env.storage()
            .persistent()
            .set(&DataKey::UserReputation(user.clone()), &rep);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::UserReputation(user.clone()), 34560, 34560);

        env.events().publish(
            (symbol_short!("rep_upd"), user, market_id),
            (was_correct, rep.frs_score),
        );
    }

    // ─── View Functions ───────────────────────────────────────────────────────

    pub fn get_reputation(env: Env, user: Address) -> Option<ReputationData> {
        env.storage()
            .persistent()
            .get(&DataKey::UserReputation(user))
    }

    pub fn get_frs_score(env: Env, user: Address) -> u64 {
        env.storage()
            .persistent()
            .get::<DataKey, ReputationData>(&DataKey::UserReputation(user))
            .map(|r| r.frs_score)
            .unwrap_or(0u64)
    }

    pub fn get_accuracy(env: Env, user: Address) -> u64 {
        let rep = env
            .storage()
            .persistent()
            .get::<DataKey, ReputationData>(&DataKey::UserReputation(user));

        match rep {
            Some(r) if r.total_predictions > 0 => {
                (r.correct_predictions * 10000) / r.total_predictions
            }
            _ => 0u64,
        }
    }

    // ─── Admin Functions ──────────────────────────────────────────────────────

    pub fn update_authorized_caller(env: Env, admin: Address, new_caller: Address) {
        admin.require_auth();
        Self::require_admin(&env, &admin);
        env.storage()
            .instance()
            .set(&DataKey::AuthorizedCaller, &new_caller);
    }

    // ─── FRS Formula ──────────────────────────────────────────────────────────
    //
    // FRS = (accuracy * 0.4) + (volume_score * 0.2) + (profit_score * 0.2) + (consistency * 0.2)
    // All components normalized to 0-100, final score 0-10000 (scaled x100)

    fn compute_frs(rep: &ReputationData) -> u64 {
        if rep.total_predictions == 0 {
            return 0u64;
        }

        // Accuracy component (0-100)
        let accuracy = (rep.correct_predictions * 100) / rep.total_predictions;

        // Volume score: log-scaled, caps at 100 for 1M USDC total volume
        let volume_score = Self::volume_to_score(rep.total_volume);

        // Profitability score (0-100)
        let profit_score = if rep.total_profit > 0 {
            let roi = (rep.total_profit * 100) / (rep.total_volume.max(1));
            (roi as u64).min(100u64)
        } else {
            0u64
        };

        // Consistency: streak bonus
        let consistency = ((rep.best_streak as u64) * 10).min(100u64);

        // Weighted FRS (scaled to 10000)
        let frs = (accuracy as u64 * 40)
            + (volume_score * 20)
            + (profit_score * 20)
            + (consistency * 20);

        frs // max = 100*40 + 100*20 + 100*20 + 100*20 = 10000
    }

    fn volume_to_score(volume: i128) -> u64 {
        // 0 → 0, 10 USDC → ~10, 100 USDC → ~20, 1000 → ~30, 1M USDC → 100
        if volume <= 0 {
            return 0u64;
        }
        let usdc_units = (volume / 10_000_000) as u64; // convert from 7-decimal
        if usdc_units == 0 {
            return 0u64;
        }
        // Rough log10 approximation: score = log10(volume) * 20
        let mut v = usdc_units;
        let mut log = 0u64;
        while v >= 10 {
            v /= 10;
            log += 1;
        }
        (log * 20).min(100u64)
    }

    // ─── Internal ─────────────────────────────────────────────────────────────

    fn get_or_init_reputation(env: &Env, user: &Address, first_market: u64) -> ReputationData {
        env.storage()
            .persistent()
            .get(&DataKey::UserReputation(user.clone()))
            .unwrap_or_else(|| {
                let mut markets = Vec::new(env);
                markets.push_back(first_market);
                ReputationData {
                    user: user.clone(),
                    total_predictions: 0,
                    correct_predictions: 0,
                    total_volume: 0i128,
                    total_profit: 0i128,
                    streak: 0,
                    best_streak: 0,
                    frs_score: 0,
                    last_updated: env.ledger().timestamp(),
                    markets_participated: markets,
                }
            })
    }

    fn require_authorized(env: &Env, caller: &Address) {
        let authorized: Address = env
            .storage()
            .instance()
            .get(&DataKey::AuthorizedCaller)
            .unwrap();
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .unwrap();
        if *caller != authorized && *caller != admin {
            panic!("unauthorized caller");
        }
    }

    fn require_admin(env: &Env, caller: &Address) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        if *caller != admin {
            panic!("not admin");
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_frs_formula() {
        // 10 correct out of 10, volume = 1000 USDC, profit = 200 USDC, streak = 5
        let rep = ReputationData {
            user: soroban_sdk::Address::from_str(
                &soroban_sdk::Env::default(),
                "GAHJJJKMOKYE4RVPZEWZTKH5FVI4PA3VL7GK2LFNUBSGBV4UATGRFQ5",
            ),
            total_predictions: 10,
            correct_predictions: 10,
            total_volume: 10_000 * 10_000_000i128, // 10k USDC
            total_profit: 2_000 * 10_000_000i128,  // 2k USDC
            streak: 5,
            best_streak: 5,
            frs_score: 0,
            last_updated: 0,
            markets_participated: soroban_sdk::Vec::new(&soroban_sdk::Env::default()),
        };

        // accuracy = 100%
        // volume_score for 10000 USDC: log10(10000) = 4, score = 80
        // profit_score = (2000/10000)*100 = 20
        // consistency = 5*10 = 50
        // FRS = 100*40 + 80*20 + 20*20 + 50*20 = 4000+1600+400+1000 = 7000
        assert!(rep.total_predictions == 10);
    }
}
