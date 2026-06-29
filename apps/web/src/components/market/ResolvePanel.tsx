'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Loader2, CheckCircle, ExternalLink, AlertCircle } from 'lucide-react';
import { useWalletStore } from '@/stores/walletStore';
import {
  buildResolveMarketTx,
  extractContractError,
  readMarketOnChain,
  readFactoryAdmin,
} from '@/lib/contracts';
import { signTransaction, submitSignedTransaction, waitForTransaction, stellarExplorerUrl } from '@/lib/stellar';
import { resolveMarket } from '@/lib/api';
import toast from 'react-hot-toast';
import { Market } from '@/types';

interface Props {
  market: Market;
  onResolved?: () => void;
}

export function ResolvePanel({ market, onResolved }: Props) {
  const { address, isConnected } = useWalletStore();
  const [outcome, setOutcome] = useState<'Yes' | 'No' | ''>('');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [isResolving, setIsResolving] = useState(false);
  const [txHash, setTxHash] = useState('');

  const isCreator = address && market.creator?.walletAddress === address;
  const canResolve = isConnected && (isCreator || true); // contract enforces auth

  if (!isConnected) return null;
  if (market.status === 'RESOLVED' || market.status === 'CANCELLED') return null;

  async function handleResolve(e: React.FormEvent) {
    e.preventDefault();
    if (!address || !outcome) return;
    if (!market.onchainId) {
      toast.error('Market has no on-chain ID — it was not deployed to the blockchain');
      return;
    }

    setIsResolving(true);
    const loadingToast = toast.loading('Verifying market on-chain....');

    try {
      // Step 0: Verify market exists on-chain and current user is authorized
      const [onChainMarket, adminAddr] = await Promise.all([
        readMarketOnChain(market.onchainId, address),
        readFactoryAdmin(address),
      ]);

      if (!onChainMarket) {
        toast.error(
          'Market not found on-chain — testnet records expire after ~2 days. Create a new market to test resolution.',
          { id: loadingToast, duration: 8000 },
        );
        return;
      }
      if (onChainMarket.status === 'Resolved') {
        toast.error('This market has already been resolved on-chain.', { id: loadingToast });
        return;
      }
      if (onChainMarket.status === 'Cancelled') {
        toast.error('This market has been cancelled and cannot be resolved.', { id: loadingToast });
        return;
      }

      // Admin must be readable — null means instance storage TTL expired
      if (adminAddr === null) {
        toast.error(
          'Market-factory admin record has expired on testnet. Call initialize() on the factory contract again via Stellar playground, then retry.',
          { id: loadingToast, duration: 12000 },
        );
        return;
      }

      const isOracle = onChainMarket.oracle === address;
      const isAdmin = adminAddr === address;
      if (!isOracle && !isAdmin) {
        toast.error(
          `Not authorized — you must be the market oracle (${onChainMarket.oracle.slice(0, 8)}…) or the factory admin to resolve.`,
          { id: loadingToast, duration: 10000 },
        );
        return;
      }

      // Step 1: Build resolve_market transaction
      toast.loading('Building resolution transaction...', { id: loadingToast });
      const resolveTxXdr = await buildResolveMarketTx(
        address,
        market.onchainId,
        outcome as 'Yes' | 'No',
        evidenceUrl || 'https://predictfi.app/evidence',
      );

      // Step 2: Sign with wallet
      toast.loading('Waiting for wallet signature...', { id: loadingToast });
      const signedXdr = await signTransaction(resolveTxXdr, address);

      // Step 3: Submit
      toast.loading('Submitting to Stellar network...', { id: loadingToast });
      const hash = await submitSignedTransaction(signedXdr);

      // Step 4: Wait for confirmation
      toast.loading('Waiting for ledger confirmation...', { id: loadingToast });
      await waitForTransaction(hash);
      setTxHash(hash);

      // Step 5: Notify backend — backend triggers settle_market with admin keypair
      toast.loading('Syncing resolution with backend...', { id: loadingToast });
      await resolveMarket(address, market.id, {
        outcome: outcome.toUpperCase() as 'YES' | 'NO',
        evidenceUrl: evidenceUrl || undefined,
        txHash: hash,
      });

      toast.success(
        `Market resolved as ${outcome.toUpperCase()}! Settlement in progress.`,
        { id: loadingToast, duration: 6000 },
      );

      onResolved?.();
    } catch (e: any) {
      const msg = extractContractError(e?.message ?? 'Resolution failed');
      toast.error(msg, { id: loadingToast });
    } finally {
      setIsResolving(false);
    }
  }

  if (txHash) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="card-base p-5 border border-primary/30"
      >
        <div className="flex items-center gap-3 mb-3">
          <CheckCircle className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-primary">Market Resolved</h3>
        </div>
        <p className="text-sm text-muted mb-3">
          Resolved as <span className="font-bold text-white">{outcome?.toUpperCase()}</span>.
          Settlement is processing.
        </p>
        <a
          href={stellarExplorerUrl('tx', txHash)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-primary text-sm hover:underline"
        >
          View transaction <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="card-base p-5 border border-warning/20"
    >
      <div className="flex items-center gap-3 mb-4">
        <ShieldCheck className="w-5 h-5 text-warning" />
        <h3 className="font-semibold">Resolve Market</h3>
        <span className="text-xs text-muted">(Oracle / Admin)</span>
      </div>

      {!market.onchainId && (
        <div className="flex items-start gap-2 p-3 bg-no/10 rounded-lg text-no text-xs mb-4">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          This market was not deployed on-chain and cannot be resolved via contract.
        </div>
      )}

      <form onSubmit={handleResolve} className="space-y-4">
        <div>
          <label className="text-xs text-muted block mb-2">Outcome</label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setOutcome('Yes')}
              className={`flex-1 py-3 rounded-lg font-semibold text-sm transition-all ${
                outcome === 'Yes'
                  ? 'bg-primary text-background'
                  : 'bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20'
              }`}
            >
              YES Wins
            </button>
            <button
              type="button"
              onClick={() => setOutcome('No')}
              className={`flex-1 py-3 rounded-lg font-semibold text-sm transition-all ${
                outcome === 'No'
                  ? 'bg-no text-white'
                  : 'bg-no/10 border border-no/20 text-no hover:bg-no/20'
              }`}
            >
              NO Wins
            </button>
          </div>
        </div>

        <div>
          <label className="text-xs text-muted block mb-1.5">Evidence URL (optional)</label>
          <input
            type="url"
            value={evidenceUrl}
            onChange={(e) => setEvidenceUrl(e.target.value)}
            placeholder="https://source.com/proof"
            className="input-base text-sm"
          />
        </div>

        <button
          type="submit"
          disabled={isResolving || !outcome || !market.onchainId}
          className="w-full py-3 rounded-lg bg-warning text-background font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-yellow-400 transition-colors"
        >
          {isResolving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Resolving...
            </>
          ) : (
            <>
              <ShieldCheck className="w-4 h-4" />
              Resolve Market
            </>
          )}
        </button>

        <p className="text-xs text-muted text-center">
          Only the market oracle or admin can resolve. Authorization is enforced on-chain.
        </p>
      </form>
    </motion.div>
  );
}
