#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, contractmeta,
    Address, Env, Symbol,
    symbol_short, token,
};

contractmeta!(
    key = "Description",
    val = "PredictFi Settlement Contract - Distributes winnings to correct predictors"
);

// ─── Data Types ──────────────────────────────────────────────────────────────

#[derive(Clone, PartialEq)]
#[contracttype]
pub enum Outcome {
    Yes,
    No,
}

#[derive(Clone)]
#[contracttype]
pub struct SettlementRecord {
    pub market_id: u64,
    pub outcome: Outcome,
    pub total_yes_pool: i128,
    pub total_no_pool: i128,
    pub total_winning_shares: i128,
    pub platform_fee_bps: u32,
    pub settled_at: u64,
}

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    UsdcToken,
    PositionVault,
    Settlement(u64),
    ClaimedReward(u64, Address),
    PlatformFeesBps,
    PlatformTreasury,
}

// ─── Contract ────────────────────────────────────────────────────────────────

#[contract]
pub struct SettlementContract;

#[contractimpl]
impl SettlementContract {
    pub fn initialize(
        env: Env,
        admin: Address,
        usdc_token: Address,
        position_vault: Address,
        platform_fee_bps: u32,
        treasury: Address,
    ) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::UsdcToken, &usdc_token);
        env.storage().instance().set(&DataKey::PositionVault, &position_vault);
        env.storage().instance().set(&DataKey::PlatformFeesBps, &platform_fee_bps);
        env.storage().instance().set(&DataKey::PlatformTreasury, &treasury);
        env.storage().instance().extend_ttl(17280, 17280);
    }

    /// Register settlement data after market resolution
    /// Called by admin/oracle after market is resolved
    pub fn settle_market(
        env: Env,
        caller: Address,
        market_id: u64,
        outcome: Outcome,
        total_yes_pool: i128,
        total_no_pool: i128,
        total_winning_shares: i128,
    ) {
        caller.require_auth();
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        if caller != admin {
            panic!("unauthorized");
        }

        if env.storage().persistent().has(&DataKey::Settlement(market_id)) {
            panic!("market already settled");
        }

        let fee_bps: u32 = env
            .storage()
            .instance()
            .get(&DataKey::PlatformFeesBps)
            .unwrap_or(200u32); // default 2%

        let record = SettlementRecord {
            market_id,
            outcome,
            total_yes_pool,
            total_no_pool,
            total_winning_shares,
            platform_fee_bps: fee_bps,
            settled_at: env.ledger().timestamp(),
        };

        env.storage()
            .persistent()
            .set(&DataKey::Settlement(market_id), &record);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::Settlement(market_id), 34560, 34560);

        env.events().publish(
            (symbol_short!("settled"), caller, market_id),
            record.settled_at,
        );
    }

    /// Users call this to claim their winnings
    pub fn claim_rewards(
        env: Env,
        user: Address,
        market_id: u64,
        user_shares: i128,
    ) -> i128 {
        user.require_auth();

        if user_shares <= 0 {
            panic!("invalid share amount");
        }

        // Check not already claimed
        if env
            .storage()
            .persistent()
            .has(&DataKey::ClaimedReward(market_id, user.clone()))
        {
            panic!("rewards already claimed");
        }

        let record: SettlementRecord = env
            .storage()
            .persistent()
            .get(&DataKey::Settlement(market_id))
            .unwrap_or_else(|| panic!("market not settled"));

        let total_pool = record.total_yes_pool + record.total_no_pool;

        if record.total_winning_shares == 0 {
            panic!("no winning shares");
        }

        // Gross payout = (user_shares / total_winning_shares) * total_pool
        let gross_payout = (user_shares * total_pool) / record.total_winning_shares;

        // Platform fee deduction
        let fee_amount = (gross_payout * record.platform_fee_bps as i128) / 10_000i128;
        let net_payout = gross_payout - fee_amount;

        if net_payout <= 0 {
            panic!("payout too small");
        }

        // Transfer USDC to user
        let usdc = Self::get_usdc_client(&env);
        usdc.transfer(&env.current_contract_address(), &user, &net_payout);

        // Transfer fee to treasury
        if fee_amount > 0 {
            let treasury: Address = env.storage().instance().get(&DataKey::PlatformTreasury).unwrap();
            usdc.transfer(&env.current_contract_address(), &treasury, &fee_amount);
        }

        // Mark as claimed
        env.storage()
            .persistent()
            .set(&DataKey::ClaimedReward(market_id, user.clone()), &true);

        env.events().publish(
            (symbol_short!("claimed"), user, market_id),
            (net_payout, fee_amount),
        );

        net_payout
    }

    /// Handle cancelled market refunds
    pub fn claim_refund(
        env: Env,
        user: Address,
        market_id: u64,
        user_amount: i128,
    ) -> i128 {
        user.require_auth();

        if env
            .storage()
            .persistent()
            .has(&DataKey::ClaimedReward(market_id, user.clone()))
        {
            panic!("refund already claimed");
        }

        // Mark as claimed to prevent re-entry
        env.storage()
            .persistent()
            .set(&DataKey::ClaimedReward(market_id, user.clone()), &true);

        let usdc = Self::get_usdc_client(&env);
        usdc.transfer(&env.current_contract_address(), &user, &user_amount);

        env.events().publish(
            (symbol_short!("refunded"), user, market_id),
            user_amount,
        );

        user_amount
    }

    // ─── View Functions ───────────────────────────────────────────────────────

    pub fn get_settlement(env: Env, market_id: u64) -> Option<SettlementRecord> {
        env.storage()
            .persistent()
            .get(&DataKey::Settlement(market_id))
    }

    pub fn has_claimed(env: Env, market_id: u64, user: Address) -> bool {
        env.storage()
            .persistent()
            .has(&DataKey::ClaimedReward(market_id, user))
    }

    pub fn calculate_payout(env: Env, market_id: u64, user_shares: i128) -> i128 {
        let record: SettlementRecord = env
            .storage()
            .persistent()
            .get(&DataKey::Settlement(market_id))
            .unwrap_or_else(|| panic!("market not settled"));

        let total_pool = record.total_yes_pool + record.total_no_pool;
        if record.total_winning_shares == 0 {
            return 0i128;
        }

        let gross = (user_shares * total_pool) / record.total_winning_shares;
        let fee = (gross * record.platform_fee_bps as i128) / 10_000i128;
        gross - fee
    }

    // ─── Internal ─────────────────────────────────────────────────────────────

    fn get_usdc_client(env: &Env) -> token::Client {
        let usdc: Address = env.storage().instance().get(&DataKey::UsdcToken).unwrap();
        token::Client::new(env, &usdc)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_payout_formula() {
        // User has 100 shares, total winning shares = 1000, total pool = 1500 USDC
        // Gross = 100/1000 * 1500 = 150 USDC
        // Fee = 150 * 200 / 10000 = 3 USDC (2%)
        // Net = 147 USDC
        let user_shares = 100i128;
        let total_winning_shares = 1000i128;
        let total_pool = 1500i128;
        let fee_bps = 200i128;

        let gross = (user_shares * total_pool) / total_winning_shares;
        let fee = (gross * fee_bps) / 10_000i128;
        let net = gross - fee;

        assert_eq!(gross, 150i128);
        assert_eq!(fee, 3i128);
        assert_eq!(net, 147i128);
    }
}
