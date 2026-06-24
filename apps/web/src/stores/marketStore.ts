import { create } from 'zustand';
import { Market, PlatformStats } from '@/types';

interface MarketState {
  markets: Market[];
  trendingMarkets: Market[];
  stats: PlatformStats | null;
  selectedMarket: Market | null;
  isLoading: boolean;
  error: string | null;
  setMarkets: (markets: Market[]) => void;
  setTrending: (markets: Market[]) => void;
  setStats: (stats: PlatformStats) => void;
  setSelectedMarket: (market: Market | null) => void;
  setLoading: (v: boolean) => void;
  setError: (e: string | null) => void;
  updateMarketProbability: (marketId: string, yesPool: number, noPool: number) => void;
}

export const useMarketStore = create<MarketState>((set) => ({
  markets: [],
  trendingMarkets: [],
  stats: null,
  selectedMarket: null,
  isLoading: false,
  error: null,

  setMarkets: (markets) => set({ markets }),
  setTrending: (markets) => set({ trendingMarkets: markets }),
  setStats: (stats) => set({ stats }),
  setSelectedMarket: (market) => set({ selectedMarket: market }),
  setLoading: (v) => set({ isLoading: v }),
  setError: (e) => set({ error: e }),

  updateMarketProbability: (marketId, yesPool, noPool) =>
    set((state) => {
      const total = yesPool + noPool;
      const probYes = total === 0 ? 50 : (yesPool / total) * 100;
      const probNo = total === 0 ? 50 : (noPool / total) * 100;

      const update = (m: Market) =>
        m.id === marketId
          ? { ...m, yesPool: String(yesPool), noPool: String(noPool), probabilityYes: probYes, probabilityNo: probNo }
          : m;

      return {
        markets: state.markets.map(update),
        trendingMarkets: state.trendingMarkets.map(update),
        selectedMarket:
          state.selectedMarket?.id === marketId
            ? update(state.selectedMarket)
            : state.selectedMarket,
      };
    }),
}));
