import {
  StellarWalletsKit,
  WalletNetwork,
  FREIGHTER_ID,
  allowAllModules,
} from '@creit.tech/stellar-wallets-kit';
import {
  Asset,
  Contract,
  Networks,
  rpc as SorobanRpc,
  TransactionBuilder,
  Transaction,
  xdr,
  BASE_FEE,
  Address,
  nativeToScVal,
  scValToNative,
} from '@stellar/stellar-sdk';

const NETWORK = (process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? 'testnet') as 'testnet' | 'mainnet';

const RPC_URL =
  process.env.NEXT_PUBLIC_STELLAR_RPC_URL ??
  (NETWORK === 'mainnet'
    ? 'https://soroban-mainnet.stellar.org'
    : 'https://soroban-testnet.stellar.org');

export const NETWORK_PASSPHRASE =
  NETWORK === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET;

export const rpcServer = new SorobanRpc.Server(RPC_URL);

// Explorer base URL — switches automatically with network
const EXPLORER_NET = NETWORK === 'mainnet' ? 'public' : 'testnet';
export function stellarExplorerUrl(
  type: 'tx' | 'account' | 'contract',
  id: string,
): string {
  return `https://stellar.expert/explorer/${EXPLORER_NET}/${type}/${id}`;
}

// Native XLM SAC contract ID (derived from network passphrase — no env var needed)
export const XLM_CONTRACT_ID = Asset.native().contractId(NETWORK_PASSPHRASE);

// ─── Wallet Kit ───────────────────────────────────────────────────────────────

let _kit: StellarWalletsKit | null = null;

export function getWalletKit(): StellarWalletsKit {
  if (!_kit) {
    _kit = new StellarWalletsKit({
      network: NETWORK === 'mainnet' ? WalletNetwork.PUBLIC : WalletNetwork.TESTNET,
      selectedWalletId: FREIGHTER_ID,
      modules: allowAllModules(),
    });
  }
  return _kit;
}

export async function connectWallet(): Promise<string> {
  const kit = getWalletKit();
  await kit.openModal({
    onWalletSelected: async (option) => {
      kit.setWallet(option.id);
    },
  });
  const { address } = await kit.getAddress();
  return address;
}

export async function disconnectWallet(): Promise<void> {
  const kit = getWalletKit();
  await kit.disconnect();
}

export async function signTransaction(
  xdrTx: string,
  walletAddress: string,
): Promise<string> {
  const kit = getWalletKit();
  const { signedTxXdr } = await kit.signTransaction(xdrTx, {
    address: walletAddress,
    networkPassphrase: NETWORK_PASSPHRASE,
  });
  return signedTxXdr;
}

// ─── Contract IDs ─────────────────────────────────────────────────────────────

const CONTRACT_IDS = {
  marketFactory: process.env.NEXT_PUBLIC_MARKET_FACTORY_CONTRACT ?? '',
  positionVault: process.env.NEXT_PUBLIC_POSITION_VAULT_CONTRACT ?? '',
  settlement: process.env.NEXT_PUBLIC_SETTLEMENT_CONTRACT ?? '',
  reputation: process.env.NEXT_PUBLIC_REPUTATION_CONTRACT ?? '',
};

export function getContractId(name: keyof typeof CONTRACT_IDS): string {
  return CONTRACT_IDS[name];
}

export async function buildContractTransaction(
  sourceAddress: string,
  contractId: string,
  method: string,
  args: xdr.ScVal[],
): Promise<string> {
  const account = await rpcServer.getAccount(sourceAddress);
  const contract = new Contract(contractId);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(60)
    .build();

  const prepared = await rpcServer.prepareTransaction(tx);
  return prepared.toXDR();
}

export async function submitSignedTransaction(signedXdr: string): Promise<string> {
  const tx = new Transaction(signedXdr, NETWORK_PASSPHRASE);
  const result = await rpcServer.sendTransaction(tx);

  if (result.status === 'ERROR') {
    let detail = 'unknown error';
    try { detail = result.errorResult?.toXDR('base64') ?? 'no result'; } catch { /* noop */ }
    throw new Error(`Transaction error: ${detail}`);
  }

  return result.hash;
}

export async function waitForTransaction(txHash: string): Promise<unknown> {
  const result = await rpcServer.pollTransaction(txHash, { attempts: 20 });

  if (result.status === SorobanRpc.Api.GetTransactionStatus.SUCCESS) {
    return result.returnValue ? scValToNative(result.returnValue) : null;
  }

  // Extract readable error from resultXdr if available
  let detail = txHash;
  try {
    const xdrResult = (result as any).resultXdr;
    if (xdrResult && typeof xdrResult.toXDR === 'function') {
      detail = xdrResult.toXDR('base64');
    }
  } catch { /* noop */ }

  throw new Error(`Transaction failed: ${detail}`);
}

// ─── Market Contract Helpers ──────────────────────────────────────────────────

export async function buildBuyYesTx(
  userAddress: string,
  marketId: number,
  amount: bigint,
): Promise<string> {
  return buildContractTransaction(
    userAddress,
    CONTRACT_IDS.positionVault,
    'buy_yes',
    [
      new Address(userAddress).toScVal(),
      nativeToScVal(marketId, { type: 'u64' }),
      nativeToScVal(amount, { type: 'i128' }),
    ],
  );
}

export async function buildBuyNoTx(
  userAddress: string,
  marketId: number,
  amount: bigint,
): Promise<string> {
  return buildContractTransaction(
    userAddress,
    CONTRACT_IDS.positionVault,
    'buy_no',
    [
      new Address(userAddress).toScVal(),
      nativeToScVal(marketId, { type: 'u64' }),
      nativeToScVal(amount, { type: 'i128' }),
    ],
  );
}

export function xlmToStroop(xlm: number): bigint {
  return BigInt(Math.floor(xlm * 10_000_000));
}

export function stroopToXlm(stroops: bigint): number {
  return Number(stroops) / 10_000_000;
}
