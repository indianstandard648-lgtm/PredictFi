export default function MarketsLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="space-y-2">
          <div className="h-8 w-36 bg-accent rounded" />
          <div className="h-4 w-52 bg-accent/60 rounded" />
        </div>
        <div className="h-10 w-32 bg-primary/20 rounded-lg" />
      </div>

      {/* Filter bar */}
      <div className="flex gap-2 mb-6 overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-8 w-20 bg-accent rounded-full flex-shrink-0" />
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="card-base p-5 h-48 flex flex-col gap-3">
            <div className="flex items-start justify-between">
              <div className="space-y-2 flex-1">
                <div className="h-3 w-16 bg-accent/60 rounded-full" />
                <div className="h-5 w-full bg-accent rounded" />
                <div className="h-5 w-3/4 bg-accent rounded" />
              </div>
            </div>
            <div className="mt-auto space-y-2">
              <div className="flex justify-between">
                <div className="h-4 w-20 bg-primary/20 rounded" />
                <div className="h-4 w-20 bg-red-500/20 rounded" />
              </div>
              <div className="h-2 w-full bg-accent/40 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
