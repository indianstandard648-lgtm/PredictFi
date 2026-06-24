import { Controller, Get, Headers, ParseIntPipe, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { LeaderboardService } from './leaderboard.service';

@ApiTags('leaderboard')
@Controller('leaderboard')
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  @Get()
  @ApiOperation({ summary: 'Get forecaster leaderboard' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'category', required: false, enum: ['frs', 'accuracy', 'volume', 'profit'] })
  async getLeaderboard(
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 50,
    @Query('category') category?: 'frs' | 'accuracy' | 'volume' | 'profit',
  ) {
    return this.leaderboardService.getLeaderboard(page, limit, category);
  }

  @Get('top')
  @ApiOperation({ summary: 'Get top 5 predictors for homepage' })
  async getTopPredictors(@Query('limit', new ParseIntPipe({ optional: true })) limit = 5) {
    return this.leaderboardService.getTopPredictors(limit);
  }

  @Get('me/rank')
  @ApiOperation({ summary: "Get authenticated user's current rank" })
  async getMyRank(@Headers('x-wallet-address') walletAddress: string) {
    return this.leaderboardService.getUserRank(walletAddress);
  }
}
