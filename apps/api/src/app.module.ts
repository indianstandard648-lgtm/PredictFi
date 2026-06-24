import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { CacheModule } from '@nestjs/cache-manager';
import { MarketsModule } from './markets/markets.module';
import { PositionsModule } from './positions/positions.module';
import { ReputationModule } from './reputation/reputation.module';
import { LeaderboardModule } from './leaderboard/leaderboard.module';
import { OracleModule } from './oracle/oracle.module';
import { UsersModule } from './users/users.module';
import { StellarModule } from './stellar/stellar.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),

    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000, limit: 10 },
      { name: 'medium', ttl: 10000, limit: 50 },
      { name: 'long', ttl: 60000, limit: 200 },
    ]),

    CacheModule.register({
      isGlobal: true,
      ttl: 5000,
      max: 1000,
    }),

    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),

    PrismaModule,
    StellarModule,
    UsersModule,
    MarketsModule,
    PositionsModule,
    ReputationModule,
    LeaderboardModule,
    OracleModule,
    AnalyticsModule,
  ],
})
export class AppModule {}
