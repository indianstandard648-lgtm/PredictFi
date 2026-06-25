export default function MarketDetailLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 animate-pulse">
      {/* Breadcrumb */}
      <div className="h-4 w-36 bg-accent/60 rounded mb-6" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: market info */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card-base p-6 space-y-4">
            <div className="flex gap-2">
              <div className="h-5 w-16 bg-accent/60 rounded-full" />
              <div className="h-5 w-16 bg-accent/40 rounded-full" />
            </div>
            <div className="h-8 w-3/4 bg-accent rounded" />
            <div className="h-8 w-1/2 bg-accent rounded" />
            <div className="space-y-2">
              <div className="h-4 w-full bg-accent/60 rounded" />
              <div className="h-4 w-5/6 bg-accent/60 rounded" />
              <div className="h-4 w-4/6 bg-accent/40 rounded" />
            </div>
          </div>

          {/* Chart skeleton */}
          <div className="card-base p-6">
            <div className="h-5 w-32 bg-accent rounded mb-4" />
            <div className="h-48 w-full bg-accent/30 rounded-xl" />
          </div>
        </div>

        {/* Right: trading panel */}
        <div className="space-y-4">
          <div className="card-base p-6 space-y-4">
            <div className="h-5 w-24 bg-accent rounded" />
            <div className="grid grid-cols-2 gap-2">
              <div className="h-12 bg-primary/20 rounded-lg" />
              <div className="h-12 bg-red-500/20 rounded-lg" />
            </div>
            <div className="h-10 w-full bg-accent rounded-lg" />
            <div className="h-3 w-full bg-accent/40 rounded" />
            <div className="h-12 w-full bg-primary/30 rounded-lg" />
          </div>
          <div className="card-base p-5 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex justify-between">
                <div className="h-3 w-24 bg-accent/60 rounded" />
                <div className="h-3 w-16 bg-accent rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
