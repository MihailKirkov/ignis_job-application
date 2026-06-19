import { Skeleton, SkeletonPanel } from '@/components/hud-skeleton';

// HUD skeleton mirroring the Sources layout: header + a stack of source cards.
export default function SourcesLoading() {
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-3 w-72" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-28" />
        </div>
      </header>

      <div className="grid gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonPanel key={i} bodyClassName="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-3.5 w-40" />
              <Skeleton className="h-3 w-2/3" />
              <Skeleton className="h-2.5 w-32" />
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <Skeleton className="h-5 w-9 rounded-full" />
              <Skeleton className="h-7 w-7" />
              <Skeleton className="h-7 w-7" />
              <Skeleton className="h-7 w-7" />
            </div>
          </SkeletonPanel>
        ))}
      </div>

      <Skeleton className="h-3 w-80" />
    </div>
  );
}
