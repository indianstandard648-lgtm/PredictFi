import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { MarketsService } from '../markets/markets.service';
import { OracleStatus } from '@prisma/client';

// Interface designed for future oracle providers (UMA, Chainlink, API3, Reality.eth)
export interface OracleProvider {
  name: string;
  submitRequest(marketId: string, question: string): Promise<string>;
  getResult(requestId: string): Promise<{ outcome: 'YES' | 'NO' | null; confidence: number }>;
}

@Injectable()
export class OracleService {
  constructor(
    private prisma: PrismaService,
    private marketsService: MarketsService,
    private config: ConfigService,
  ) {}

  // ─── Admin Oracle (MVP) ────────────────────────────────────────────────────

  async adminResolve(
    resolverWallet: string,
    marketId: string,
    outcome: 'YES' | 'NO',
    evidenceUrl?: string,
    notes?: string,
  ) {
    const adminWallet = this.config.get<string>('ADMIN_WALLET_PUBLIC');
    if (resolverWallet !== adminWallet) {
      throw new BadRequestException('Only admin can resolve markets in MVP mode');
    }

    await this.marketsService.resolve(marketId, resolverWallet, outcome, evidenceUrl);

    await this.prisma.oracleRequest.create({
      data: {
        marketId,
        source: 'admin',
        status: OracleStatus.VERIFIED,
        requestData: JSON.stringify({ outcome }),
        responseData: JSON.stringify({ outcome, evidenceUrl, notes }),
        submittedBy: resolverWallet,
        resolvedAt: new Date(),
      },
    });

    return { success: true, outcome, marketId };
  }

  async submitOracleRequest(marketId: string, source: string) {
    const market = await this.marketsService.findOne(marketId);
    if (!market) throw new NotFoundException('Market not found');

    return this.prisma.oracleRequest.create({
      data: {
        marketId,
        source,
        status: OracleStatus.PENDING,
        requestData: JSON.stringify({ question: market.title }),
      },
    });
  }

  async getPendingResolutions() {
    return this.prisma.oracleRequest.findMany({
      where: { status: OracleStatus.PENDING },
      include: { market: { select: { id: true, title: true, endDate: true } } },
      orderBy: { requestedAt: 'asc' },
    });
  }

  // Future hook: register external oracle providers
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async registerOracleProvider(_provider: OracleProvider): Promise<void> {
    // Future: UMA, Reality.eth, Chainlink, API3
    throw new Error('External oracle providers not yet implemented — use admin resolver');
  }
}
