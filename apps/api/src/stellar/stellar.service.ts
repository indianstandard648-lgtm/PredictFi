import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Contract,
  Networks,
  rpc as SorobanRpc,
  TransactionBuilder,
  Transaction,
  xdr,
  BASE_FEE,
  Keypair,
  nativeToScVal,
  scValToNative,
  Address,
} from '@stellar/stellar-sdk';

@Injectable()
export class StellarService implements OnModuleInit {
  private readonly logger = new Logger(StellarService.name);
  private rpcServer: SorobanRpc.Server;
  private networkPassphrase: string;
  private adminKeypair: Keypair | null = null;

  constructor(private config: ConfigService) {}

  onModuleInit() {
    const rpcUrl = this.config.get<string>('STELLAR_RPC_URL', 'https://soroban-testnet.stellar.org');
    const network = this.config.get<string>('STELLAR_NETWORK', 'testnet');

    this.rpcServer = new SorobanRpc.Server(rpcUrl, { allowHttp: rpcUrl.startsWith('http://') });
    this.networkPassphrase = network === 'mainnet'
      ? Networks.PUBLIC
      : Networks.TESTNET;

    const adminSecret = this.config.get<string>('ADMIN_WALLET_SECRET');
    if (adminSecret) {
      this.adminKeypair = Keypair.fromSecret(adminSecret);
    }

    this.logger.log(`Stellar service initialized on ${network}`);
  }

  async verifyTransaction(txHash: string): Promise<{ success: boolean; result: unknown }> {
    try {
      const result = await this.rpcServer.getTransaction(txHash);
      return {
        success: result.status === SorobanRpc.Api.GetTransactionStatus.SUCCESS,
        result: 'returnValue' in result && result.returnValue ? scValToNative(result.returnValue as xdr.ScVal) : null,
      };
    } catch {
      return { success: false, result: null };
    }
  }

  async invokeContract(
    contractId: string,
    method: string,
    args: xdr.ScVal[],
    sourceKeypair?: Keypair,
  ): Promise<unknown> {
    const keypair = sourceKeypair ?? this.adminKeypair;
    if (!keypair) throw new Error('No keypair configured for contract invocation');

    const account = await this.rpcServer.getAccount(keypair.publicKey());
    const contract = new Contract(contractId);

    const transaction = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(contract.call(method, ...args))
      .setTimeout(30)
      .build();

    const preparedTx = await this.rpcServer.prepareTransaction(transaction);
    preparedTx.sign(keypair);

    const response = await this.rpcServer.sendTransaction(preparedTx);
    if (response.status === 'ERROR') {
      let detail = 'unknown error';
      try { detail = response.errorResult?.toXDR('base64') ?? 'no result'; } catch { /* noop */ }
      throw new Error(`Contract invocation failed: ${detail}`);
    }

    return this.waitForTransaction(response.hash);
  }

  async waitForTransaction(txHash: string, maxAttempts = 10): Promise<unknown> {
    let attempts = 0;
    while (attempts < maxAttempts) {
      await new Promise((r) => setTimeout(r, 2000));
      const result = await this.rpcServer.getTransaction(txHash);

      if (result.status === SorobanRpc.Api.GetTransactionStatus.SUCCESS) {
        return result.returnValue ? scValToNative(result.returnValue) : null;
      }
      if (result.status === SorobanRpc.Api.GetTransactionStatus.FAILED) {
        throw new Error(`Transaction failed: ${txHash}`);
      }
      attempts++;
    }
    throw new Error(`Transaction timeout after ${maxAttempts} attempts: ${txHash}`);
  }

  // ─── High-level contract operations ──────────────────────────────────────

  async settleMarket(onchainId: number, outcome: 'Yes' | 'No'): Promise<void> {
    if (!this.adminKeypair) {
      throw new Error('ADMIN_WALLET_SECRET not configured — cannot call settle_market');
    }
    const settlementId = this.config.get<string>('SETTLEMENT_CONTRACT_ID');
    if (!settlementId) throw new Error('SETTLEMENT_CONTRACT_ID not set');

    const adminAddress = this.adminKeypair.publicKey();
    await this.invokeContract(
      settlementId,
      'settle_market',
      [
        this.addressToScVal(adminAddress),
        this.u64ToScVal(BigInt(onchainId)),
        xdr.ScVal.scvVec([xdr.ScVal.scvSymbol(outcome)]),
      ],
    );
  }

  addressToScVal(address: string): xdr.ScVal {
    return new Address(address).toScVal();
  }

  u64ToScVal(value: number | bigint): xdr.ScVal {
    return nativeToScVal(value, { type: 'u64' });
  }

  i128ToScVal(value: bigint): xdr.ScVal {
    return nativeToScVal(value, { type: 'i128' });
  }

  stringToScVal(value: string): xdr.ScVal {
    return nativeToScVal(value, { type: 'string' });
  }

  get rpc(): SorobanRpc.Server {
    return this.rpcServer;
  }

  get passphrase(): string {
    return this.networkPassphrase;
  }
}
