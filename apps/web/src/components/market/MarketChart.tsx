'use client';

import { useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { format } from 'date-fns';
import { PriceSnapshot } from '@/types';

interface Props {
  snapshots: PriceSnapshot[];
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; name: string }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-xl text-sm">
      <p className="text-muted mb-1">{label}</p>
      <p className="text-primary font-medium">
        YES: {payload[0]?.value?.toFixed(1)}%
      </p>
      <p className="text-no font-medium">
        NO: {(100 - (payload[0]?.value ?? 50)).toFixed(1)}%
      </p>
    </div>
  );
}

export function MarketChart({ snapshots }: Props) {
  const data = useMemo(() => {
    if (!snapshots.length) {
      return [
        { time: 'Start', yes: 50 },
        { time: 'Now', yes: 50 },
      ];
    }
    return snapshots.map((s) => ({
      time: format(new Date(s.recordedAt), 'MMM d HH:mm'),
      yes: Number(s.probabilityYes),
    }));
  }, [snapshots]);

  return (
    <div className="card-base p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-sm text-muted uppercase tracking-wider">
          Probability History
        </h3>
        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-primary inline-block rounded" />
            YES
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-no inline-block rounded" />
            NO
          </span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
          <defs>
            <linearGradient id="yesGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#00D4AA" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#00D4AA" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
          <XAxis
            dataKey="time"
            tick={{ fill: '#666', fontSize: 10 }}
            axisLine={{ stroke: '#1a1a1a' }}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fill: '#666', fontSize: 10 }}
            axisLine={{ stroke: '#1a1a1a' }}
            tickLine={false}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={50} stroke="#2a2a2a" strokeDasharray="4 4" />
          <Area
            type="monotone"
            dataKey="yes"
            stroke="#00D4AA"
            strokeWidth={2}
            fill="url(#yesGradient)"
            dot={false}
            activeDot={{ r: 4, fill: '#00D4AA' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
