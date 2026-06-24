'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Search, Filter, SlidersHorizontal } from 'lucide-react';
import { MarketCard } from '@/components/market/MarketCard';
import { fetchMarkets } from '@/lib/api';
import { Market, MarketCategory, MarketStatus } from '@/types';

const CATEGORIES: Array<{ value: string; label: string }> = [
  { value: '', label: 'All' },
  { value: 'CRYPTO', label: 'Crypto' },
  { value: 'POLITICS', label: 'Politics' },
  { value: 'SPORTS', label: 'Sports' },
  { value: 'FINANCE', label: 'Finance' },
  { value: 'TECH', label: 'Tech' },
  { value: 'SCIENCE', label: 'Science' },
  { value: 'ENTERTAINMENT', label: 'Entertainment' },
  { value: 'WORLD_EVENTS', label: 'World Events' },
];

const STATUSES = [
  { value: '', label: 'All Status' },
  { value: 'OPEN', label: 'Open' },
  { value: 'LOCKED', label: 'Locked' },
  { value: 'RESOLVED', label: 'Resolved' },
];

const SORT_OPTIONS = [
  { value: 'createdAt-desc', label: 'Newest First' },
  { value: 'totalVolume-desc', label: 'Most Volume' },
  { value: 'endDate-asc', label: 'Ending Soon' },
];

export default function MarketsPage() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState<string>('OPEN');
  const [sort, setSort] = useState('totalVolume-desc');
  const [page, setPage] = useState(1);
  const limit = 12;

  const load = useCallback(async () => {
    setIsLoading(true);
    const [sortBy, sortOrder] = sort.split('-') as [string, 'asc' | 'desc'];
    try {
      const result = await fetchMarkets({
        search: search || undefined,
        category: category || undefined,
        status: (status || undefined) as MarketStatus,
        sortBy: sortBy as any,
        sortOrder,
        page,
        limit,
      });
      setMarkets(result.markets);
      setTotal(result.total);
    } finally {
      setIsLoading(false);
    }
  }, [search, category, status, sort, page]);

  useEffect(() => { load(); }, [load]);

  // Reset page on filter change
  useEffect(() => { setPage(1); }, [search, category, status, sort]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Prediction Markets</h1>
        <p className="text-muted">{total.toLocaleString()} markets</p>
      </div>

      {/* Filters */}
      <div className="card-base p-4 mb-6 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            type="text"
            placeholder="Search markets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-base pl-10"
          />
        </div>

        <div className="flex flex-wrap gap-3">
          {/* Categories */}
          <div className="flex gap-1.5 flex-wrap">
            {CATEGORIES.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setCategory(value)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  category === value
                    ? 'bg-primary text-background'
                    : 'bg-accent text-muted hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="ml-auto flex gap-3">
            {/* Status */}
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="input-base w-auto text-sm"
            >
              {STATUSES.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>

            {/* Sort */}
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="input-base w-auto text-sm"
            >
              {SORT_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Market Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card-base p-5 h-48 animate-pulse">
              <div className="h-4 bg-accent rounded w-1/3 mb-3" />
              <div className="h-5 bg-accent rounded w-3/4 mb-2" />
              <div className="h-5 bg-accent rounded w-1/2 mb-6" />
              <div className="h-2 bg-accent rounded-full" />
            </div>
          ))}
        </div>
      ) : markets.length === 0 ? (
        <div className="text-center py-24 card-base">
          <p className="text-muted text-lg">No markets found</p>
          <p className="text-muted text-sm mt-2">Try adjusting your filters</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {markets.map((market, i) => (
              <MarketCard key={market.id} market={market} index={i} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-8">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-outline px-4 py-2 text-sm disabled:opacity-30"
              >
                ← Prev
              </button>
              <span className="flex items-center px-4 text-sm text-muted">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="btn-outline px-4 py-2 text-sm disabled:opacity-30"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
