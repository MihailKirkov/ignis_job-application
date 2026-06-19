import { Skeleton, SkeletonStat, SkeletonAppCard, SkeletonPanel } from '@/components/hud-skeleton';

// HUD skeleton mirroring the Needs-action command bridge: command bar, vitals
// row, then the priority-alerts + telemetry grid.
export default function NeedsActionLoading() {
  return (
    <div className="space-y-4">
      {/* command bar */}
      <SkeletonPanel bodyClassName="px-4 py-3.5">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <div className="space-y-2">
            <Skeleton className="h-2 w-28" />
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-3 w-44" />
          </div>
          <div className="flex items-center gap-6">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-9 w-36" />
          </div>
        </div>
      </SkeletonPanel>

      {/* vitals */}
      <div className="flex flex-wrap items-start gap-3">
        <div className="grid min-w-[260px] flex-1 grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonStat key={i} />
          ))}
        </div>
        <SkeletonPanel header className="min-w-[200px] flex-1 sm:max-w-[240px]" bodyClassName="flex items-center justify-center gap-3 py-2.5">
          <Skeleton className="h-[76px] w-[76px] rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-12" />
          </div>
        </SkeletonPanel>
      </div>

      {/* alerts + telemetry */}
      <div className="grid gap-4 lg:grid-cols-3">
        <SkeletonPanel header className="lg:col-span-2" bodyClassName="space-y-2">
          <SkeletonAppCard />
          <SkeletonAppCard />
          <SkeletonAppCard />
        </SkeletonPanel>
        <SkeletonPanel header bodyClassName="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <Skeleton className="h-3 w-10" />
              <Skeleton className="h-1.5 w-1.5 rounded-full" />
              <Skeleton className="h-3 flex-1" />
            </div>
          ))}
        </SkeletonPanel>
      </div>
    </div>
  );
}
