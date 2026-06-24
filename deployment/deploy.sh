#!/bin/bash
set -e

echo "🚀 PredictFi Deployment Script"
echo "================================"

NETWORK=${STELLAR_NETWORK:-testnet}
echo "Network: $NETWORK"

# ─── Build Soroban Contracts ──────────────────────────────────────────────────
echo ""
echo "📦 Building Soroban contracts..."
cd ../contracts
cargo build --target wasm32-unknown-unknown --release

WASM_DIR="target/wasm32-unknown-unknown/release"

# ─── Deploy Contracts ─────────────────────────────────────────────────────────
echo ""
echo "🔗 Deploying contracts to Stellar $NETWORK..."

# Fund admin account on testnet
if [ "$NETWORK" = "testnet" ]; then
  echo "Funding admin account..."
  stellar keys generate --global admin --network testnet 2>/dev/null || true
  stellar keys fund admin --network testnet
fi

# Deploy MarketFactory
echo "Deploying MarketFactory..."
MARKET_FACTORY_ID=$(stellar contract deploy \
  --wasm "$WASM_DIR/market_factory.optimized.wasm" \
  --source admin \
  --network $NETWORK)
echo "MarketFactory: $MARKET_FACTORY_ID"

# Deploy PositionVault
echo "Deploying PositionVault..."
POSITION_VAULT_ID=$(stellar contract deploy \
  --wasm "$WASM_DIR/position_vault.optimized.wasm" \
  --source admin \
  --network $NETWORK)
echo "PositionVault: $POSITION_VAULT_ID"

# Deploy Settlement
echo "Deploying Settlement..."
SETTLEMENT_ID=$(stellar contract deploy \
  --wasm "$WASM_DIR/settlement.optimized.wasm" \
  --source admin \
  --network $NETWORK)
echo "Settlement: $SETTLEMENT_ID"

# Deploy Reputation
echo "Deploying Reputation..."
REPUTATION_ID=$(stellar contract deploy \
  --wasm "$WASM_DIR/reputation.optimized.wasm" \
  --source admin \
  --network $NETWORK)
echo "Reputation: $REPUTATION_ID"

ADMIN_ADDR=$(stellar keys address admin)
USDC_CONTRACT="CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA"

# ─── Initialize Contracts ─────────────────────────────────────────────────────
echo ""
echo "⚙️  Initializing contracts..."

stellar contract invoke \
  --id $MARKET_FACTORY_ID \
  --source admin \
  --network $NETWORK \
  -- initialize \
  --admin "$ADMIN_ADDR"

stellar contract invoke \
  --id $POSITION_VAULT_ID \
  --source admin \
  --network $NETWORK \
  -- initialize \
  --admin "$ADMIN_ADDR" \
  --usdc_token "$USDC_CONTRACT" \
  --market_factory "$MARKET_FACTORY_ID"

stellar contract invoke \
  --id $SETTLEMENT_ID \
  --source admin \
  --network $NETWORK \
  -- initialize \
  --admin "$ADMIN_ADDR" \
  --usdc_token "$USDC_CONTRACT" \
  --position_vault "$POSITION_VAULT_ID" \
  --platform_fee_bps 200 \
  --treasury "$ADMIN_ADDR"

stellar contract invoke \
  --id $REPUTATION_ID \
  --source admin \
  --network $NETWORK \
  -- initialize \
  --admin "$ADMIN_ADDR" \
  --authorized_caller "$SETTLEMENT_ID"

# ─── Output .env ──────────────────────────────────────────────────────────────
echo ""
echo "✅ Contracts deployed! Add to your .env:"
echo ""
echo "MARKET_FACTORY_CONTRACT_ID=$MARKET_FACTORY_ID"
echo "POSITION_VAULT_CONTRACT_ID=$POSITION_VAULT_ID"
echo "SETTLEMENT_CONTRACT_ID=$SETTLEMENT_ID"
echo "REPUTATION_CONTRACT_ID=$REPUTATION_ID"
echo "NEXT_PUBLIC_MARKET_FACTORY_CONTRACT=$MARKET_FACTORY_ID"
echo "NEXT_PUBLIC_POSITION_VAULT_CONTRACT=$POSITION_VAULT_ID"
echo "NEXT_PUBLIC_SETTLEMENT_CONTRACT=$SETTLEMENT_ID"
echo "NEXT_PUBLIC_REPUTATION_CONTRACT=$REPUTATION_ID"
echo ""
echo "🎉 Deployment complete!"
