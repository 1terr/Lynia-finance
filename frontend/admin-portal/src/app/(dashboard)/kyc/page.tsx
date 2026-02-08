export default function KYCReviewPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">KYC Review</h1>
        <p className="text-muted-foreground">KYC review queue will be implemented in P3-T007</p>
      </div>
      <div className="rounded-xl border bg-card p-12 shadow-sm">
        <div className="flex flex-col items-center justify-center text-center">
          <div className="rounded-full bg-muted p-4 mb-4">
            <svg className="h-8 w-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
          </div>
          <h2 className="text-lg font-semibold">Coming Soon</h2>
          <p className="text-sm text-muted-foreground mt-1">KYC review queue will be implemented in P3-T007</p>
        </div>
      </div>
    </div>
  );
}
