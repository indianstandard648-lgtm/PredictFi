import {
  Contract,
  Address,
  xdr,
  nativeToScVal,
  scValToNative,
  SorobanRpc,
  TransactionBuilder,
  BASE_FEE,
} from '@stellar/stellar-sdk';
import {
  rpcServer,
  NETWORK_PASSPHRASE,
  getContractId,
  buildContractTransaction,
} from './stellar';

// ─── Encoding helpers for Soroban contracttype types ─────────────────────────
// Soroban structs → SCV_MAP with fields sorted alphabetically by key name
// Soroban unit enum variants → SCV_VEC([SCV_SYMBOL("VariantName")])

function scmEntry(key: string, val: xdr.ScVal): xdr.ScMapEntry {
  return new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol(key), val });
}

function encodeEnum(variantName: string): xdr.ScVal {
  return xdr.ScVal.scvVec([xdr.ScVal.scvSymbol(variantName)]);
}

// Frontend category → contract Category variant name
const CATEGORY_MAP: Record<string, string> = {
  CRYPTO: 'Crypto',
  SPORTS: 'Sports',
  POLITICS: 'Politics',
  FINANCE: 'Finance',
  TECH: 'AI',
  SCIENCE: 'Custom',
  ENTERTAINMENT: 'Custom',
  WORLD_EVENTS: 'Custom',
  OTHER: 'Custom',
};

// ─── CreateMarketParams encoding (fields alphabetical: category,description,end_date,max_bet,min_bet,oracle,oracle_source,resolution_date,title,trading_fee_bps)
export interface CreateMarketContractParams {
  title: string;
  description: string;
  category: string;        // frontend category key e.g. "CRYPTO"
  oracle: string;          // Stellar address (creator's wallet)
  oracle_source: string;   // human-readable source label
  end_date: bigint;        // unix timestamp (seconds)
  resolution_date: bigint; // unix timestamp (seconds)
  min_bet: bigint;         // 1_000_000 = 0.1 USDC (7-decimal)
  max_bet: bigint;         // 0 = no limit
  trading_fee_bps: number; // 0 = platform default (200 bps)
}

function encodeCreateMarketParams(p: CreateMarketContractParams): xdr.ScVal {
  return xdr.ScVal.scvMap([
    scmEntry('category', encodeEnum(CATEGORY_MAP[p.category] ?? 'Custom')),
    scmEntry('description', nativeToScVal(p.description, { type: 'string' })),
    scmEntry('end_date', nativeToScVal(p.end_date, { type: 'u64' })),
    scmEntry('max_bet', nativeToScVal(p.max_bet, { type: 'i128' })),
    scmEntry('min_bet', nativeToScVal(p.min_bet, { type: 'i128' })),
    scmEntry('oracle', new Address(p.oracle).toScVal()),
    scmEntry('oracle_source', nativeToScVal(p.oracle_source, { type: 'string' })),
    scmEntry('resolution_date', nativeToScVal(p.resolution_date, { type: 'u64' })),
    scmEntry('title', nativeToScVal(p.title, { type: 'string' })),
    scmEntry('trading_fee_bps', nativeToScVal(p.trading_fee_bps, { type: 'u32' })),
  ]);
}

// ─── Transaction builders ─────────────────────────────────────────────────────

/** create_market(creator, params) → u64 market_id */
export async function buildCreateMarketTx(
  creatorAddress: string,
  params: CreateMarketContractParams,
): Promise<string> {
  return buildContractTransaction(
    creatorAddress,
    getContractId('marketFactory'),
    'create_market',
    [
      new Address(creatorAddress).toScVal(),
      encodeCreateMarketParams(params),
    ],
  );
}

/** lock_market(market_id) — no auth required, callable when end_date passed */
export async function buildLockMarketTx(
  callerAddress: string,
  onchainId: number,
): Promise<string> {
  return buildContractTransaction(
    callerAddress,
    getContractId('marketFactory'),
    'lock_market',
    [nativeToScVal(BigInt(onchainId), { type: 'u64' })],
  );
}

/** resolve_market(resolver, market_id, outcome, evidence_url) — resolver = oracle or admin */
export async function buildResolveMarketTx(
  resolverAddress: string,
  onchainId: number,
  outcome: 'Yes' | 'No',
  evidenceUrl: string,
): Promise<string> {
  return buildContractTransaction(
    resolverAddress,
    getContractId('marketFactory'),
    'resolve_market',
    [
      new Address(resolverAddress).toScVal(),
      nativeToScVal(BigInt(onchainId), { type: 'u64' }),
      encodeEnum(outcome),
      nativeToScVal(evidenceUrl, { type: 'string' }),
    ],
  );
}

/** settle_market(caller, market_id, outcome) — caller must be contract admin */
export async function buildSettleMarketTx(
  callerAddress: string,
  onchainId: number,
  outcome: 'Yes' | 'No',
): Promise<string> {
  return buildContractTransaction(
    callerAddress,
    getContractId('settlement'),
    'settle_market',
    [
      new Address(callerAddress).toScVal(),
      nativeToScVal(BigInt(onchainId), { type: 'u64' }),
      encodeEnum(outcome),
    ],
  );
}

/** claim_rewards(user, market_id) → i128 payout — winning position only */
export async function buildClaimRewardsTx(
  userAddress: string,
  onchainId: number,
): Promise<string> {
  return buildContractTransaction(
    userAddress,
    getContractId('settlement'),
    'claim_rewards',
    [
      new Address(userAddress).toScVal(),
      nativeToScVal(BigInt(onchainId), { type: 'u64' }),
    ],
  );
}

/** record_loss(user, market_id) — losing position, updates reputation */
export async function buildRecordLossTx(
  userAddress: string,
  onchainId: number,
): Promise<string> {
  return buildContractTransaction(
    userAddress,
    getContractId('settlement'),
    'record_loss',
    [
      new Address(userAddress).toScVal(),
      nativeToScVal(BigInt(onchainId), { type: 'u64' }),
    ],
  );
}

/** approve USDC spending with correct absolute expiration ledger */
export async function buildApproveUsdcTx(
  userAddress: string,
  amountUsdc: bigint,
): Promise<string> {
  const vaultId = getContractId('positionVault');
  const latestLedger = await rpcServer.getLatestLedger();
  const expirationLedger = latestLedger.sequence + 500; // ~40-minute window

  return buildContractTransaction(
    userAddress,
    getContractId('usdc'),
    'approve',
    [
      new Address(userAddress).toScVal(),
      new Address(vaultId).toScVal(),
      nativeToScVal(amountUsdc, { type: 'i128' }),
      nativeToScVal(expirationLedger, { type: 'u32' }),
    ],
  );
}

// ─── Simulation-based reads (require a valid wallet address) ─────────────────

async function simulateContractCall(
  sourceAddress: string,
  contractId: string,
  method: string,
  args: xdr.ScVal[],
): Promise<unknown> {
  const account = await rpcServer.getAccount(sourceAddress);
  const contract = new Contract(contractId);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(60)
    .build();

  const simulation = await rpcServer.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(simulation)) {
    throw new Error(`Contract read failed: ${simulation.error}`);
  }
  if (!SorobanRpc.Api.isSimulationSuccess(simulation)) {
    throw new Error('Contract simulation failed unexpectedly');
  }
  return simulation.result?.retval ? scValToNative(simulation.result.retval) : null;
}

export interface ChainPools {
  yesPool: number;
  noPool: number;
  yesShares: number;
  noShares: number;
  probYes: number;
  probNo: number;
}

export async function readPoolsFromChain(
  onchainId: number,
  userAddress: string,
): Promise<ChainPools> {
  const raw = await simulateContractCall(
    userAddress,
    getContractId('positionVault'),
    'get_pools',
    [nativeToScVal(BigInt(onchainId), { type: 'u64' })],
  ) as Record<string, bigint>;

  const yesPool = Number(raw.yes_pool ?? 0n) / 10_000_000;
  const noPool = Number(raw.no_pool ?? 0n) / 10_000_000;
  const yesShares = Number(raw.yes_shares ?? 0n) / 10_000_000;
  const noShares = Number(raw.no_shares ?? 0n) / 10_000_000;
  const total = yesPool + noPool;
  const probYes = total === 0 ? 50 : (yesPool / total) * 100;
  const probNo = total === 0 ? 50 : (noPool / total) * 100;

  return { yesPool, noPool, yesShares, noShares, probYes, probNo };
}

export async function readProbabilitiesFromChain(
  onchainId: number,
  userAddress: string,
): Promise<{ probYes: number; probNo: number }> {
  const pools = await readPoolsFromChain(onchainId, userAddress);
  return { probYes: pools.probYes, probNo: pools.probNo };
}

export async function readHasClaimedFromChain(
  onchainId: number,
  userAddress: string,
): Promise<boolean> {
  try {
    const result = await simulateContractCall(
      userAddress,
      getContractId('settlement'),
      'has_claimed',
      [
        nativeToScVal(BigInt(onchainId), { type: 'u64' }),
        new Address(userAddress).toScVal(),
      ],
    );
    return Boolean(result);
  } catch {
    return false;
  }
}

export async function readSettlementFromChain(
  onchainId: number,
  userAddress: string,
): Promise<{ settled: boolean; outcome?: string } | null> {
  try {
    const result = await simulateContractCall(
      userAddress,
      getContractId('settlement'),
      'get_settlement',
      [nativeToScVal(BigInt(onchainId), { type: 'u64' })],
    ) as Record<string, unknown> | null;

    if (!result) return { settled: false };

    const outcome = result.outcome as string[] | null;
    return {
      settled: true,
      outcome: outcome?.[0] as string | undefined,
    };
  } catch {
    return null;
  }
}

// ─── Error extraction ─────────────────────────────────────────────────────────

const CONTRACT_ERROR_MAP: Record<string, string> = {
  'minimum trade is 1 USDC': 'Minimum trade is 0.1 USDC',
  'end_date must be in the future': 'Trading end date must be in the future',
  'resolution_date must be >= end_date': 'Resolution date must be after end date',
  'min_bet must be at least 1 USDC': 'Minimum bet must be at least 0.1 USDC',
  'market is not open': 'Market is not open for trading',
  'market end_date not reached': 'Market trading period has not ended yet',
  'already resolved': 'Market has already been resolved',
  'unauthorized: not admin or oracle': 'You are not authorized to resolve this market',
  'market not settled': 'Market has not been settled yet — please wait for admin settlement',
  'rewards already claimed': 'You have already claimed rewards for this market',
  'no winning position found': 'You do not have a winning position in this market',
  'position already claimed': 'This position has already been claimed',
  'no winning shares exist': 'No winning shares exist — settlement failed',
  'payout too small': 'Payout amount is too small',
  'no deposits to refund': 'No deposits found to refund',
  'already recorded': 'Loss has already been recorded for this market',
  'no losing position found': 'You do not have a losing position in this market',
};

export function extractContractError(rawError: string): string {
  for (const [pattern, message] of Object.entries(CONTRACT_ERROR_MAP)) {
    if (rawError.includes(pattern)) return message;
  }
  if (rawError.includes('Transaction failed')) return 'Transaction was rejected by the network';
  if (rawError.includes('Transaction timeout')) return 'Transaction timed out — please try again';
  if (rawError.includes('insufficient')) return 'Insufficient USDC balance';
  if (rawError.includes('User rejected') || rawError.includes('rejected')) return 'Transaction rejected by wallet';
  return rawError.length > 120 ? `Transaction failed: ${rawError.slice(0, 120)}...` : rawError;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function dateToStellarTimestamp(isoDate: string): bigint {
  return BigInt(Math.floor(new Date(isoDate).getTime() / 1000));
}

export function usdcToStroops(usdc: number): bigint {
  return BigInt(Math.floor(usdc * 10_000_000));
}

export function stroopsToUsdc(stroops: bigint): number {
  return Number(stroops) / 10_000_000;
}
