'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { CheckCircle, Wallet, ExternalLink, TrendingUp, TrendingDown, Loader2 } from 'lucide-react';
import { fetchUserPositions, fetchPortfolioStats, claimReward } from '@/lib/api';
import { useWalletStore } from '@/stores/walletStore';
import { Position } from '@/types';
import { formatXLM, formatDate, cn } from '@/lib/utils';
import {
  buildClaimRewardsTx,
  buildRecordLossTx,
  extractContractError,
} from '@/lib/contracts';
import { signTransaction, submitSignedTransaction, waitForTransaction, stellarExplorerUrl } from '@/lib/stellar';
import toast from 'react-hot-toast';

interface PortfolioStats {
  totalPositions: number;
  activePositions: number;
  totalInvested: number;
  totalPayout: number;
  totalProfit: number;
  roi: number;
  winRate: number;
}

export default function PortfolioPage() {
  const { address, isConnected } = useWalletStore();
  const [positions, setPositions] = useState<Position[]>([]);
  const [stats, setStats] = useState<PortfolioStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [tab, setTab] = useState<'active' | 'settled'>('active');
  const [claimingId, setClaimingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!address) { setIsLoading(false); return; }
    try {
      const [pos, st] = await Promise.all([
        fetchUserPositions(address),
        fetchPortfolioStats(address),
      ]);
      setPositions(pos as any);
      setStats(st as any);
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  useEffect(() => { refresh(); }, [refresh]);

  async function handleClaim(position: Position) {
    if (!address) return;
    if (claimingId) return; // prevent double-click

    const market = position.market as any;
    const resolution = market?.resolution;
    const isWinner = resolution?.outcome === position.side;
    const onchainId = market?.onchainId as number | undefined;

    if (!onchainId) {
      // Market not on-chain — just update DB
      try {
        const result = await claimReward(address, position.id, 'no-onchain-tx');
        if (result.won) {
          toast.success(`Claimed ${formatXLM(result.payout)}!`);
        } else {
          toast('Position settled. Better luck next time.', { icon: '📉' });
        }
        await refresh();
      } catch (e: any) {
        toast.error(e?.response?.data?.message ?? 'Claim failed');
      }
      return;
    }

    setClaimingId(position.id);
    const loadingToast = toast.loading('Preparing claim transaction...');

    try {
      let txHash: string;

      if (isWinner) {
        // ── Winner: claim_rewards on Settlement contract ──────────────────
        toast.loading('Building claim transaction...', { id: loadingToast });
        const claimTxXdr = await buildClaimRewardsTx(address, onchainId);

        toast.loading('Waiting for wallet signature...', { id: loadingToast });
        const signedXdr = await signTransaction(claimTxXdr, address);

        toast.loading('Submitting to Stellar network...', { id: loadingToast });
        txHash = await submitSignedTransaction(signedXdr);

        toast.loading('Waiting for confirmation...', { id: loadingToast });
        await waitForTransaction(txHash);
      } else {
        // ── Loser: record_loss on Settlement contract (updates reputation) ─
        toast.loading('Recording loss for reputation...', { id: loadingToast });
        try {
          const lossTxXdr = await buildRecordLossTx(address, onchainId);
          const signedXdr = await signTransaction(lossTxXdr, address);
          txHash = await submitSignedTransaction(signedXdr);
          await waitForTransaction(txHash);
        } catch {
          // record_loss is optional — don't block settlement
          txHash = 'loss-recorded-locally';
        }
      }

      // Sync with backend
      toast.loading('Syncing with backend...', { id: loadingToast });
      const result = await claimReward(address, position.id, txHash);

      if (result.won) {
        toast.success(
          `Claimed ${formatXLM(result.payout)}! Tx: ${txHash.slice(0, 8)}...`,
          { id: loadingToast, duration: 6000 },
        );
      } else {
        toast('Position settled. Better luck next time.', {
          id: loadingToast,
          icon: '📉',
          duration: 4000,
        });
      }

      await refresh();
    } catch (e: any) {
      const msg = extractContractError(e?.message ?? e?.response?.data?.message ?? 'Claim failed');
      toast.error(msg, { id: loadingToast });
    } finally {
      setClaimingId(null);
    }
  }

  const active = positions.filter((p) => p.status === 'ACTIVE');
  const settled = positions.filter((p) => p.status !== 'ACTIVE');

  if (!isConnected) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <Wallet className="w-16 h-16 text-muted mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-2">Connect Your Wallet</h2>
        <p className="text-muted">Connect your wallet to view your portfolio</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="text-3xl font-bold mb-8">Portfolio</h1>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          {[
            { label: 'Total Positions', value: stats.totalPositions },
            { label: 'Active', value: stats.activePositions },
            { label: 'Invested', value: formatXLM(stats.totalInvested) },
            { label: 'Payout', value: formatXLM(stats.totalPayout) },
            {
              label: 'P&L',
              value: formatXLM(Math.abs(stats.totalProfit)),
              color: stats.totalProfit >= 0 ? 'text-primary' : 'text-no',
              prefix: stats.totalProfit >= 0 ? '+' : '-',
            },
            { label: 'Win Rate', value: `${stats.winRate.toFixed(1)}%`, color: 'text-primary' },
          ].map(({ label, value, color, prefix }) => (
            <div key={label} className="stat-card">
              <span className="text-xs text-muted">{label}</span>
              <span className={cn('text-xl font-bold font-mono', color)}>
                {prefix}{value}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-4 mb-6 border-b border-border">
        {(['active', 'settled'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'pb-3 px-1 text-sm font-medium capitalize border-b-2 -mb-px transition-colors',
              tab === t
                ? 'border-primary text-primary'
                : 'border-transparent text-muted hover:text-white',
            )}
          >
            {t === 'active' ? `Active (${active.length})` : `Settled (${settled.length})`}
          </button>
        ))}
      </div>

      {/* Positions */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card-base p-5 h-24 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {(tab === 'active' ? active : settled).map((position, i) => {
            const posMarket = position.market as any;
            const isSettledWinner =
              position.status === 'ACTIVE' &&
              posMarket?.status === 'RESOLVED' &&
              posMarket?.resolution?.outcome === position.side;
            const isSettledLoser =
              position.status === 'ACTIVE' &&
              posMarket?.status === 'RESOLVED' &&
              posMarket?.resolution?.outcome !== position.side;
            const isClaiming = claimingId === position.id;

            return (
              <motion.div
                key={position.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="card-base p-5"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/markets/${position.marketId}`}
                      className="font-medium hover:text-primary transition-colors line-clamp-1"
                    >
                      {posMarket?.title ?? 'Market'}
                    </Link>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted">
                      <span className={position.side === 'YES' ? 'text-primary font-medium' : 'text-no font-medium'}>
                        {position.side}
                      </span>
                      <span>•</span>
                      <span>{formatDate(position.createdAt)}</span>
                      <span>•</span>
                      <span>{parseFloat(position.sharesOwned).toFixed(2)} shares</span>
                      {position.txHash && (
                        <>
                          <span>•</span>
                          <a
                            href={stellarExplorerUrl('tx', position.txHash)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 hover:text-primary transition-colors"
                          >
                            tx <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <p className="text-xs text-muted">Invested</p>
                      <p className="font-mono font-medium">{formatXLM(position.amountUsdc)}</p>
                    </div>

                    {position.status === 'ACTIVE' && !isSettledWinner && !isSettledLoser && (
                      <div>
                        <p className="text-xs text-muted">Entry Prob</p>
                        <p className="font-mono">{parseFloat(position.entryProbability).toFixed(1)}%</p>
                      </div>
                    )}

                    {position.payout && position.status !== 'ACTIVE' && (
                      <div>
                        <p className="text-xs text-muted">Payout</p>
                        <p className={cn(
                          'font-mono font-medium',
                          Number(position.profit ?? 0) > 0 ? 'text-primary' : 'text-no',
                        )}>
                          {formatXLM(position.payout)}
                        </p>
                      </div>
                    )}

                    {/* Claim button for winners */}
                    {isSettledWinner && (
                      <button
                        onClick={() => handleClaim(position)}
                        disabled={isClaiming}
                        className="btn-primary text-sm py-2 px-4 flex items-center gap-2 disabled:opacity-50"
                      >
                        {isClaiming ? (
                          <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Claiming...</>
                        ) : (
                          <>
                            <TrendingUp className="w-3.5 h-3.5" />
                            Claim Rewards
                          </>
                        )}
                      </button>
                    )}

                    {/* Settle loss button (updates reputation) */}
                    {isSettledLoser && (
                      <button
                        onClick={() => handleClaim(position)}
                        disabled={isClaiming}
                        className="text-sm py-2 px-4 rounded-lg border border-no/30 text-no flex items-center gap-2 hover:bg-no/10 disabled:opacity-50 transition-colors"
                      >
                        {isClaiming ? (
                          <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Recording...</>
                        ) : (
                          <>
                            <TrendingDown className="w-3.5 h-3.5" />
                            Settle Loss
                          </>
                        )}
                      </button>
                    )}

                    {position.status === 'CLAIMED' && (
                      <div className="flex items-center gap-1 text-primary text-xs">
                        <CheckCircle className="w-3.5 h-3.5" />
                        Claimed
                        {position.claimTxHash && (
                          <a
                            href={stellarExplorerUrl('tx', position.claimTxHash)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-1 opacity-70 hover:opacity-100"
                          >
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                      </div>
                    )}

                    {position.status === 'SETTLED' && (
                      <span className="text-xs text-muted">Settled</span>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}

          {(tab === 'active' ? active : settled).length === 0 && (
            <div className="text-center py-16 card-base">
              <p className="text-muted">
                {tab === 'active' ? 'No active positions' : 'No settled positions yet'}
              </p>
              {tab === 'active' && (
                <Link href="/markets" className="btn-primary mt-4 inline-flex text-sm">
                  Browse Markets
                </Link>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
