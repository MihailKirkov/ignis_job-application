import * as React from 'react';
import { cn } from '@/lib/utils';

// =============================================================================
// HUD-styled loading placeholders. Pure presentation (no hooks), so they render
// in SSR'd loading.tsx and Suspense fallbacks without a hydration flash. The
// shimmer comes from the `.hud-skeleton` utility (auto-disabled under
// prefers-reduced-motion). Panels use a static chamfered frame that mirrors
// <HudFrame> dimensions — the SVG bracket fidelity is dropped on purpose so the
// fallback is stable and shift-free; what matters is matching the box size.
// =============================================================================

// One shimmering block. Size via className.
export function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('hud-skeleton', className)} aria-hidden {...props} />;
}

// A line of placeholder "text".
export function SkeletonLine({ className }: { className?: string }) {
  return <Skeleton className={cn('h-3', className)} />;
}

// A framed panel placeholder mirroring <HudFrame>. `label` renders a tiny
// hatch + label-sized block so headers line up with the real thing.
export function SkeletonPanel({
  className,
  bodyClassName,
  header = false,
  children,
}: {
  className?: string;
  bodyClassName?: string;
  header?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn('hud-cut border border-system/15 bg-surface', className)}
      aria-hidden
    >
      {header ? (
        <>
          <div className="flex items-center gap-2 px-3.5 pb-2 pt-2.5">
            <span className="hud-hatch h-2.5 w-4 shrink-0" />
            <Skeleton className="h-2 w-20" />
          </div>
          <div className="mx-3.5 h-px bg-system/20" />
        </>
      ) : null}
      <div className={cn('p-3.5', bodyClassName)}>{children}</div>
    </div>
  );
}

// Mirrors <StatReadout> — a small framed metric tile.
export function SkeletonStat({ className }: { className?: string }) {
  return (
    <div className={cn('hud-cut border border-system/15 bg-surface px-3 py-2.5', className)} aria-hidden>
      <Skeleton className="h-5 w-10" />
      <Skeleton className="mt-2 h-2 w-14" />
      <Skeleton className="mt-2 h-2 w-full" />
    </div>
  );
}

// Mirrors <JobCard> layout (title, company, meta, summary block, footer row).
export function SkeletonJobCard() {
  return (
    <div className="hud-cut relative border border-system/15 bg-surface" aria-hidden>
      <span className="absolute inset-y-0 left-0 w-[3px] bg-system/20" />
      <div className="p-4 pl-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-2.5 w-1/2" />
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-3 w-12" />
          </div>
        </div>
        <Skeleton className="mt-3 h-3 w-full" />
        <Skeleton className="mt-1.5 h-3 w-5/6" />
        <div className="mt-3 flex items-center justify-between">
          <Skeleton className="h-3 w-24" />
          <div className="flex gap-1.5">
            <Skeleton className="h-7 w-16" />
            <Skeleton className="h-7 w-14" />
          </div>
        </div>
      </div>
    </div>
  );
}

// Mirrors the compact <AppCard> used in alert lists + board lanes.
export function SkeletonAppCard() {
  return (
    <div className="hud-cut relative border border-system/15 bg-surface-2/60" aria-hidden>
      <span className="absolute inset-y-0 left-0 w-[3px] bg-system/20" />
      <div className="p-2.5 pl-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-2.5 w-20" />
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-2.5 w-1/2" />
          </div>
          <Skeleton className="h-10 w-10 rounded-full" />
        </div>
        <Skeleton className="mt-2 h-2.5 w-24" />
      </div>
    </div>
  );
}

// A short batch of skeleton rows for "loading more" / streaming fallbacks.
export function SkeletonJobList({ rows = 4 }: { rows?: number }) {
  return (
    <div className="grid gap-3" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonJobCard key={i} />
      ))}
    </div>
  );
}
