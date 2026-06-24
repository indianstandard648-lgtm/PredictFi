import { IsEnum, IsNumber, IsString, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum TradeSide {
  YES = 'YES',
  NO = 'NO',
}

export class BuyPositionDto {
  @ApiProperty({ example: 'clxyz123' })
  @IsString()
  marketId: string;

  @ApiProperty({ enum: TradeSide, example: TradeSide.YES })
  @IsEnum(TradeSide)
  side: TradeSide;

  @ApiProperty({ example: 10.5, description: 'Amount in USDC' })
  @IsNumber()
  @Min(1)
  amountUsdc: number;

  @ApiProperty({ example: 'abc123txhash', description: 'On-chain transaction hash' })
  @IsString()
  txHash: string;
}
