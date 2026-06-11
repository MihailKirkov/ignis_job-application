import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { JobState } from '@/types/database';

const TABS: { state: JobState; label: string }[] = [
  { state: 'new', label: 'New' },
  { state: 'saved', label: 'Saved' },
  { state: 'promoted', label: 'Promoted' },
  { state: 'dismissed', label: 'Dismissed' },
];

export function DiscoveryTabs({
  active,
  counts,
}: {
  active: JobState;
  counts: Record<string, number>;
}) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-border">
      {TABS.map((t) => {
        const isActive = t.state === active;
        return (
          <Link
            key={t.state}
            href={`/discovery?state=${t.state}`}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              '-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2 text-sm transition-colors',
              isActive
                ? 'border-accent text-fg'
                : 'border-transparent text-muted hover:text-fg',
            )}
          >
            {t.label}
            <span className="font-mono text-xs text-faint">{counts[t.state] ?? 0}</span>
          </Link>
        );
      })}
    </div>
  );
}
