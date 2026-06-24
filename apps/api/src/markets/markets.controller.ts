import {
  Controller, Get, Post, Body, Param, Query,
  Headers, HttpCode, HttpStatus, UseGuards, ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { MarketsService, MarketFilters } from './markets.service';
import { CreateMarketDto } from './dto/create-market.dto';
import { MarketStatus } from '@prisma/client';

@ApiTags('markets')
@Controller('markets')
export class MarketsController {
  constructor(private readonly marketsService: MarketsService) {}

  @Post()
  @Throttle({ short: { limit: 2, ttl: 60000 } })
  @ApiOperation({ summary: 'Create a new prediction market' })
  @ApiResponse({ status: 201, description: 'Market created successfully' })
  async create(
    @Headers('x-wallet-address') walletAddress: string,
    @Body() dto: CreateMarketDto,
  ) {
    return this.marketsService.create(walletAddress, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List prediction markets with filters' })
  @ApiQuery({ name: 'status', required: false, enum: MarketStatus })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'featured', required: false, type: Boolean })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'sortBy', required: false, enum: ['createdAt', 'totalVolume', 'endDate'] })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  async findAll(@Query() query: MarketFilters) {
    return this.marketsService.findAll(query);
  }

  @Get('trending')
  @ApiOperation({ summary: 'Get trending markets by volume' })
  async getTrending(
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 10,
  ) {
    return this.marketsService.getTrending(limit);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get platform-wide statistics' })
  async getStats() {
    return this.marketsService.getStats();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific market by ID' })
  async findOne(@Param('id') id: string) {
    return this.marketsService.findOne(id);
  }

  @Post(':id/resolve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resolve a market (admin/oracle only)' })
  async resolve(
    @Param('id') id: string,
    @Headers('x-wallet-address') walletAddress: string,
    @Body() body: { outcome: 'YES' | 'NO'; evidenceUrl?: string },
  ) {
    await this.marketsService.resolve(id, walletAddress, body.outcome, body.evidenceUrl);
    return { success: true, message: 'Market resolved' };
  }
}
