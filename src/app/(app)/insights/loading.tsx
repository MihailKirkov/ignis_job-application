import { Skeleton, SkeletonStat, SkeletonPanel } from '@/components/hud-skeleton';

// HUD skeleton mirroring the Insights layout: header, totals row, then the
// per-channel funnel cards.
export default function InsightsLoading() {
  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <Skeleton className="h-2 w-24" />
        <Skeleton className="h-6 w-28" />
        <Skeleton className="h-3 w-72" />
      </header>

      <div className="flex flex-wrap gap-3">
        <div className="grid min-w-[260px] flex-1 grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonStat key={i} />
          ))}
        </div>
        <Skeleton className="h-[120px] min-w-[200px] flex-1 sm:max-w-[240px]" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonPanel key={i} header bodyClassName="space-y-2">
            {Array.from({ length: 5 }).map((_, j) => (
              <Skeleton key={j} className="h-3 w-full" />
            ))}
          </SkeletonPanel>
        ))}
      </div>
    </div>
  );
}
