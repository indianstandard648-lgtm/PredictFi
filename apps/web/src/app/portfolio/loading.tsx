export default function PortfolioLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 animate-pulse">
      <div className="space-y-2 mb-8">
        <div className="h-8 w-32 bg-accent rounded" />
        <div className="h-4 w-56 bg-accent/60 rounded" />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card-base p-5 space-y-2">
            <div className="h-3 w-20 bg-accent/60 rounded" />
            <div className="h-7 w-24 bg-accent rounded" />
          </div>
        ))}
      </div>

      {/* Position list */}
      <div className="card-base divide-y divide-border">
        <div className="px-6 py-3 flex gap-4">
          {['Market', 'Side', 'Shares', 'Entry', 'Value', 'P&L'].map(h => (
            <div key={h} className="h-3 w-16 bg-accent/60 rounded" />
          ))}
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-6 py-4">
            <div className="flex-1 space-y-1.5">
              <div className="h-4 w-64 bg-accent rounded" />
              <div className="h-3 w-32 bg-accent/60 rounded" />
            </div>
            <div className="h-5 w-12 bg-primary/20 rounded flex-shrink-0" />
            <div className="h-4 w-16 bg-accent rounded flex-shrink-0" />
            <div className="h-4 w-16 bg-accent/60 rounded flex-shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
