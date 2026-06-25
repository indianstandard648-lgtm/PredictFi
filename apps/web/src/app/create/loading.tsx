export default function CreateLoading() {
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10 animate-pulse space-y-6">
      <div className="space-y-2">
        <div className="h-8 w-44 bg-accent rounded" />
        <div className="h-4 w-72 bg-accent/60 rounded" />
      </div>

      <div className="card-base p-6 space-y-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-3 w-24 bg-accent/60 rounded" />
            <div className="h-10 w-full bg-accent rounded-lg" />
          </div>
        ))}
        <div className="h-12 w-full bg-primary/20 rounded-lg mt-4" />
      </div>
    </div>
  );
}
