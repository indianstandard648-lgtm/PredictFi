import {
  IsString, IsEnum, IsDateString, IsOptional,
  MinLength, MaxLength, IsArray,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MarketCategory } from '@prisma/client';

export class CreateMarketDto {
  @ApiProperty({ example: 'Will Bitcoin reach $100k by Dec 2025?' })
  @IsString()
  @MinLength(10)
  @MaxLength(200)
  title: string;

  @ApiProperty({ example: 'Bitcoin price prediction market based on CoinGecko data.' })
  @IsString()
  @MinLength(20)
  @MaxLength(2000)
  description: string;

  @ApiProperty({ enum: MarketCategory, example: MarketCategory.CRYPTO })
  @IsEnum(MarketCategory)
  category: MarketCategory;

  @ApiProperty({ example: '2025-12-31T23:59:59Z' })
  @IsDateString()
  endDate: string;

  @ApiProperty({ example: '2026-01-07T00:00:00Z' })
  @IsDateString()
  resolutionDate: string;

  @ApiPropertyOptional({ example: 'admin' })
  @IsOptional()
  @IsString()
  oracleSource?: string;

  @ApiPropertyOptional({ example: 'https://coingecko.com/en/coins/bitcoin' })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({ example: ['bitcoin', 'crypto', 'price'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
