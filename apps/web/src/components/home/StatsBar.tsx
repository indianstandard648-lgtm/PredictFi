'use client';

import { motion } from 'framer-motion';
import { PlatformStats } from '@/types';
import { formatUSDC } from '@/lib/utils';

interface Props {
  stats: PlatformStats;
}

export function StatsBar({ stats }: Props) {
  const items = [
    { label: 'Total Markets', value: stats.totalMarkets.toLocaleString() },
    { label: 'Open Markets', value: stats.openMarkets.toLocaleString() },
    { label: 'Volume Traded', value: formatUSDC(stats.totalVolume) },
    { label: 'Predictors', value: stats.totalUsers.toLocaleString() },
    { label: 'Total Positions', value: stats.totalPositions.toLocaleString() },
  ];

  return (
    <section className="border-y border-border bg-card/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          {items.map(({ label, value }, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="flex flex-col items-center py-6 px-4 border-r border-border last:border-r-0"
            >
              <span className="text-2xl font-bold font-mono text-white">{value}</span>
              <span className="text-xs text-muted mt-1">{label}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
