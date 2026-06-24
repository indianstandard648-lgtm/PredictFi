import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import Decimal from 'decimal.js';

@Injectable()
export class ReputationService {
  constructor(private prisma: PrismaService) {}

  async updateAfterSettlement(
    userId: string,
    wasCorrect: boolean,
    volumeUsdc: Decimal,
    profitUsdc: Decimal,
  ): Promise<void> {
    const existing = await this.prisma.reputation.findUnique({ where: { userId } });

    const totalPredictions = (existing?.totalPredictions ?? 0) + 1;
    const correct = (existing?.correctPredictions ?? 0) + (wasCorrect ? 1 : 0);
    const totalVolume = new Decimal(existing?.totalVolume ?? 0).plus(volumeUsdc);
    const totalProfit = new Decimal(existing?.totalProfit ?? 0).plus(profitUsdc);
    const accuracy = new Decimal(correct).div(totalPredictions).mul(100);
    const winRate = accuracy;

    let streak = existing?.streak ?? 0;
    let bestStreak = existing?.bestStreak ?? 0;
    if (wasCorrect) {
      streak += 1;
      if (streak > bestStreak) bestStreak = streak;
    } else {
      streak = 0;
    }

    const frs = this.computeFRS({
      accuracy: accuracy.toNumber(),
      totalVolume: totalVolume.toNumber(),
      totalProfit: totalProfit.toNumber(),
      totalPredictions,
      bestStreak,
    });

    await this.prisma.reputation.upsert({
      where: { userId },
      create: {
        userId,
        totalPredictions,
        correctPredictions: correct,
        totalVolume,
        totalProfit,
        accuracy,
        winRate,
        reputationScore: new Decimal(frs),
        streak,
        bestStreak,
      },
      update: {
        totalPredictions,
        correctPredictions: correct,
        totalVolume,
        totalProfit,
        accuracy,
        winRate,
        reputationScore: new Decimal(frs),
        streak,
        bestStreak,
      },
    });

    await this.refreshLeaderboardRanks();
  }

  async getReputation(walletAddress: string) {
    const user = await this.prisma.user.findUnique({
      where: { walletAddress },
      include: { reputation: true },
    });
    return user?.reputation ?? null;
  }

  async refreshLeaderboardRanks(): Promise<void> {
    const reputations = await this.prisma.reputation.findMany({
      orderBy: { reputationScore: 'desc' },
    });

    await Promise.all(
      reputations.map((rep, idx) =>
        this.prisma.reputation.update({
          where: { id: rep.id },
          data: { rank: idx + 1 },
        }),
      ),
    );
  }

  private computeFRS(data: {
    accuracy: number;
    totalVolume: number;
    totalProfit: number;
    totalPredictions: number;
    bestStreak: number;
  }): number {
    const { accuracy, totalVolume, totalProfit, totalPredictions, bestStreak } = data;

    // Normalize accuracy: 0-100
    const accuracyScore = Math.min(accuracy, 100);

    // Volume score: logarithmic, 0-100 (capped at 1M USDC)
    const volumeScore = totalVolume <= 0
      ? 0
      : Math.min(Math.log10(totalVolume + 1) * 20, 100);

    // Profitability: 0-100
    const roi = totalVolume > 0 ? (totalProfit / totalVolume) * 100 : 0;
    const profitScore = Math.max(0, Math.min(roi, 100));

    // Consistency: streak + prediction count bonus
    const streakBonus = Math.min(bestStreak * 5, 50);
    const countBonus = Math.min(totalPredictions * 2, 50);
    const consistencyScore = Math.min(streakBonus + countBonus, 100);

    // Weighted FRS
    const frs =
      accuracyScore * 0.4 +
      volumeScore * 0.2 +
      profitScore * 0.2 +
      consistencyScore * 0.2;

    return Math.round(frs * 100) / 100;
  }
}
