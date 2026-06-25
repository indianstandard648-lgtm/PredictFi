export default function LeaderboardLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 animate-pulse">
      <div className="space-y-2 mb-8">
        <div className="h-8 w-48 bg-accent rounded" />
        <div className="h-4 w-72 bg-accent/60 rounded" />
      </div>

      {/* Top 3 podium */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="card-base p-6 flex flex-col items-center gap-3">
            <div className="w-14 h-14 bg-accent rounded-full" />
            <div className="h-5 w-24 bg-accent rounded" />
            <div className="h-8 w-16 bg-accent rounded" />
          </div>
        ))}
      </div>

      {/* Table rows */}
      <div className="card-base divide-y divide-border">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-6 py-4">
            <div className="h-5 w-8 bg-accent/60 rounded flex-shrink-0" />
            <div className="w-9 h-9 bg-accent rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 w-32 bg-accent rounded" />
              <div className="h-3 w-20 bg-accent/60 rounded" />
            </div>
            <div className="h-6 w-16 bg-accent rounded" />
            <div className="h-4 w-12 bg-accent/60 rounded hidden sm:block" />
            <div className="h-4 w-12 bg-accent/60 rounded hidden md:block" />
          </div>
        ))}
      </div>
    </div>
  );
}
