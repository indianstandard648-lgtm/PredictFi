import { Module } from '@nestjs/common';
import { MarketsController } from './markets.controller';
import { MarketsService } from './markets.service';
import { StellarModule } from '../stellar/stellar.module';

@Module({
  imports: [StellarModule],
  controllers: [MarketsController],
  providers: [MarketsService],
  exports: [MarketsService],
})
export class MarketsModule {}
