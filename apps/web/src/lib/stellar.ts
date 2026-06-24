import {
  StellarWalletsKit,
  WalletNetwork,
  FREIGHTER_ID,
  allowAllModules,
} from '@creit.tech/stellar-wallets-kit';
import {
  Contract,
  Networks,
  SorobanRpc,
  TransactionBuilder,
  Transaction,
  xdr,
  BASE_FEE,
  Address,
  nativeToScVal,
  scValToNative,
} from '@stellar/stellar-sdk';

const NETWORK = (process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? 'testnet') as 'testnet' | 'mainnet';
const RPC_URL = 'https://soroban-testnet.stellar.org';

export const NETWORK_PASSPHRASE =
  NETWORK === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET;

export const rpcServer = new SorobanRpc.Server(RPC_URL);

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
  usdc: process.env.NEXT_PUBLIC_USDC_CONTRACT ?? '',
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
    throw new Error(`Transaction error: ${JSON.stringify(result.errorResult)}`);
  }

  return result.hash;
}

export async function waitForTransaction(txHash: string): Promise<unknown> {
  let attempts = 0;
  while (attempts < 15) {
    await new Promise((r) => setTimeout(r, 2000));
    const result = await rpcServer.getTransaction(txHash);

    if (result.status === SorobanRpc.Api.GetTransactionStatus.SUCCESS) {
      return result.returnValue ? scValToNative(result.returnValue) : null;
    }
    if (result.status === SorobanRpc.Api.GetTransactionStatus.FAILED) {
      throw new Error(`Transaction failed: ${txHash}`);
    }
    attempts++;
  }
  throw new Error('Transaction timeout');
}

// ─── Market Contract Helpers ──────────────────────────────────────────────────

export async function buildBuyYesTx(
  userAddress: string,
  marketId: number,
  usdcAmount: bigint,
): Promise<string> {
  return buildContractTransaction(
    userAddress,
    CONTRACT_IDS.positionVault,
    'buy_yes',
    [
      new Address(userAddress).toScVal(),
      nativeToScVal(marketId, { type: 'u64' }),
      nativeToScVal(usdcAmount, { type: 'i128' }),
    ],
  );
}

export async function buildBuyNoTx(
  userAddress: string,
  marketId: number,
  usdcAmount: bigint,
): Promise<string> {
  return buildContractTransaction(
    userAddress,
    CONTRACT_IDS.positionVault,
    'buy_no',
    [
      new Address(userAddress).toScVal(),
      nativeToScVal(marketId, { type: 'u64' }),
      nativeToScVal(usdcAmount, { type: 'i128' }),
    ],
  );
}

export async function buildApproveUsdcTx(
  userAddress: string,
  amountUsdc: bigint,
): Promise<string> {
  const vaultId = CONTRACT_IDS.positionVault;
  return buildContractTransaction(
    userAddress,
    CONTRACT_IDS.usdc,
    'approve',
    [
      new Address(userAddress).toScVal(),
      new Address(vaultId).toScVal(),
      nativeToScVal(amountUsdc, { type: 'i128' }),
      nativeToScVal(200, { type: 'u32' }),
    ],
  );
}

export function usdcToStroop(usdc: number): bigint {
  return BigInt(Math.floor(usdc * 10_000_000));
}

export function stroopToUsdc(stroops: bigint): number {
  return Number(stroops) / 10_000_000;
}
