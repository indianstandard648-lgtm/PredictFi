'use client';

import { motion } from 'framer-motion';

interface Props {
  yesPercent: number;
  showLabels?: boolean;
  height?: number;
}

export function ProbabilityBar({ yesPercent, showLabels = true, height = 8 }: Props) {
  const noPercent = 100 - yesPercent;

  return (
    <div>
      {showLabels && (
        <div className="flex justify-between text-sm mb-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary" />
            <span className="text-primary font-semibold">{yesPercent.toFixed(1)}% YES</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-no font-semibold">{noPercent.toFixed(1)}% NO</span>
            <div className="w-2 h-2 rounded-full bg-no" />
          </div>
        </div>
      )}
      <div
        className="relative rounded-full overflow-hidden bg-accent"
        style={{ height }}
      >
        <motion.div
          className="absolute left-0 top-0 h-full bg-gradient-to-r from-primary to-primary/80 rounded-full"
          initial={{ width: '50%' }}
          animate={{ width: `${yesPercent}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
        <motion.div
          className="absolute right-0 top-0 h-full bg-gradient-to-l from-no to-no/80 rounded-full"
          initial={{ width: '50%' }}
          animate={{ width: `${noPercent}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}
