import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatDistanceToNow, format, isPast } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatUSDC(amount: string | number, decimals = 2): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '$0.00';
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `$${(num / 1_000).toFixed(1)}K`;
  return `$${num.toFixed(decimals)}`;
}

export function formatXLM(amount: string | number, decimals = 2): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '0.00 XLM';
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M XLM`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K XLM`;
  return `${num.toFixed(decimals)} XLM`;
}

export function formatProbability(prob: number): string {
  return `${prob.toFixed(1)}%`;
}

export function formatAddress(address: string, chars = 4): string {
  if (!address) return '';
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

export function timeUntil(date: string): string {
  const d = new Date(date);
  if (isPast(d)) return 'Ended';
  return formatDistanceToNow(d, { addSuffix: true });
}

export function formatDate(date: string): string {
  return format(new Date(date), 'MMM d, yyyy');
}

export function formatDateTime(date: string): string {
  return format(new Date(date), 'MMM d, yyyy HH:mm');
}

export function categoryColor(category: string): string {
  const colors: Record<string, string> = {
    CRYPTO: 'text-yellow-400 bg-yellow-400/10',
    POLITICS: 'text-red-400 bg-red-400/10',
    SPORTS: 'text-green-400 bg-green-400/10',
    FINANCE: 'text-blue-400 bg-blue-400/10',
    TECH: 'text-purple-400 bg-purple-400/10',
    SCIENCE: 'text-cyan-400 bg-cyan-400/10',
    ENTERTAINMENT: 'text-pink-400 bg-pink-400/10',
    WORLD_EVENTS: 'text-orange-400 bg-orange-400/10',
    OTHER: 'text-gray-400 bg-gray-400/10',
  };
  return colors[category] ?? colors.OTHER;
}

export function statusColor(status: string): string {
  const colors: Record<string, string> = {
    OPEN: 'text-primary bg-primary/10',
    LOCKED: 'text-warning bg-warning/10',
    RESOLVED: 'text-muted bg-muted/10',
    CANCELLED: 'text-no bg-no/10',
  };
  return colors[status] ?? '';
}

export function clampProbability(value: number): number {
  return Math.min(99, Math.max(1, value));
}

export function calculateShares(
  yesPool: number,
  noPool: number,
  side: 'YES' | 'NO',
  amount: number,
): { shares: number; newProbability: number } {
  const total = yesPool + noPool;
  if (total === 0) {
    return { shares: amount, newProbability: 50 };
  }
  const sidePool = side === 'YES' ? yesPool : noPool;
  const probability = (sidePool / total) * 100;
  const effectiveProb = probability === 0 ? 1 : probability;
  const shares = (amount * 100) / effectiveProb;
  const newSidePool = sidePool + amount;
  const newTotal = total + amount;
  const newProb = (newSidePool / newTotal) * 100;
  return { shares, newProbability: newProb };
}

export function calculatePotentialPayout(
  userShares: number,
  totalWinningShares: number,
  totalPool: number,
  feeBps = 200,
): number {
  if (totalWinningShares === 0) return 0;
  const gross = (userShares / totalWinningShares) * totalPool;
  const fee = (gross * feeBps) / 10000;
  return gross - fee;
}
