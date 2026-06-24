import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';

@ApiTags('analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Platform-wide analytics overview' })
  async getOverview() {
    return this.analyticsService.getPlatformOverview();
  }

  @Get('volume-history')
  @ApiOperation({ summary: 'Historical volume data for charting' })
  async getVolumeHistory(@Query('days') days = 30) {
    return this.analyticsService.getVolumeHistory(days);
  }

  @Get('categories')
  @ApiOperation({ summary: 'Market breakdown by category' })
  async getCategoryBreakdown() {
    return this.analyticsService.getCategoryBreakdown();
  }
}
