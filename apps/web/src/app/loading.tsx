export default function HomeLoading() {
  return (
    <div className="animate-pulse">
      {/* Hero skeleton */}
      <div className="pt-20 pb-32 flex flex-col items-center gap-6">
        <div className="h-6 w-48 bg-accent rounded-full" />
        <div className="h-16 w-2/3 bg-accent rounded-xl" />
        <div className="h-16 w-1/2 bg-accent rounded-xl" />
        <div className="h-5 w-80 bg-accent/60 rounded-lg" />
        <div className="flex gap-4 mt-4">
          <div className="h-12 w-40 bg-primary/20 rounded-lg" />
          <div className="h-12 w-40 bg-accent rounded-lg" />
        </div>
      </div>
      {/* Stats skeleton */}
      <div className="border-y border-border">
        <div className="max-w-7xl mx-auto px-4 grid grid-cols-5 divide-x divide-border">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="py-6 flex flex-col items-center gap-2">
              <div className="h-7 w-20 bg-accent rounded" />
              <div className="h-3 w-16 bg-accent/60 rounded" />
            </div>
          ))}
        </div>
      </div>
      {/* Cards skeleton */}
      <div className="max-w-7xl mx-auto px-4 py-16">
        <div className="h-8 w-48 bg-accent rounded mb-8" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card-base p-5 h-44 flex flex-col gap-3">
              <div className="h-4 w-16 bg-accent/60 rounded-full" />
              <div className="h-5 w-full bg-accent rounded" />
              <div className="h-5 w-3/4 bg-accent rounded" />
              <div className="mt-auto h-2 w-full bg-accent/40 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
