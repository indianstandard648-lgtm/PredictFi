export type MarketStatus = 'OPEN' | 'LOCKED' | 'RESOLVED' | 'CANCELLED';
export type MarketCategory =
  | 'CRYPTO' | 'POLITICS' | 'SPORTS' | 'FINANCE'
  | 'TECH' | 'SCIENCE' | 'ENTERTAINMENT' | 'WORLD_EVENTS' | 'OTHER';
export type PositionSide = 'YES' | 'NO';
export type PositionStatus = 'ACTIVE' | 'SETTLED' | 'CLAIMED' | 'REFUNDED';
export type ResolutionOutcome = 'YES' | 'NO' | 'CANCELLED';

export interface User {
  id: string;
  walletAddress: string;
  username: string | null;
  avatarUrl: string | null;
  bio: string | null;
  twitterHandle: string | null;
  createdAt: string;
}

export interface Market {
  id: string;
  contractId?: string;
  onchainId?: number;
  title: string;
  description: string;
  category: MarketCategory;
  status: MarketStatus;
  creator: Pick<User, 'id' | 'walletAddress' | 'username'>;
  oracleSource: string;
  endDate: string;
  resolutionDate: string;
  totalVolume: string;
  yesPool: string;
  noPool: string;
  yesShares: string;
  noShares: string;
  imageUrl?: string;
  tags: string[];
  featured: boolean;
  createdAt: string;
  // Computed
  probabilityYes: number;
  probabilityNo: number;
  participantCount: number;
  resolution?: Resolution;
  priceHistory?: PriceSnapshot[];
}

export interface Position {
  id: string;
  userId: string;
  marketId: string;
  market: Pick<Market, 'id' | 'title' | 'status'>;
  side: PositionSide;
  status: PositionStatus;
  amountUsdc: string;
  sharesOwned: string;
  entryProbability: string;
  payout?: string;
  profit?: string;
  txHash?: string;
  claimTxHash?: string;
  createdAt: string;
  // Computed
  currentValue?: number;
  unrealizedPnL?: number;
  currentProbability?: number;
}

export interface Resolution {
  id: string;
  marketId: string;
  outcome: ResolutionOutcome;
  resolver: Pick<User, 'id' | 'walletAddress' | 'username'>;
  evidenceUrl?: string;
  notes?: string;
  resolvedAt: string;
}

export interface Reputation {
  id: string;
  userId: string;
  totalPredictions: number;
  correctPredictions: number;
  totalVolume: string;
  totalProfit: string;
  winRate: string;
  accuracy: string;
  reputationScore: string;
  streak: number;
  bestStreak: number;
  rank?: number;
}

export interface PriceSnapshot {
  id: string;
  marketId: string;
  probabilityYes: number;
  probabilityNo: number;
  yesPool: string;
  noPool: string;
  volume: string;
  recordedAt: string;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  walletAddress: string;
  username: string | null;
  reputationScore: number;
  accuracy: number;
  totalPredictions: number;
  winRate: number;
  totalProfit: number;
  totalVolume: number;
  streak: number;
}

export interface PlatformStats {
  totalMarkets: number;
  openMarkets: number;
  resolvedMarkets: number;
  totalVolume: number;
  totalPositions: number;
  totalUsers: number;
}
