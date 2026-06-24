import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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

@Injectable()
export class LeaderboardService {
  constructor(private prisma: PrismaService) {}

  async getLeaderboard(
    page = 1,
    limit = 50,
    category?: 'frs' | 'accuracy' | 'volume' | 'profit',
  ): Promise<{ entries: LeaderboardEntry[]; total: number }> {
    const orderByMap = {
      frs: { reputationScore: 'desc' as const },
      accuracy: { accuracy: 'desc' as const },
      volume: { totalVolume: 'desc' as const },
      profit: { totalProfit: 'desc' as const },
    };

    const orderBy = orderByMap[category ?? 'frs'];

    const [reputations, total] = await Promise.all([
      this.prisma.reputation.findMany({
        where: { totalPredictions: { gt: 0 } },
        include: {
          user: { select: { id: true, walletAddress: true, username: true } },
        },
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.reputation.count({ where: { totalPredictions: { gt: 0 } } }),
    ]);

    const entries: LeaderboardEntry[] = reputations.map((rep, idx) => ({
      rank: rep.rank ?? (page - 1) * limit + idx + 1,
      userId: rep.userId,
      walletAddress: rep.user.walletAddress,
      username: rep.user.username,
      reputationScore: Number(rep.reputationScore),
      accuracy: Number(rep.accuracy),
      totalPredictions: rep.totalPredictions,
      winRate: Number(rep.winRate),
      totalProfit: Number(rep.totalProfit),
      totalVolume: Number(rep.totalVolume),
      streak: rep.streak,
    }));

    return { entries, total };
  }

  async getUserRank(walletAddress: string): Promise<{ rank: number | null; total: number }> {
    const user = await this.prisma.user.findUnique({
      where: { walletAddress },
      include: { reputation: true },
    });

    const total = await this.prisma.reputation.count({ where: { totalPredictions: { gt: 0 } } });

    return { rank: user?.reputation?.rank ?? null, total };
  }

  async getTopPredictors(limit = 5): Promise<LeaderboardEntry[]> {
    const { entries } = await this.getLeaderboard(1, limit, 'frs');
    return entries;
  }
}
