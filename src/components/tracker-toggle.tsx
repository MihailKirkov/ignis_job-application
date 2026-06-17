'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';

const VIEWS = [
  { key: 'board', label: '▦ Board' },
  { key: 'console', label: '≡ Console' },
] as const;

// Board/console toggle, reflected in the URL so the server component renders the
// chosen view. Other params (q, status) are preserved.
export function TrackerViewToggle({ active }: { active: 'board' | 'console' }) {
  const router = useRouter();
  const params = useSearchParams();

  function setView(view: string) {
    const next = new URLSearchParams(params.toString());
    next.set('view', view);
    router.replace(`/tracker?${next.toString()}`);
  }

  return (
    <div className="inline-flex items-center gap-0.5 border border-system/25 bg-surface p-0.5">
      {VIEWS.map((v) => {
        const on = v.key === active;
        return (
          <button
            key={v.key}
            type="button"
            onClick={() => setView(v.key)}
            aria-pressed={on}
            className={cn(
              'px-3 py-1 font-mono text-xs uppercase tracking-wide transition-colors',
              on ? 'bg-surface-2 text-system' : 'text-muted hover:text-fg',
            )}
            style={on ? { boxShadow: 'var(--glow-system)' } : undefined}
          >
            {v.label}
          </button>
        );
      })}
    </div>
  );
}
