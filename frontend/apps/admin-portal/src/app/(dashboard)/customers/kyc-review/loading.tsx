export default function KYCReviewLoading() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6 lg:p-8">
      {/* Header skeleton */}
      <div>
        <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
        <div className="mt-2 h-4 w-96 animate-pulse rounded bg-gray-200" />
      </div>

      {/* Stats skeleton */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-lg bg-gray-200"
          />
        ))}
      </div>

      {/* Search bar skeleton */}
      <div className="flex items-center gap-4">
        <div className="h-10 w-80 animate-pulse rounded-lg bg-gray-200" />
        <div className="h-10 w-40 animate-pulse rounded-lg bg-gray-200" />
      </div>

      {/* Card skeletons */}
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-lg bg-gray-200"
          />
        ))}
      </div>
    </div>
  );
}
