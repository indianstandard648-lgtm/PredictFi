import { HeroSection } from '@/components/home/HeroSection';
import { StatsBar } from '@/components/home/StatsBar';
import { HowItWorks } from '@/components/home/HowItWorks';
import { CategoryExplorer } from '@/components/home/CategoryExplorer';
import { WhyPredictFi } from '@/components/home/WhyPredictFi';
import { TopPredictors } from '@/components/home/TopPredictors';
import { CTABanner } from '@/components/home/CTABanner';
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
      <HowItWorks />

      {/* Trending Markets */}
      <section className="py-20 border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold">Trending Markets</h2>
              <p className="text-muted text-sm mt-1">Highest volume open markets right now</p>
            </div>
            <Link
              href="/markets"
              prefetch
              className="flex items-center gap-2 text-primary text-sm hover:underline"
            >
              View all markets <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {trending.length === 0 ? (
            <div className="text-center py-20 card-base">
              <p className="text-muted text-lg mb-4">No markets yet — be the first!</p>
              <Link href="/create" className="btn-primary inline-flex">
                Create a Market
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {trending.map((market, i) => (
                <MarketCard key={market.id} market={market} index={i} />
              ))}
            </div>
          )}
        </div>
      </section>

      <CategoryExplorer />
      <WhyPredictFi />

      {topPredictors.length > 0 && <TopPredictors predictors={topPredictors} />}

      <CTABanner />
    </>
  );
}
