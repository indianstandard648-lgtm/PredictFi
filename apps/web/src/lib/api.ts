import axios, { AxiosInstance } from 'axios';
import {
  Market, Position, Reputation, LeaderboardEntry, PlatformStats, User,
} from '@/types';

const _RAW_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const BASE_URL = _RAW_URL.endsWith('/api/v1') ? _RAW_URL : `${_RAW_URL}/api/v1`;

function createClient(walletAddress?: string): AxiosInstance {
  return axios.create({
    baseURL: BASE_URL,
    headers: {
      'Content-Type': 'application/json',
      ...(walletAddress ? { 'x-wallet-address': walletAddress } : {}),
    },
  });
}

// ─── Markets ──────────────────────────────────────────────────────────────────

export async function fetchMarkets(params?: {
  status?: string;
  category?: string;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: string;
}): Promise<{ markets: Market[]; total: number }> {
  const { data } = await createClient().get('/markets', { params });
  return data;
}

export async function fetchMarket(id: string): Promise<Market> {
  const { data } = await createClient().get(`/markets/${id}`);
  return data;
}

export async function fetchTrendingMarkets(limit = 10): Promise<Market[]> {
  const { data } = await createClient().get('/markets/trending', { params: { limit } });
  return data;
}

export async function fetchMarketStats(): Promise<PlatformStats> {
  const { data } = await createClient().get('/markets/stats');
  return data;
}

export async function createMarket(
  walletAddress: string,
  payload: {
    title: string;
    description: string;
    category: string;
    endDate: string;
    resolutionDate: string;
    oracleSource?: string;
    imageUrl?: string;
    tags?: string[];
    onchainId?: number;
    txHash?: string;
    oracleAddress?: string;
  },
): Promise<Market> {
  const { data } = await createClient(walletAddress).post('/markets', payload);
  return data;
}

// ─── Positions ────────────────────────────────────────────────────────────────

export async function buyPosition(
  walletAddress: string,
  payload: {
    marketId: string;
    side: 'YES' | 'NO';
    amountUsdc: number;
    txHash: string;
  },
): Promise<{ position: Position; shares: number; entryProbability: number }> {
  const { data } = await createClient(walletAddress).post('/positions/buy', payload);
  return data;
}

export async function fetchUserPositions(
  walletAddress: string,
  marketId?: string,
): Promise<Position[]> {
  const { data } = await createClient(walletAddress).get('/positions', {
    params: marketId ? { marketId } : undefined,
  });
  return data;
}

export async function claimReward(
  walletAddress: string,
  positionId: string,
  txHash: string,
): Promise<{ won: boolean; payout: number; profit?: number }> {
  const { data } = await createClient(walletAddress).post(
    `/positions/${positionId}/claim`,
    { txHash },
  );
  return data;
}

export async function fetchPortfolioStats(walletAddress: string) {
  const { data } = await createClient(walletAddress).get('/positions/portfolio/stats');
  return data;
}

// ─── Reputation ───────────────────────────────────────────────────────────────

export async function fetchReputation(walletAddress: string): Promise<Reputation | null> {
  const { data } = await createClient().get(`/reputation/${walletAddress}`);
  return data;
}

// ─── Leaderboard ──────────────────────────────────────────────────────────────

export async function fetchLeaderboard(params?: {
  page?: number;
  limit?: number;
  category?: string;
}): Promise<{ entries: LeaderboardEntry[]; total: number }> {
  const { data } = await createClient().get('/leaderboard', { params });
  return data;
}

export async function fetchTopPredictors(limit = 5): Promise<LeaderboardEntry[]> {
  const { data } = await createClient().get('/leaderboard/top', { params: { limit } });
  return data;
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function authUser(walletAddress: string): Promise<User> {
  const { data } = await createClient(walletAddress).post('/users/auth');
  return data;
}

export async function fetchProfile(walletAddress: string): Promise<User & {
  reputation: Reputation | null;
  positions: Array<Position & { market?: Pick<Market, 'id' | 'title' | 'status'> }>;
  markets?: Array<Pick<Market, 'id' | 'title' | 'status' | 'createdAt'>>;
}> {
  const { data } = await createClient().get(`/users/${walletAddress}/profile`);
  return data;
}

export async function updateProfile(
  walletAddress: string,
  payload: { username?: string; bio?: string; twitterHandle?: string; avatarUrl?: string },
): Promise<User> {
  const { data } = await createClient(walletAddress).put('/users/me', payload);
  return data;
}

// ─── Market Actions ───────────────────────────────────────────────────────────

export async function resolveMarket(
  walletAddress: string,
  marketId: string,
  payload: { outcome: 'YES' | 'NO'; evidenceUrl?: string; txHash?: string },
): Promise<{ success: boolean; message: string }> {
  const { data } = await createClient(walletAddress).post(`/markets/${marketId}/resolve`, payload);
  return data;
}

export async function lockMarket(
  walletAddress: string,
  marketId: string,
): Promise<{ success: boolean; message: string }> {
  const { data } = await createClient(walletAddress).post(`/markets/${marketId}/lock`);
  return data;
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export async function fetchAnalytics(): Promise<PlatformStats> {
  const { data } = await createClient().get('/analytics/overview');
  return data;
}
