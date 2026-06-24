'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { TrendingUp, TrendingDown, Clock, CheckCircle, XCircle, Wallet } from 'lucide-react';
import { fetchUserPositions, fetchPortfolioStats, claimReward } from '@/lib/api';
import { useWalletStore } from '@/stores/walletStore';
import { Position } from '@/types';
import { formatUSDC, formatDate, cn } from '@/lib/utils';
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

  useEffect(() => {
    if (!address) { setIsLoading(false); return; }
    Promise.all([
      fetchUserPositions(address),
      fetchPortfolioStats(address),
    ]).then(([pos, st]) => {
      setPositions(pos);
      setStats(st);
    }).finally(() => setIsLoading(false));
  }, [address]);

  async function handleClaim(position: Position) {
    if (!address) return;
    try {
      const result = await claimReward(address, position.id, 'pending-tx');
      if (result.won) {
        toast.success(`Claimed ${formatUSDC(result.payout)}!`);
      } else {
        toast('Position settled. Better luck next time.', { icon: '📉' });
      }
      const updated = await fetchUserPositions(address);
      setPositions(updated);
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Claim failed');
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
            { label: 'Invested', value: formatUSDC(stats.totalInvested) },
            { label: 'Payout', value: formatUSDC(stats.totalPayout) },
            {
              label: 'P&L',
              value: formatUSDC(Math.abs(stats.totalProfit)),
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
          {(tab === 'active' ? active : settled).map((position, i) => (
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
                    {position.market?.title ?? 'Market'}
                  </Link>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted">
                    <span className={position.side === 'YES' ? 'text-primary font-medium' : 'text-no font-medium'}>
                      {position.side}
                    </span>
                    <span>•</span>
                    <span>{formatDate(position.createdAt)}</span>
                    <span>•</span>
                    <span>{parseFloat(position.sharesOwned).toFixed(2)} shares</span>
                  </div>
                </div>

                <div className="flex items-center gap-6 text-right">
                  <div>
                    <p className="text-xs text-muted">Invested</p>
                    <p className="font-mono font-medium">{formatUSDC(position.amountUsdc)}</p>
                  </div>

                  {position.status === 'ACTIVE' ? (
                    <div>
                      <p className="text-xs text-muted">Entry Prob</p>
                      <p className="font-mono">{parseFloat(position.entryProbability).toFixed(1)}%</p>
                    </div>
                  ) : position.payout ? (
                    <div>
                      <p className="text-xs text-muted">Payout</p>
                      <p className={cn(
                        'font-mono font-medium',
                        (position.profit ?? 0) > 0 ? 'text-primary' : 'text-no'
                      )}>
                        {formatUSDC(position.payout)}
                      </p>
                    </div>
                  ) : null}

                  {position.status === 'ACTIVE' && position.market?.status === 'RESOLVED' && (
                    <button
                      onClick={() => handleClaim(position)}
                      className="btn-primary text-sm py-2 px-4"
                    >
                      Claim
                    </button>
                  )}

                  {position.status === 'CLAIMED' && (
                    <div className="flex items-center gap-1 text-primary text-xs">
                      <CheckCircle className="w-3.5 h-3.5" />
                      Claimed
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}

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
