import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { MarketStatus } from '@prisma/client';
import Decimal from 'decimal.js';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async getPlatformOverview() {
    const [
      totalMarkets, openMarkets, resolvedMarkets,
      volumeAgg, positionCount, userCount,
    ] = await Promise.all([
      this.prisma.market.count(),
      this.prisma.market.count({ where: { status: MarketStatus.OPEN } }),
      this.prisma.market.count({ where: { status: MarketStatus.RESOLVED } }),
      this.prisma.market.aggregate({ _sum: { totalVolume: true } }),
      this.prisma.position.count(),
      this.prisma.user.count(),
    ]);

    const totalVolume = volumeAgg._sum.totalVolume ?? new Decimal(0);

    return {
      totalMarkets,
      openMarkets,
      resolvedMarkets,
      totalVolume: totalVolume.toNumber(),
      totalPositions: positionCount,
      totalUsers: userCount,
    };
  }

  async getVolumeHistory(days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const snapshots = await this.prisma.priceSnapshot.groupBy({
      by: ['recordedAt'],
      _sum: { volume: true },
      where: { recordedAt: { gte: startDate } },
      orderBy: { recordedAt: 'asc' },
    });

    return snapshots.map((s) => ({
      date: s.recordedAt,
      volume: Number(s._sum.volume ?? 0),
    }));
  }

  async getCategoryBreakdown() {
    const breakdown = await this.prisma.market.groupBy({
      by: ['category'],
      _count: { id: true },
      _sum: { totalVolume: true },
    });

    return breakdown.map((b) => ({
      category: b.category,
      marketCount: b._count.id,
      totalVolume: Number(b._sum.totalVolume ?? 0),
    }));
  }

  // Runs every 5 minutes to record platform snapshots
  @Cron(CronExpression.EVERY_5_MINUTES)
  async recordPlatformSnapshot() {
    // Could write to a separate platform_snapshots table for charting
    // Omitted for MVP simplicity
  }
}
