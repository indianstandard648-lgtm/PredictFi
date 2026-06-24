'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Clock, Users, TrendingUp, ArrowRight } from 'lucide-react';
import { Market } from '@/types';
import { categoryColor, formatUSDC, timeUntil, cn } from '@/lib/utils';

interface Props {
  market: Market;
  index?: number;
}

export function MarketCard({ market, index = 0 }: Props) {
  const {
    id, title, category, status, probabilityYes, probabilityNo,
    totalVolume, endDate, participantCount, tags,
  } = market;

  const isResolved = status === 'RESOLVED';
  const isLocked = status === 'LOCKED';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
    >
      <Link href={`/markets/${id}`} className="block group">
        <div className="card-hover p-5 h-full flex flex-col gap-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <span className={cn('tag text-xs', categoryColor(category))}>
                  {category.replace('_', ' ')}
                </span>
                {status !== 'OPEN' && (
                  <span className={cn(
                    'tag text-xs',
                    isResolved ? 'bg-muted/10 text-muted' :
                    isLocked ? 'bg-warning/10 text-warning' :
                    'bg-no/10 text-no'
                  )}>
                    {status}
                  </span>
                )}
              </div>
              <h3 className="font-semibold text-white line-clamp-2 group-hover:text-primary transition-colors">
                {title}
              </h3>
            </div>
            <ArrowRight className="w-5 h-5 text-muted group-hover:text-primary group-hover:translate-x-1 transition-all flex-shrink-0 mt-1" />
          </div>

          {/* Probability Bar */}
          <div>
            <div className="flex justify-between text-sm mb-1.5">
              <span className="text-primary font-medium">YES {probabilityYes.toFixed(1)}%</span>
              <span className="text-no font-medium">NO {probabilityNo.toFixed(1)}%</span>
            </div>
            <div className="probability-bar">
              <motion.div
                className="h-full bg-primary rounded-full"
                initial={{ width: '50%' }}
                animate={{ width: `${probabilityYes}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center justify-between text-xs text-muted mt-auto">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5" />
                {formatUSDC(totalVolume)}
              </span>
              <span className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5" />
                {participantCount}
              </span>
            </div>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {timeUntil(endDate)}
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
