'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Trophy, TrendingUp, BarChart3, Star, Flame } from 'lucide-react';
import { fetchLeaderboard } from '@/lib/api';
import { LeaderboardEntry } from '@/types';
import { formatAddress, formatXLM, cn } from '@/lib/utils';

type Category = 'frs' | 'accuracy' | 'volume' | 'profit';

const CATEGORIES: Array<{ value: Category; label: string; icon: React.ElementType }> = [
  { value: 'frs', label: 'FRS Score', icon: Star },
  { value: 'accuracy', label: 'Accuracy', icon: Trophy },
  { value: 'volume', label: 'Volume', icon: TrendingUp },
  { value: 'profit', label: 'Profit', icon: BarChart3 },
];

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return (
    <div className="w-8 h-8 rounded-full bg-yellow-500/20 text-yellow-500 flex items-center justify-center">
      <Trophy className="w-4 h-4" />
    </div>
  );
  if (rank === 2) return (
    <div className="w-8 h-8 rounded-full bg-gray-300/20 text-gray-300 flex items-center justify-center">
      <Trophy className="w-4 h-4" />
    </div>
  );
  if (rank === 3) return (
    <div className="w-8 h-8 rounded-full bg-amber-600/20 text-amber-600 flex items-center justify-center">
      <Trophy className="w-4 h-4" />
    </div>
  );
  return (
    <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-muted text-sm font-bold">
      {rank}
    </div>
  );
}

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [category, setCategory] = useState<Category>('frs');
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const limit = 25;

  useEffect(() => {
    setIsLoading(true);
    fetchLeaderboard({ page, limit, category })
      .then(({ entries: e, total: t }) => { setEntries(e); setTotal(t); })
      .finally(() => setIsLoading(false));
  }, [category, page]);

  useEffect(() => { setPage(1); }, [category]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Leaderboard</h1>
        <p className="text-muted">The most accurate forecasters on PredictFi</p>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {CATEGORIES.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            onClick={() => setCategory(value)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all',
              category === value
                ? 'bg-primary text-background'
                : 'bg-accent text-muted hover:text-white',
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card-base overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-5 py-4 text-xs text-muted font-medium">Rank</th>
              <th className="px-5 py-4 text-xs text-muted font-medium">Predictor</th>
              <th className="px-5 py-4 text-xs text-muted font-medium text-right">FRS</th>
              <th className="px-5 py-4 text-xs text-muted font-medium text-right hidden sm:table-cell">
                Win Rate
              </th>
              <th className="px-5 py-4 text-xs text-muted font-medium text-right hidden md:table-cell">
                Markets
              </th>
              <th className="px-5 py-4 text-xs text-muted font-medium text-right hidden lg:table-cell">
                Volume
              </th>
              <th className="px-5 py-4 text-xs text-muted font-medium text-right hidden lg:table-cell">
                Streak
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 10 }).map((_, i) => (
                <tr key={i} className="border-b border-border">
                  <td colSpan={7} className="px-5 py-4">
                    <div className="h-5 bg-accent rounded animate-pulse" />
                  </td>
                </tr>
              ))
            ) : entries.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-16 text-muted">
                  No predictors yet. Be the first!
                </td>
              </tr>
            ) : (
              entries.map((entry, i) => (
                <motion.tr
                  key={entry.userId}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.02 }}
                  className="border-b border-border hover:bg-accent/30 transition-colors"
                >
                  <td className="px-5 py-4">
                    <RankBadge rank={entry.rank} />
                  </td>
                  <td className="px-5 py-4">
                    <Link
                      href={`/profile/${entry.walletAddress}`}
                      className="hover:text-primary transition-colors"
                    >
                      <div className="font-medium">
                        {entry.username ?? formatAddress(entry.walletAddress)}
                      </div>
                      {entry.username && (
                        <div className="text-xs text-muted font-mono">
                          {formatAddress(entry.walletAddress)}
                        </div>
                      )}
                    </Link>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <span className="font-mono font-bold text-primary">
                      {entry.reputationScore.toFixed(1)}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right hidden sm:table-cell">
                    <span className={cn(
                      'font-mono text-sm',
                      entry.winRate >= 60 ? 'text-primary' :
                      entry.winRate >= 40 ? 'text-white' : 'text-no'
                    )}>
                      {entry.winRate.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right hidden md:table-cell font-mono text-sm">
                    {entry.totalPredictions}
                  </td>
                  <td className="px-5 py-4 text-right hidden lg:table-cell font-mono text-sm">
                    {formatXLM(entry.totalVolume)}
                  </td>
                  <td className="px-5 py-4 text-right hidden lg:table-cell">
                    {entry.streak > 0 && (
                      <span className="flex items-center justify-end gap-1 text-warning text-sm">
                        <Flame className="w-3.5 h-3.5" />
                        {entry.streak}
                      </span>
                    )}
                  </td>
                </motion.tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="btn-outline px-4 py-2 text-sm disabled:opacity-30"
          >
            ← Prev
          </button>
          <span className="flex items-center px-4 text-sm text-muted">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="btn-outline px-4 py-2 text-sm disabled:opacity-30"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
