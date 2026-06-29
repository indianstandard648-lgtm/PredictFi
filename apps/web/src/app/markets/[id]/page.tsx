'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { notFound } from 'next/navigation';
import { fetchMarket } from '@/lib/api';
import { MarketChart } from '@/components/market/MarketChart';
import { TradingPanel } from '@/components/market/TradingPanel';
import { ProbabilityBar } from '@/components/market/ProbabilityBar';
import { ResolvePanel } from '@/components/market/ResolvePanel';
import { categoryColor, formatXLM, formatDateTime, timeUntil, cn } from '@/lib/utils';
import { Clock, Users, TrendingUp, CheckCircle, XCircle, Lock, ExternalLink, RefreshCw } from 'lucide-react';
import { Market } from '@/types';

interface Props {
  params: Promise<{ id: string }>;
}

export default function MarketDetailPage({ params }: Props) {
  const { id } = use(params);
  const [market, setMarket] = useState<Market | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setIsLoading(true);
    else setRefreshing(true);
    try {
      const m = await fetchMarket(id);
      setMarket(m);
    } catch {
      setMarket(null);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 15 seconds for live data
  useEffect(() => {
    const interval = setInterval(() => load(true), 15_000);
    return () => clearInterval(interval);
  }, [load]);

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card-base p-6 h-48 animate-pulse" />
            ))}
          </div>
          <div className="card-base p-5 h-64 animate-pulse" />
        </div>
      </div>
    );
  }

  if (!market) return notFound();

  const isResolved = market.status === 'RESOLVED';
  const resolution = market.resolution;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Header */}
          <div className="card-base p-6">
            <div className="flex items-start gap-3 mb-4">
              <span className={cn('tag', categoryColor(market.category))}>
                {market.category.replace('_', ' ')}
              </span>
              {market.status !== 'OPEN' && (
                <span className={cn(
                  'tag',
                  market.status === 'RESOLVED' ? 'bg-muted/10 text-muted' :
                  market.status === 'LOCKED' ? 'bg-warning/10 text-warning' :
                  'bg-no/10 text-no',
                )}>
                  {market.status === 'LOCKED' && <Lock className="w-3 h-3 inline mr-1" />}
                  {market.status}
                </span>
              )}
              <button
                onClick={() => load(true)}
                disabled={refreshing}
                className="ml-auto text-muted hover:text-white transition-colors"
                title="Refresh market data"
              >
                <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
              </button>
            </div>

            <h1 className="text-2xl font-bold mb-4">{market.title}</h1>
            <p className="text-muted text-sm leading-relaxed">{market.description}</p>

            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-border">
              <div>
                <p className="text-xs text-muted mb-1">Volume</p>
                <p className="font-bold font-mono">{formatXLM(market.totalVolume)}</p>
              </div>
              <div>
                <p className="text-xs text-muted mb-1">Traders</p>
                <p className="font-bold font-mono">{market.participantCount}</p>
              </div>
              <div>
                <p className="text-xs text-muted mb-1">Closes</p>
                <p className="font-bold font-mono text-sm">{timeUntil(market.endDate)}</p>
              </div>
            </div>
          </div>

          {/* Probability */}
          <div className="card-base p-6">
            <h3 className="text-sm font-semibold text-muted uppercase tracking-wider mb-4">
              Current Probability
            </h3>
            <ProbabilityBar yesPercent={market.probabilityYes} />

            <div className="grid grid-cols-2 gap-4 mt-6">
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
                <p className="text-xs text-muted mb-1">YES Pool</p>
                <p className="text-xl font-bold text-primary font-mono">
                  {formatXLM(market.yesPool)}
                </p>
              </div>
              <div className="bg-no/5 border border-no/20 rounded-xl p-4">
                <p className="text-xs text-muted mb-1">NO Pool</p>
                <p className="text-xl font-bold text-no font-mono">
                  {formatXLM(market.noPool)}
                </p>
              </div>
            </div>
          </div>

          {/* Chart */}
          <MarketChart snapshots={market.priceHistory ?? []} />

          {/* Resolution */}
          {isResolved && resolution && (
            <div className={cn(
              'card-base p-6 border-2',
              resolution.outcome === 'YES' ? 'border-primary/30' : 'border-no/30',
            )}>
              <div className="flex items-center gap-3 mb-3">
                {resolution.outcome === 'YES'
                  ? <CheckCircle className="w-6 h-6 text-primary" />
                  : <XCircle className="w-6 h-6 text-no" />
                }
                <h3 className="font-bold text-lg">
                  Resolved:{' '}
                  <span className={resolution.outcome === 'YES' ? 'text-primary' : 'text-no'}>
                    {resolution.outcome}
                  </span>
                </h3>
              </div>
              <p className="text-sm text-muted">
                Resolved by {resolution.resolver?.username ?? resolution.resolver?.walletAddress} on{' '}
                {formatDateTime(resolution.resolvedAt)}
              </p>
              {resolution.evidenceUrl && (
                <a
                  href={resolution.evidenceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-primary text-sm mt-3 hover:underline"
                >
                  View Evidence <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          )}

          {/* Market Info */}
          <div className="card-base p-6">
            <h3 className="text-sm font-semibold text-muted uppercase tracking-wider mb-4">
              Market Details
            </h3>
            <div className="space-y-3 text-sm">
              {[
                ['Created by', market.creator?.username ?? market.creator?.walletAddress ?? '—'],
                ['Oracle', market.oracleSource],
                ['End Date', formatDateTime(market.endDate)],
                ['Resolution Date', formatDateTime(market.resolutionDate)],
                ['Market ID', market.id],
                ...(market.onchainId ? [['On-Chain ID', `#${market.onchainId}`]] : []),
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between">
                  <span className="text-muted">{label}</span>
                  <span className="font-mono text-right max-w-xs truncate">{value}</span>
                </div>
              ))}
            </div>

            {market.tags && market.tags.length > 0 && (
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-xs text-muted mb-2">Tags</p>
                <div className="flex flex-wrap gap-2">
                  {market.tags.map((tag) => (
                    <span key={tag} className="tag bg-accent text-muted">{tag}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1">
          <div className="sticky top-24 space-y-4">
            <TradingPanel market={market} />
            <ResolvePanel market={market} onResolved={() => load(true)} />
          </div>
        </div>
      </div>
    </div>
  );
}
