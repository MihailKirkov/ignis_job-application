import {
  Skeleton,
  SkeletonJobCard,
  SkeletonPanel,
} from '@/components/hud-skeleton';

// HUD skeleton mirroring the Discovery layout: header, tabs, filter panel, list.
export default function DiscoveryLoading() {
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-3 w-64" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-32" />
        </div>
      </header>

      {/* tabs */}
      <div className="flex gap-4 border-b border-border pb-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-20" />
        ))}
      </div>

      {/* filter panel */}
      <SkeletonPanel header bodyClassName="flex flex-wrap gap-3">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-9 w-24" />
      </SkeletonPanel>

      <Skeleton className="h-3 w-28" />

      <div className="grid gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonJobCard key={i} />
        ))}
      </div>
    </div>
  );
}
