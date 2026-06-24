import { HeroSection } from '@/components/home/HeroSection';
import { StatsBar } from '@/components/home/StatsBar';
import { TopPredictors } from '@/components/home/TopPredictors';
import { MarketCard } from '@/components/market/MarketCard';
import { fetchTrendingMarkets, fetchMarketStats, fetchTopPredictors } from '@/lib/api';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export const revalidate = 30;

export default async function HomePage() {
  const [trending, stats, topPredictors] = await Promise.all([
    fetchTrendingMarkets(6).catch(() => []),
    fetchMarketStats().catch(() => ({
      totalMarkets: 0,
      openMarkets: 0,
      resolvedMarkets: 0,
      totalVolume: 0,
      totalPositions: 0,
      totalUsers: 0,
    })),
    fetchTopPredictors(5).catch(() => []),
  ]);

  return (
    <>
      <HeroSection />
      <StatsBar stats={stats} />

      {/* Trending Markets */}
      <section className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold">Trending Markets</h2>
            <p className="text-muted text-sm mt-1">Highest volume open markets</p>
          </div>
          <Link
            href="/markets"
            className="flex items-center gap-2 text-primary text-sm hover:underline"
          >
            All markets <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {trending.length === 0 ? (
          <div className="text-center py-20 card-base">
            <p className="text-muted">No markets yet. Be the first to create one!</p>
            <Link href="/create" className="btn-primary mt-4 inline-flex">
              Create Market
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {trending.map((market, i) => (
              <MarketCard key={market.id} market={market} index={i} />
            ))}
          </div>
        )}
      </section>

      {topPredictors.length > 0 && <TopPredictors predictors={topPredictors} />}
    </>
  );
}
