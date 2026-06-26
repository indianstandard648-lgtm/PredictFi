#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, contractmeta,
    Address, Env,
    symbol_short,
};

contractmeta!(
    key = "Description",
    val = "PredictFi Protocol Registry - Central address book for all protocol contracts"
);

// ─── Data Types ──────────────────────────────────────────────────────────────

/// Canonical identifiers for every contract in the protocol.
/// Any contract can query the registry instead of hardcoding peer addresses.
#[derive(Clone, PartialEq)]
#[contracttype]
pub enum ContractId {
    MarketFactory,
    PositionVault,
    Settlement,
    Reputation,
    Treasury,
}

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    Contract(ContractId),
}

// ─── Contract ────────────────────────────────────────────────────────────────

#[contract]
pub struct ProtocolRegistry;

#[contractimpl]
impl ProtocolRegistry {
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().extend_ttl(17280, 17280);
    }

    /// Register or update a contract address. Admin only.
    pub fn set_contract(env: Env, id: ContractId, address: Address) {
        let admin = Self::require_admin(&env);
        admin.require_auth();
        env.storage().instance().set(&DataKey::Contract(id.clone()), &address);
        env.events().publish(
            (symbol_short!("reg_set"),),
            (id, address),
        );
    }

    /// Look up a contract address by its canonical id. Panics if not registered.
    pub fn get_contract(env: Env, id: ContractId) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::Contract(id))
            .unwrap_or_else(|| panic!("contract not registered"))
    }

    /// Returns None if the contract hasn't been registered yet.
    pub fn get_contract_opt(env: Env, id: ContractId) -> Option<Address> {
        env.storage().instance().get(&DataKey::Contract(id))
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

    fn require_admin(env: &Env) -> Address {
        env.storage().instance().get(&DataKey::Admin).unwrap()
    }
}

