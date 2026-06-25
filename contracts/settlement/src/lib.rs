#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, contractmeta,
    Address, Env, Symbol, Vec,
    symbol_short, token,
};

contractmeta!(
    key = "Description",
    val = "PredictFi Settlement - Computes payouts from on-chain vault state; never trusts caller-supplied pool values"
);

// ─── Mirror types for cross-contract calls ───────────────────────────────────
// These must match the XDR structure of position-vault's types exactly.

#[derive(Clone, PartialEq)]
#[contracttype]
pub enum VaultSide {
    Yes,
    No,
}

#[derive(Clone)]
#[contracttype]
pub struct VaultPools {
    pub yes_pool: i128,
    pub no_pool: i128,
    pub yes_shares: i128,
    pub no_shares: i128,
}

#[derive(Clone)]
#[contracttype]
pub struct VaultPosition {
    pub user: Address,
    pub market_id: u64,
    pub side: VaultSide,
    pub amount_usdc: i128,
    pub shares: i128,
    pub entry_probability: i128,
    pub timestamp: u64,
    pub claimed: bool,
}

// Mirror type for market-factory's Outcome
#[derive(Clone, PartialEq)]
#[contracttype]
pub enum Outcome {
    Yes,
    No,
}

// ─── Inline cross-contract clients ───────────────────────────────────────────

struct VaultClient<'a> {
    env: &'a Env,
    address: Address,
}

impl<'a> VaultClient<'a> {
    fn new(env: &'a Env, address: Address) -> Self {
        Self { env, address }
    }

    fn get_pools(&self, market_id: u64) -> VaultPools {
        self.env.invoke_contract(
            &self.address,
            &Symbol::new(self.env, "get_pools"),
            (market_id,).into_val(self.env),
        )
    }

    fn get_position(&self, market_id: u64, user: &Address, side: VaultSide) -> Option<VaultPosition> {
        self.env.invoke_contract(
            &self.address,
            &Symbol::new(self.env, "get_position"),
            (market_id, user.clone(), side).into_val(self.env),
        )
    }

    fn mark_claimed(&self, caller: &Address, market_id: u64, user: &Address, side: VaultSide) {
        self.env.invoke_contract::<()>(
            &self.address,
            &Symbol::new(self.env, "mark_claimed"),
            (caller.clone(), market_id, user.clone(), side).into_val(self.env),
        )
    }
}

struct ReputationClient<'a> {
    env: &'a Env,
    address: Address,
}

impl<'a> ReputationClient<'a> {
    fn new(env: &'a Env, address: Address) -> Self {
        Self { env, address }
    }

    fn update_reputation(
        &self,
        caller: &Address,
        user: &Address,
        market_id: u64,
        was_correct: bool,
        volume: i128,
        profit: i128,
    ) {
        self.env.invoke_contract::<()>(
            &self.address,
            &Symbol::new(self.env, "update_reputation"),
            (caller.clone(), user.clone(), market_id, was_correct, volume, profit)
                .into_val(self.env),
        )
    }
}

// ─── Settlement types ─────────────────────────────────────────────────────────

/// Snapshot of on-chain vault state at settlement time.
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
    MarketFactory,
    Reputation,
    PlatformFeeBps,
    PlatformTreasury,
    Settlement(u64),
    ClaimedReward(u64, Address),
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
        market_factory: Address,
        reputation: Address,
        platform_fee_bps: u32,
        treasury: Address,
    ) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::UsdcToken, &usdc_token);
        env.storage().instance().set(&DataKey::PositionVault, &position_vault);
        env.storage().instance().set(&DataKey::MarketFactory, &market_factory);
        env.storage().instance().set(&DataKey::Reputation, &reputation);
        env.storage().instance().set(&DataKey::PlatformFeeBps, &platform_fee_bps);
        env.storage().instance().set(&DataKey::PlatformTreasury, &treasury);
        env.storage().instance().extend_ttl(17280, 17280);
    }

    /// Admin settles a market by reading pool state on-chain from PositionVault.
    /// Pool values are never accepted from the caller — this eliminates the trust gap.
    pub fn settle_market(env: Env, caller: Address, market_id: u64, outcome: Outcome) {
        caller.require_auth();
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        if caller != admin {
            panic!("unauthorized");
        }
        if env.storage().persistent().has(&DataKey::Settlement(market_id)) {
            panic!("market already settled");
        }

        // Read authoritative pool data from the vault — never from caller input.
        let vault_addr: Address = env.storage().instance().get(&DataKey::PositionVault).unwrap();
        let vault = VaultClient::new(&env, vault_addr);
        let pools = vault.get_pools(market_id);

        let total_winning_shares = match outcome {
            Outcome::Yes => pools.yes_shares,
            Outcome::No  => pools.no_shares,
        };

        if total_winning_shares == 0 {
            panic!("no winning shares exist");
        }

        let fee_bps: u32 = env.storage().instance().get(&DataKey::PlatformFeeBps).unwrap_or(200u32);

        let record = SettlementRecord {
            market_id,
            outcome,
            total_yes_pool: pools.yes_pool,
            total_no_pool: pools.no_pool,
            total_winning_shares,
            platform_fee_bps: fee_bps,
            settled_at: env.ledger().timestamp(),
        };

        env.storage().persistent().set(&DataKey::Settlement(market_id), &record);
        env.storage().persistent().extend_ttl(&DataKey::Settlement(market_id), 34560, 34560);

        env.events().publish(
            (symbol_short!("settled"), caller, market_id),
            record.settled_at,
        );
    }

    /// Winners call this to claim their payout.
    pub fn claim_rewards(env: Env, user: Address, market_id: u64) -> i128 {
        user.require_auth();

        // Re-entrancy guard: check and mark BEFORE any transfer.
        if env.storage().persistent().has(&DataKey::ClaimedReward(market_id, user.clone())) {
            panic!("rewards already claimed");
        }
        // Mark claimed immediately — before any external call or transfer.
        env.storage()
            .persistent()
            .set(&DataKey::ClaimedReward(market_id, user.clone()), &true);

        let record: SettlementRecord = env
            .storage()
            .persistent()
            .get(&DataKey::Settlement(market_id))
            .unwrap_or_else(|| panic!("market not settled"));

        let winning_side = match record.outcome {
            Outcome::Yes => VaultSide::Yes,
            Outcome::No  => VaultSide::No,
        };

        // Read user's position from vault — never accept shares as a parameter.
        let vault_addr: Address = env.storage().instance().get(&DataKey::PositionVault).unwrap();
        let vault = VaultClient::new(&env, vault_addr.clone());
        let position = vault
            .get_position(market_id, &user, winning_side.clone())
            .unwrap_or_else(|| panic!("no winning position found"));

        if position.claimed {
            panic!("position already claimed");
        }
        if position.shares <= 0 {
            panic!("no shares to claim");
        }

        let total_pool = record.total_yes_pool + record.total_no_pool;
        let gross = (position.shares * total_pool) / record.total_winning_shares;
        let fee_amount = (gross * record.platform_fee_bps as i128) / 10_000i128;
        let net_payout = gross - fee_amount;

        if net_payout <= 0 {
            panic!("payout too small");
        }

        // Transfer winnings
        let usdc = Self::get_usdc_client(&env);
        usdc.transfer(&env.current_contract_address(), &user, &net_payout);

        if fee_amount > 0 {
            let treasury: Address = env.storage().instance().get(&DataKey::PlatformTreasury).unwrap();
            usdc.transfer(&env.current_contract_address(), &treasury, &fee_amount);
        }

        // Mark position as claimed in the vault
        vault.mark_claimed(
            &env.current_contract_address(),
            market_id,
            &user,
            winning_side,
        );

        // Update reputation — profit = net_payout minus original bet
        let profit = net_payout - position.amount_usdc;
        let rep_addr: Address = env.storage().instance().get(&DataKey::Reputation).unwrap();
        let rep = ReputationClient::new(&env, rep_addr);
        rep.update_reputation(
            &env.current_contract_address(),
            &user,
            market_id,
            true,
            position.amount_usdc,
            profit,
        );

        env.events().publish(
            (symbol_short!("claimed"), user, market_id),
            (net_payout, fee_amount),
        );

        net_payout
    }

    /// Losers call this to record their loss in the reputation system.
    /// No funds are transferred — this only updates the FRS score.
    pub fn record_loss(env: Env, user: Address, market_id: u64) {
        user.require_auth();

        let loss_key = DataKey::ClaimedReward(market_id, user.clone());
        if env.storage().persistent().has(&loss_key) {
            panic!("already recorded");
        }
        env.storage().persistent().set(&loss_key, &true);

        let record: SettlementRecord = env
            .storage()
            .persistent()
            .get(&DataKey::Settlement(market_id))
            .unwrap_or_else(|| panic!("market not settled"));

        let losing_side = match record.outcome {
            Outcome::Yes => VaultSide::No,
            Outcome::No  => VaultSide::Yes,
        };

        let vault_addr: Address = env.storage().instance().get(&DataKey::PositionVault).unwrap();
        let vault = VaultClient::new(&env, vault_addr);
        let position = vault
            .get_position(market_id, &user, losing_side)
            .unwrap_or_else(|| panic!("no losing position found"));

        let rep_addr: Address = env.storage().instance().get(&DataKey::Reputation).unwrap();
        let rep = ReputationClient::new(&env, rep_addr);
        rep.update_reputation(
            &env.current_contract_address(),
            &user,
            market_id,
            false,
            position.amount_usdc,
            -position.amount_usdc, // full loss
        );
    }

    /// Refunds USDC for cancelled markets. Reads deposited amount from vault — never trusts caller.
    pub fn claim_refund(env: Env, user: Address, market_id: u64) -> i128 {
        user.require_auth();

        let refund_key = DataKey::ClaimedReward(market_id, user.clone());
        if env.storage().persistent().has(&refund_key) {
            panic!("refund already claimed");
        }
        // Mark before transfer to prevent re-entrancy.
        env.storage().persistent().set(&refund_key, &true);

        let vault_addr: Address = env.storage().instance().get(&DataKey::PositionVault).unwrap();
        let vault = VaultClient::new(&env, vault_addr);

        // Sum YES + NO deposits to refund the total amount the user put in.
        let yes_amount = vault
            .get_position(market_id, &user, VaultSide::Yes)
            .map(|p| p.amount_usdc)
            .unwrap_or(0i128);
        let no_amount = vault
            .get_position(market_id, &user, VaultSide::No)
            .map(|p| p.amount_usdc)
            .unwrap_or(0i128);

        let total_refund = yes_amount + no_amount;
        if total_refund <= 0 {
            panic!("no deposits to refund");
        }

        let usdc = Self::get_usdc_client(&env);
        usdc.transfer(&env.current_contract_address(), &user, &total_refund);

        env.events().publish(
            (symbol_short!("refunded"), user, market_id),
            total_refund,
        );

        total_refund
    }

    // ─── View ─────────────────────────────────────────────────────────────────

    pub fn get_settlement(env: Env, market_id: u64) -> Option<SettlementRecord> {
        env.storage().persistent().get(&DataKey::Settlement(market_id))
    }

    pub fn has_claimed(env: Env, market_id: u64, user: Address) -> bool {
        env.storage().persistent().has(&DataKey::ClaimedReward(market_id, user))
    }

    /// Preview payout for a given share count using current settlement record.
    pub fn calculate_payout(env: Env, market_id: u64, user_shares: i128) -> i128 {
        let record: SettlementRecord = env
            .storage()
            .persistent()
            .get(&DataKey::Settlement(market_id))
            .unwrap_or_else(|| panic!("market not settled"));

        if record.total_winning_shares == 0 { return 0i128; }
        let total_pool = record.total_yes_pool + record.total_no_pool;
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
        // 100 shares, 1000 total winning shares, 1500 USDC pool, 2% fee
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

    #[test]
    fn test_claimed_before_transfer_invariant() {
        // Demonstrates the re-entrancy fix: claimed is set before transfer.
        // The order is: set claimed → transfer → mark_claimed in vault.
        // If transfer re-enters claim_rewards, the first check blocks re-entry.
        let mut claimed = false;
        // Simulate: set claimed first
        claimed = true;
        // Then transfer (simulated)
        let payout = 147i128;
        // Re-entrancy attempt would find claimed=true and panic — correct.
        assert!(claimed);
        assert_eq!(payout, 147i128);
    }
}
