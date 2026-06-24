import { Controller, Post, Get, Body, Headers } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { IsString, IsEnum, IsOptional } from 'class-validator';
import { OracleService } from './oracle.service';

export class ResolveDto {
  @IsString()
  marketId: string;

  @IsEnum(['YES', 'NO'])
  outcome: 'YES' | 'NO';

  @IsOptional()
  @IsString()
  evidenceUrl?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

@ApiTags('oracle')
@Controller('oracle')
export class OracleController {
  constructor(private readonly oracleService: OracleService) {}

  @Post('resolve')
  @ApiOperation({ summary: 'Admin: resolve a market outcome' })
  async resolve(
    @Headers('x-wallet-address') walletAddress: string,
    @Body() dto: ResolveDto,
  ) {
    return this.oracleService.adminResolve(
      walletAddress,
      dto.marketId,
      dto.outcome,
      dto.evidenceUrl,
      dto.notes,
    );
  }

  @Get('pending')
  @ApiOperation({ summary: 'Get markets awaiting oracle resolution' })
  async getPending() {
    return this.oracleService.getPendingResolutions();
  }
}
