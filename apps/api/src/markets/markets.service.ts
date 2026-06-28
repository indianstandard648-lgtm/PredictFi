import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StellarService } from '../stellar/stellar.service';
import { CreateMarketDto } from './dto/create-market.dto';
import { Market, MarketStatus, Prisma } from '@prisma/client';
import Decimal from 'decimal.js';

export interface MarketWithProbabilities extends Market {
  probabilityYes: number;
  probabilityNo: number;
  participantCount: number;
}

export interface MarketFilters {
  status?: MarketStatus;
  category?: string;
  search?: string;
  featured?: boolean;
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'totalVolume' | 'endDate';
  sortOrder?: 'asc' | 'desc';
}

@Injectable()
export class MarketsService {
  private readonly logger = new Logger(MarketsService.name);

  constructor(
    private prisma: PrismaService,
    private stellar: StellarService,
  ) {}

  async create(walletAddress: string, dto: CreateMarketDto): Promise<Market> {
    const user = await this.prisma.user.upsert({
      where: { walletAddress },
      update: {},
      create: { walletAddress },
    });

    const endDate = new Date(dto.endDate);
    const resolutionDate = new Date(dto.resolutionDate);

    if (endDate <= new Date()) {
      throw new BadRequestException('End date must be in the future');
    }
    if (resolutionDate < endDate) {
      throw new BadRequestException('Resolution date must be after end date');
    }

    return this.prisma.market.create({
      data: {
        title: dto.title,
        description: dto.description,
        category: dto.category,
        creatorId: user.id,
        oracleSource: dto.oracleSource ?? 'admin',
        oracleAddress: dto.oracleAddress ?? walletAddress,
        endDate,
        resolutionDate,
        imageUrl: dto.imageUrl,
        tags: dto.tags ?? [],
        onchainId: dto.onchainId ?? null,
        yesPool: new Decimal(0),
        noPool: new Decimal(0),
        totalVolume: new Decimal(0),
      },
      include: { creator: { select: { id: true, walletAddress: true, username: true } } },
    });
  }

  async findAll(filters: MarketFilters = {}): Promise<{ markets: MarketWithProbabilities[]; total: number }> {
    const {
      status,
      category,
      search,
      featured,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = filters;
    const page = Number(filters.page ?? 1);
    const limit = Number(filters.limit ?? 20);

    const where: Prisma.MarketWhereInput = {};
    if (status) where.status = status;
    if (category) where.category = category as any;
    if (featured !== undefined) where.featured = featured;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { tags: { has: search.toLowerCase() } },
      ];
    }

    const [markets, total] = await Promise.all([
      this.prisma.market.findMany({
        where,
        include: {
          creator: { select: { id: true, walletAddress: true, username: true } },
          _count: { select: { positions: true } },
        },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.market.count({ where }),
    ]);

    return {
      markets: markets.map((m) => this.addProbabilities(m)),
      total,
    };
  }

  async findOne(id: string): Promise<MarketWithProbabilities> {
    const market = await this.prisma.market.findUnique({
      where: { id },
      include: {
        creator: { select: { id: true, walletAddress: true, username: true } },
        resolution: true,
        _count: { select: { positions: true } },
        priceHistory: {
          orderBy: { recordedAt: 'asc' },
          take: 100,
        },
      },
    });

    if (!market) throw new NotFoundException(`Market ${id} not found`);
    return this.addProbabilities(market);
  }

  async getTrending(limit = 10): Promise<MarketWithProbabilities[]> {
    const markets = await this.prisma.market.findMany({
      where: { status: MarketStatus.OPEN },
      include: {
        creator: { select: { id: true, walletAddress: true, username: true } },
        _count: { select: { positions: true } },
      },
      orderBy: { totalVolume: 'desc' },
      take: limit,
    });

    return markets.map((m) => this.addProbabilities(m));
  }

  async updatePools(
    marketId: string,
    side: 'YES' | 'NO',
    amount: Decimal,
    shares: Decimal,
  ): Promise<void> {
    const market = await this.prisma.market.findUnique({ where: { id: marketId } });
    if (!market) throw new NotFoundException('Market not found');
    if (market.status !== MarketStatus.OPEN) {
      throw new BadRequestException('Market is not open for trading');
    }

    const update: Prisma.MarketUpdateInput = {
      totalVolume: { increment: amount },
    };

    if (side === 'YES') {
      update.yesPool = { increment: amount };
      update.yesShares = { increment: shares };
    } else {
      update.noPool = { increment: amount };
      update.noShares = { increment: shares };
    }

    await this.prisma.market.update({ where: { id: marketId }, data: update });

    // Record price snapshot
    const updated = await this.prisma.market.findUnique({ where: { id: marketId } });
    if (updated) {
      const total = updated.yesPool.plus(updated.noPool);
      const probYes = total.isZero() ? new Decimal(50) : updated.yesPool.div(total).mul(100);
      const probNo = new Decimal(100).minus(probYes);

      await this.prisma.priceSnapshot.create({
        data: {
          marketId,
          probabilityYes: probYes,
          probabilityNo: probNo,
          yesPool: updated.yesPool,
          noPool: updated.noPool,
          volume: amount,
        },
      });
    }
  }

  async resolve(
    marketId: string,
    resolverWallet: string,
    outcome: 'YES' | 'NO',
    evidenceUrl?: string,
    txHash?: string,
  ): Promise<void> {
    const market = await this.prisma.market.findUnique({ where: { id: marketId } });
    if (!market) throw new NotFoundException('Market not found');

    const resolver = await this.prisma.user.upsert({
      where: { walletAddress: resolverWallet },
      update: {},
      create: { walletAddress: resolverWallet },
    });

    await this.prisma.$transaction([
      this.prisma.market.update({
        where: { id: marketId },
        data: { status: MarketStatus.RESOLVED },
      }),
      this.prisma.resolution.upsert({
        where: { marketId },
        update: { outcome: outcome as any, evidenceUrl, txHash },
        create: {
          marketId,
          outcome: outcome as any,
          resolverId: resolver.id,
          evidenceUrl,
          txHash,
        },
      }),
    ]);

    // Trigger on-chain settle_market using admin keypair (best-effort)
    if (market.onchainId) {
      this.triggerSettlement(market.onchainId, outcome).catch((err) => {
        this.logger.warn(`settle_market failed for market ${market.onchainId}: ${err?.message}`);
      });
    }
  }

  private async triggerSettlement(onchainId: number, outcome: 'YES' | 'NO'): Promise<void> {
    const outcomeVariant = outcome === 'YES' ? 'Yes' : 'No';
    await this.stellar.settleMarket(onchainId, outcomeVariant as 'Yes' | 'No');
    this.logger.log(`settle_market called for on-chain market #${onchainId} → ${outcomeVariant}`);
  }

  async lockMarket(marketId: string): Promise<void> {
    const market = await this.prisma.market.findUnique({ where: { id: marketId } });
    if (!market) throw new NotFoundException('Market not found');
    if (market.status !== MarketStatus.OPEN) return; // idempotent
    await this.prisma.market.update({
      where: { id: marketId },
      data: { status: MarketStatus.LOCKED },
    });
  }

  async getStats(): Promise<{
    totalMarkets: number;
    openMarkets: number;
    resolvedMarkets: number;
    totalVolume: Decimal;
    totalPositions: number;
    totalUsers: number;
  }> {
    const [total, open, resolved, volumeAgg, positions, users] = await Promise.all([
      this.prisma.market.count(),
      this.prisma.market.count({ where: { status: MarketStatus.OPEN } }),
      this.prisma.market.count({ where: { status: MarketStatus.RESOLVED } }),
      this.prisma.market.aggregate({ _sum: { totalVolume: true } }),
      this.prisma.position.count(),
      this.prisma.user.count(),
    ]);

    return {
      totalMarkets: total,
      openMarkets: open,
      resolvedMarkets: resolved,
      totalVolume: volumeAgg._sum.totalVolume ?? new Decimal(0),
      totalPositions: positions,
      totalUsers: users,
    };
  }

  private addProbabilities(market: any): MarketWithProbabilities {
    const yesPool = new Decimal(market.yesPool ?? 0);
    const noPool = new Decimal(market.noPool ?? 0);
    const total = yesPool.plus(noPool);

    const probabilityYes = total.isZero()
      ? 50
      : yesPool.div(total).mul(100).toDecimalPlaces(1).toNumber();
    const probabilityNo = total.isZero()
      ? 50
      : noPool.div(total).mul(100).toDecimalPlaces(1).toNumber();

    return {
      ...market,
      probabilityYes,
      probabilityNo,
      participantCount: market._count?.positions ?? 0,
    };
  }
}
