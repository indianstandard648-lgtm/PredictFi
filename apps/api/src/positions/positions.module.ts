import { Module } from '@nestjs/common';
import { PositionsController } from './positions.controller';
import { PositionsService } from './positions.service';
import { MarketsModule } from '../markets/markets.module';
import { StellarModule } from '../stellar/stellar.module';

@Module({
  imports: [MarketsModule, StellarModule],
  controllers: [PositionsController],
  providers: [PositionsService],
  exports: [PositionsService],
})
export class PositionsModule {}
