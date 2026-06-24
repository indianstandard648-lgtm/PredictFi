'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Trophy, TrendingUp } from 'lucide-react';
import { LeaderboardEntry } from '@/types';
import { formatAddress, formatUSDC } from '@/lib/utils';

interface Props {
  predictors: LeaderboardEntry[];
}

export function TopPredictors({ predictors }: Props) {
  return (
    <section className="py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold">Top Predictors</h2>
            <p className="text-muted text-sm mt-1">Ranked by Forecast Reputation Score</p>
          </div>
          <Link href="/leaderboard" className="text-primary text-sm hover:underline">
            View full leaderboard →
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {predictors.map((predictor, i) => (
            <motion.div
              key={predictor.userId}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
            >
              <Link href={`/profile/${predictor.walletAddress}`}>
                <div className="card-hover p-5 text-center">
                  {/* Rank */}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-3 ${
                    i === 0 ? 'bg-yellow-500/20 text-yellow-500' :
                    i === 1 ? 'bg-gray-300/20 text-gray-300' :
                    i === 2 ? 'bg-amber-600/20 text-amber-600' :
                    'bg-accent text-muted'
                  }`}>
                    {i < 3 ? <Trophy className="w-5 h-5" /> : (
                      <span className="font-bold text-sm">#{i + 1}</span>
                    )}
                  </div>

                  {/* Identity */}
                  <p className="font-semibold text-sm truncate">
                    {predictor.username ?? formatAddress(predictor.walletAddress)}
                  </p>

                  {/* FRS Score */}
                  <p className="text-2xl font-bold text-primary mt-2 font-mono">
                    {predictor.reputationScore.toFixed(0)}
                  </p>
                  <p className="text-xs text-muted">FRS Score</p>

                  {/* Stats */}
                  <div className="mt-3 pt-3 border-t border-border space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted">Win Rate</span>
                      <span className="text-primary font-medium">
                        {predictor.winRate.toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted">Volume</span>
                      <span>{formatUSDC(predictor.totalVolume)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted">Markets</span>
                      <span>{predictor.totalPredictions}</span>
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
