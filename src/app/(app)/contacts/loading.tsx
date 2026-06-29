import { Skeleton, SkeletonStat, SkeletonPanel } from '@/components/hud-skeleton';

// HUD skeleton mirroring the Contacts layout: header, stat row, filter chips,
// then the console table.
export default function ContactsLoading() {
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-2 w-20" />
          <Skeleton className="h-6 w-28" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-32" />
        </div>
      </header>

      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonStat key={i} />
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-7 w-20" />
        ))}
      </div>

      <SkeletonPanel bodyClassName="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-6 w-full" />
        ))}
      </SkeletonPanel>
    </div>
  );
}
