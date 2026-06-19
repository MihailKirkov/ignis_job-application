import { Skeleton, SkeletonStat, SkeletonAppCard, SkeletonPanel } from '@/components/hud-skeleton';

// HUD skeleton mirroring the Tracker layout: header, pipeline stat row, toolbar,
// then the board lanes.
export default function TrackerLoading() {
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-2 w-28" />
          <Skeleton className="h-6 w-28" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-36" />
        </div>
      </header>

      {/* pipeline stats — 8 readouts */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
        {Array.from({ length: 8 }).map((_, i) => (
          <SkeletonStat key={i} />
        ))}
      </div>

      {/* toolbar */}
      <SkeletonPanel bodyClassName="flex flex-wrap gap-3">
        <Skeleton className="h-9 flex-1 min-w-[180px]" />
        <Skeleton className="h-9 w-40" />
      </SkeletonPanel>

      {/* board lanes */}
      <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, lane) => (
          <SkeletonPanel key={lane} header bodyClassName="space-y-2">
            <SkeletonAppCard />
            {lane % 2 === 0 ? <SkeletonAppCard /> : null}
          </SkeletonPanel>
        ))}
      </div>
    </div>
  );
}
