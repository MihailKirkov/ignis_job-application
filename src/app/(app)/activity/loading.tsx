import { Skeleton, SkeletonPanel } from '@/components/hud-skeleton';

// HUD skeleton mirroring the Activity layout: header, filter bar, event log.
export default function ActivityLoading() {
  return (
    <div className="space-y-4">
      <header className="space-y-2">
        <Skeleton className="h-6 w-28" />
        <Skeleton className="h-3 w-64" />
      </header>

      {/* filter bar */}
      <SkeletonPanel header bodyClassName="flex flex-wrap items-end gap-3">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-9 w-36" />
        <Skeleton className="h-9 w-36" />
        <Skeleton className="h-9 w-20" />
      </SkeletonPanel>

      {/* event log */}
      <SkeletonPanel header bodyClassName="divide-y divide-border">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3 py-2.5 first:pt-0">
            <Skeleton className="mt-0.5 h-2 w-2 rounded-full" />
            <div className="min-w-0 flex-1 flex items-baseline justify-between gap-3">
              <Skeleton className="h-3.5 w-2/3" />
              <Skeleton className="h-3 w-28" />
            </div>
          </div>
        ))}
      </SkeletonPanel>
    </div>
  );
}
