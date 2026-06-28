import {
  Injectable, NotFoundException, BadRequestException, ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MarketsService } from '../markets/markets.service';
import { BuyPositionDto, TradeSide } from './dto/buy-position.dto';
import { MarketStatus, PositionStatus } from '@prisma/client';
import Decimal from 'decimal.js';

@Injectable()
export class PositionsService {
  constructor(
    private prisma: PrismaService,
    private marketsService: MarketsService,
  ) {}

  async buyPosition(walletAddress: string, dto: BuyPositionDto) {
    const user = await this.prisma.user.upsert({
      where: { walletAddress },
      update: {},
      create: { walletAddress },
    });

    const market = await this.marketsService.findOne(dto.marketId);
    if (market.status !== MarketStatus.OPEN) {
      throw new BadRequestException('Market is not open for trading');
    }
    if (new Date(market.endDate) <= new Date()) {
      throw new BadRequestException('Market trading period has ended');
    }

    const amount = new Decimal(dto.amountUsdc);
    const yesPool = new Decimal(market.yesPool);
    const noPool = new Decimal(market.noPool);
    const total = yesPool.plus(noPool);

    // Calculate shares and entry probability
    const { shares, entryProbability } = this.calculateShares(
      yesPool, noPool, total, dto.side, amount,
    );

    // Check for existing position and merge
    const existing = await this.prisma.position.findUnique({
      where: {
        userId_marketId_side: {
          userId: user.id,
          marketId: dto.marketId,
          side: dto.side as any,
        },
      },
    });

    let position;
    if (existing) {
      const newAmount = new Decimal(existing.amountUsdc).plus(amount);
      const newShares = new Decimal(existing.sharesOwned).plus(shares);
      const avgProb = new Decimal(existing.entryProbability)
        .mul(existing.amountUsdc)
        .plus(entryProbability.mul(amount))
        .div(newAmount);

      position = await this.prisma.position.update({
        where: { id: existing.id },
        data: {
          amountUsdc: newAmount,
          sharesOwned: newShares,
          entryProbability: avgProb,
          txHash: dto.txHash,
        },
      });
    } else {
      position = await this.prisma.position.create({
        data: {
          userId: user.id,
          marketId: dto.marketId,
          side: dto.side as any,
          amountUsdc: amount,
          sharesOwned: shares,
          entryProbability,
          txHash: dto.txHash,
        },
      });
    }

    // Update market pools
    await this.marketsService.updatePools(dto.marketId, dto.side, amount, shares);

    return { position, shares: shares.toNumber(), entryProbability: entryProbability.toNumber() };
  }

  async getUserPositions(walletAddress: string, marketId?: string) {
    const user = await this.prisma.user.findUnique({ where: { walletAddress } });
    if (!user) return [];

    const where: any = { userId: user.id };
    if (marketId) where.marketId = marketId;

    const positions = await this.prisma.position.findMany({
      where,
      include: {
        market: {
          select: {
            id: true,
            title: true,
            status: true,
            onchainId: true,
            yesPool: true,
            noPool: true,
            resolution: {
              select: { outcome: true, evidenceUrl: true, resolvedAt: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return positions.map((p) => {
      const yesPool = new Decimal(p.market.yesPool);
      const noPool = new Decimal(p.market.noPool);
      const total = yesPool.plus(noPool);
      const currentProb = p.side === 'YES'
        ? (total.isZero() ? new Decimal(50) : yesPool.div(total).mul(100))
        : (total.isZero() ? new Decimal(50) : noPool.div(total).mul(100));

      const currentValue = new Decimal(p.sharesOwned)
        .mul(currentProb)
        .div(100);

      const unrealizedPnL = currentValue.minus(p.amountUsdc);

      return { ...p, currentValue, unrealizedPnL, currentProbability: currentProb };
    });
  }

  async claimReward(walletAddress: string, positionId: string, txHash: string) {
    const user = await this.prisma.user.findUnique({ where: { walletAddress } });
    if (!user) throw new NotFoundException('User not found');

    const position = await this.prisma.position.findUnique({
      where: { id: positionId },
      include: { market: { include: { resolution: true } } },
    });

    if (!position) throw new NotFoundException('Position not found');
    if (position.userId !== user.id) throw new BadRequestException('Not your position');
    if (position.status === PositionStatus.CLAIMED) throw new ConflictException('Already claimed');
    if (position.market.status !== MarketStatus.RESOLVED) {
      throw new BadRequestException('Market not yet resolved');
    }

    const resolution = position.market.resolution;
    if (!resolution) throw new BadRequestException('No resolution found');

    const isWinner = resolution.outcome === position.side;

    if (!isWinner) {
      await this.prisma.position.update({
        where: { id: positionId },
        data: { status: PositionStatus.SETTLED, profit: new Decimal(position.amountUsdc).neg() },
      });
      return { won: false, payout: 0 };
    }

    const yesPool = new Decimal(position.market.yesPool);
    const noPool = new Decimal(position.market.noPool);
    const totalPool = yesPool.plus(noPool);

    const winningShares = position.side === 'YES'
      ? new Decimal(position.market.yesShares)
      : new Decimal(position.market.noShares);

    const gross = winningShares.isZero()
      ? new Decimal(0)
      : new Decimal(position.sharesOwned).div(winningShares).mul(totalPool);

    const fee = gross.mul(0.02); // 2% platform fee
    const netPayout = gross.minus(fee);
    const profit = netPayout.minus(position.amountUsdc);

    await this.prisma.position.update({
      where: { id: positionId },
      data: {
        status: PositionStatus.CLAIMED,
        payout: netPayout,
        profit,
        claimTxHash: txHash,
      },
    });

    return { won: true, payout: netPayout.toNumber(), profit: profit.toNumber() };
  }

  async getPortfolioStats(walletAddress: string) {
    const user = await this.prisma.user.findUnique({ where: { walletAddress } });
    if (!user) return null;

    const positions = await this.prisma.position.findMany({
      where: { userId: user.id },
    });

    const totalInvested = positions.reduce(
      (sum, p) => sum.plus(p.amountUsdc), new Decimal(0),
    );
    const totalPayout = positions.reduce(
      (sum, p) => sum.plus(p.payout ?? 0), new Decimal(0),
    );
    const totalProfit = positions.reduce(
      (sum, p) => sum.plus(p.profit ?? 0), new Decimal(0),
    );
    const claimed = positions.filter((p) => p.status === PositionStatus.CLAIMED);
    const wins = claimed.filter((p) => Number(p.profit ?? 0) > 0).length;

    return {
      totalPositions: positions.length,
      activePositions: positions.filter((p) => p.status === PositionStatus.ACTIVE).length,
      totalInvested: totalInvested.toNumber(),
      totalPayout: totalPayout.toNumber(),
      totalProfit: totalProfit.toNumber(),
      roi: totalInvested.isZero() ? 0 : totalProfit.div(totalInvested).mul(100).toNumber(),
      winRate: claimed.length === 0 ? 0 : (wins / claimed.length) * 100,
    };
  }

  private calculateShares(
    yesPool: Decimal, noPool: Decimal, total: Decimal,
    side: TradeSide, amount: Decimal,
  ): { shares: Decimal; entryProbability: Decimal } {
    if (total.isZero()) {
      return { shares: amount, entryProbability: new Decimal(50) };
    }

    const sidePool = side === TradeSide.YES ? yesPool : noPool;
    const probability = sidePool.div(total).mul(100);
    const effectiveProb = probability.isZero() ? new Decimal(1) : probability;

    const shares = amount.mul(100).div(effectiveProb);

    const newSidePool = sidePool.plus(amount);
    const newTotal = total.plus(amount);
    const entryProbability = newSidePool.div(newTotal).mul(100);

    return { shares, entryProbability };
  }
}
