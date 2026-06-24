import { Module } from '@nestjs/common';
import { OracleController } from './oracle.controller';
import { OracleService } from './oracle.service';
import { MarketsModule } from '../markets/markets.module';

@Module({
  imports: [MarketsModule],
  controllers: [OracleController],
  providers: [OracleService],
})
export class OracleModule {}
