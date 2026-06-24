import { Controller, Get, Post, Body, Param, Headers, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PositionsService } from './positions.service';
import { BuyPositionDto } from './dto/buy-position.dto';

@ApiTags('positions')
@Controller('positions')
export class PositionsController {
  constructor(private readonly positionsService: PositionsService) {}

  @Post('buy')
  @ApiOperation({ summary: 'Record a YES/NO position purchase' })
  async buy(
    @Headers('x-wallet-address') walletAddress: string,
    @Body() dto: BuyPositionDto,
  ) {
    return this.positionsService.buyPosition(walletAddress, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all positions for the authenticated user' })
  async getUserPositions(
    @Headers('x-wallet-address') walletAddress: string,
    @Query('marketId') marketId?: string,
  ) {
    return this.positionsService.getUserPositions(walletAddress, marketId);
  }

  @Post(':id/claim')
  @ApiOperation({ summary: 'Claim rewards for a winning position' })
  async claim(
    @Param('id') positionId: string,
    @Headers('x-wallet-address') walletAddress: string,
    @Body('txHash') txHash: string,
  ) {
    return this.positionsService.claimReward(walletAddress, positionId, txHash);
  }

  @Get('portfolio/stats')
  @ApiOperation({ summary: "Get user's portfolio summary stats" })
  async portfolioStats(@Headers('x-wallet-address') walletAddress: string) {
    return this.positionsService.getPortfolioStats(walletAddress);
  }
}
