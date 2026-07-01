# PredictFi — Decentralized Prediction Markets on Stellar

A production-grade prediction market protocol built on the Stellar blockchain using Soroban smart contracts. Trade YES/NO shares on real-world events, build your Forecast Reputation Score (FRS), and earn XLM.

**Live Demo:** [https://web-six-topaz-82.vercel.app](https://web-six-topaz-82.vercel.app)  
**API:** [https://predictfi-api-production.up.railway.app/api/v1/health](https://predictfi-api-production.up.railway.app/api/v1/health)  
**API Docs:** [https://predictfi-api-production.up.railway.app/api/docs](https://predictfi-api-production.up.railway.app/api/docs)  
**Demo Video:** [https://youtu.be/d0EmUSgpJ6s?si=Tb0gx7BaSTow293n](https://youtu.be/d0EmUSgpJ6s?si=Tb0gx7BaSTow293n)

---

## Architecture Overview

```
predictfi/
├── apps/
│   ├── web/          # Next.js 15 frontend (TypeScript + TailwindCSS)
│   └── api/          # NestJS backend (PostgreSQL + Prisma + Redis)
├── contracts/        # Soroban smart contracts (Rust)
│   ├── market-factory/
│   ├── position-vault/
│   ├── settlement/
│   └── reputation/
├── deployment/       # Docker + deploy scripts
└── packages/
    └── types/        # Shared TypeScript types
```

---

## Smart Contracts

| Contract | Description |
|---|---|
| `ProtocolRegistry` | Central address book — maps canonical IDs to deployed contract addresses |
| `MarketFactory` | Creates markets, stores metadata, resolves outcomes |
| `PositionVault` | Accepts USDC, mints YES/NO shares, tracks pools |
| `SettlementContract` | Calculates payouts, distributes USDC to winners |
| `ReputationContract` | Tracks FRS score, accuracy, and streak |

### Deployed Contracts (Testnet)

| Contract | Contract ID |
|---|---|
| `ProtocolRegistry` | `CC2YXV2DHQXUMJOEMOS5KTGS3EFGALTDPLE4T5IARPNTQ5L7LGVNTYLI` |
| `MarketFactory` | `CDI5OD7DJPVMYN23HYHL4MOKT6F5NWXRB4QWJXUUTRDLT3XWOWUUALBO` |
| `PositionVault` | `CASVZNP3EOXIFQNWKLNU44VINHSZRAQIGF5CW24P6XIPDM7U2R4W6EDZ` |
| `SettlementContract` | `CBIMDLGZBUH6QBSGM5V5MRIW5US6ZFJOH2XYPCOJY7VEDADXMBZMWXLL` |
| `ReputationContract` | `CBOW7U34OSOVAZP4QE5AW2AWOR7JZWXHT7H5SIH2ZXGDOSINBMETMXWC` |

> Network: Stellar Testnet · Explorer: [stellar.expert](https://stellar.expert/explorer/testnet/contract/CC2YXV2DHQXUMJOEMOS5KTGS3EFGALTDPLE4T5IARPNTQ5L7LGVNTYLI)

### Post-Deployment: Register Contracts in Registry

After all contracts are deployed, call `set_contract` on the Registry once per contract (admin wallet required):

```
registry.set_contract(MarketFactory,  CDI5OD7DJPVMYN23HYHL4MOKT6F5NWXRB4QWJXUUTRDLT3XWOWUUALBO)
registry.set_contract(PositionVault,  CASVZNP3EOXIFQNWKLNU44VINHSZRAQIGF5CW24P6XIPDM7U2R4W6EDZ)
registry.set_contract(Settlement,     CBIMDLGZBUH6QBSGM5V5MRIW5US6ZFJOH2XYPCOJY7VEDADXMBZMWXLL)
registry.set_contract(Reputation,     CBOW7U34OSOVAZP4QE5AW2AWOR7JZWXHT7H5SIH2ZXGDOSINBMETMXWC)
registry.set_contract(Treasury,       GC5OZM7AY73DKZMPWU5BMW3EA6BXCYJIIF6UUQQ44XT4DOJQOXQZU2YF)
```

Any contract or off-chain service can then resolve peer addresses via `get_contract` / `get_contract_opt` without hardcoding.

### Market Pricing Formula

```
probability_yes = yesPool / (yesPool + noPool)
probability_no  = noPool  / (yesPool + noPool)
```

### Reward Formula

```
userPayout = (userShares / totalWinningShares) * totalPool * (1 - 0.02)
```

### FRS Formula

```
FRS = (accuracy * 0.4) + (volume_score * 0.2) + (profitability * 0.2) + (consistency * 0.2)
```

---

## Quick Start

### Prerequisites

- Node.js 20+
- Rust + `wasm32-unknown-unknown` target
- Stellar CLI (`stellar`)
- Docker + Docker Compose
- PostgreSQL 16

### 1. Clone & Install

```bash
git clone https://github.com/indianstandard648-lgtm/PredictFi.git
cd predictfi
cp .env.example .env
npm install
```

### 2. Start Infrastructure

```bash
cd deployment
docker-compose up -d postgres redis
```

### 3. Setup Database

```bash
npm run db:migrate
```

### 4. Build & Deploy Contracts (Testnet)

```bash
# Install Stellar CLI
cargo install --locked stellar-cli --features opt

# Add WASM target
rustup target add wasm32-unknown-unknown

# Deploy
chmod +x deployment/deploy.sh
./deployment/deploy.sh

# Copy contract IDs to .env
```

### 5. Start Development

```bash
npm run dev
```

- Frontend: http://localhost:3000
- API: http://localhost:4000
- Swagger: http://localhost:4000/api/docs

---

## API Endpoints

### Markets

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v1/markets` | List markets (filterable) |
| POST | `/api/v1/markets` | Create market |
| GET | `/api/v1/markets/:id` | Get market detail |
| GET | `/api/v1/markets/trending` | Trending markets |
| GET | `/api/v1/markets/stats` | Platform stats |
| POST | `/api/v1/markets/:id/resolve` | Resolve market |

### Positions

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/v1/positions/buy` | Buy YES/NO position |
| GET | `/api/v1/positions` | Get user positions |
| POST | `/api/v1/positions/:id/claim` | Claim winnings |
| GET | `/api/v1/positions/portfolio/stats` | Portfolio summary |

### Leaderboard

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v1/leaderboard` | Full leaderboard |
| GET | `/api/v1/leaderboard/top` | Top 5 predictors |
| GET | `/api/v1/leaderboard/me/rank` | Your rank |

### Oracle

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/v1/oracle/resolve` | Admin: resolve market |
| GET | `/api/v1/oracle/pending` | Pending resolutions |

---

## Frontend Pages

| Route | Description |
|---|---|
| `/` | Homepage with trending markets + stats |
| `/markets` | Market browser with filters |
| `/markets/:id` | Market detail + trading panel |
| `/create` | Create prediction market |
| `/portfolio` | Your positions + P&L |
| `/leaderboard` | FRS rankings |
| `/profile/:address` | Public forecaster profile |

---

## Database Schema

- **User** — walletAddress, username, profile
- **Market** — title, category, pools, status, dates
- **Position** — user × market × side × shares × status
- **Resolution** — outcome, resolver, evidence
- **Reputation** — FRS, accuracy, streak, rank
- **PriceSnapshot** — historical probability timeline
- **OracleRequest** — oracle submission tracking

---

## Security

- **No secrets in smart contracts** — admin key never stored on-chain
- **Reentrancy protected** — state updated before external token transfers
- **Overflow-safe** — `overflow-checks = true` in release profile
- **Input validation** — all amounts validated at contract boundary
- **Oracle access control** — only whitelisted resolver can submit outcomes
- **2% platform fee** — taken from winnings, not deposits

---

## Future Roadmap

The architecture is explicitly designed for:

1. **Leverage Trading** — PositionVault can extend to margin accounts
2. **Liquidity Vaults** — LMSR AMM pricing via pool extension
3. **Prediction ETFs** — basket positions across correlated markets
4. **DAO Governance** — admin functions migrate to on-chain voting
5. **AI Forecasting Assistant** — FRS feeds training data for AI suggestions
6. **Cross-market Hedging** — Settlement contract supports hedge positions
7. **External Oracles** — OracleProvider interface ready for UMA, Chainlink, API3

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15, TypeScript, TailwindCSS, Framer Motion |
| UI Components | ShadCN UI pattern, Radix UI primitives |
| Wallet | Stellar Wallets Kit (Freighter, LOBSTR, xBull) |
| Charts | Recharts |
| State | Zustand |
| Backend | NestJS, Prisma ORM, PostgreSQL, Redis |
| Blockchain | Soroban (Rust), Stellar Testnet |
| Infra | Docker, Vercel (web), Railway (API) |

---

## License

MIT
