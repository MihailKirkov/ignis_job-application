'use client';

import { useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

const DISMISS_KEY = 'jcc-onboarding-dismissed';

// Tiny external store so we can read the localStorage dismissal flag without
// setState-in-effect, and re-render on same-tab dismissal.
const listeners = new Set<() => void>();
function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
function isDismissed() {
  return typeof window !== 'undefined' && localStorage.getItem(DISMISS_KEY) === '1';
}
function dismissOnboarding() {
  localStorage.setItem(DISMISS_KEY, '1');
  listeners.forEach((l) => l());
}

export type OnboardingStep = {
  label: string;
  hint: string;
  href: string;
  done: boolean;
};

// First-run guided checklist shown on the landing page when the account is still
// being set up. Dismissible (persisted in localStorage); the server only renders
// it while steps remain, so it disappears for good once everything is done.
export function OnboardingChecklist({ steps }: { steps: OnboardingStep[] }) {
  // Server snapshot is always false, so the card SSRs and then hides on the
  // client if previously dismissed (useSyncExternalStore handles the swap).
  const dismissed = useSyncExternalStore(subscribe, isDismissed, () => false);
  const [expanded, setExpanded] = useState(false);

  if (dismissed) return null;

  const done = steps.filter((s) => s.done).length;

  function dismiss() {
    dismissOnboarding();
  }

  // Once nearly complete (3/4+), collapse to a thin bar so it stops dominating
  // the command bridge. The full checklist is one click away; dismissal persists.
  const nearDone = done >= steps.length - 1;
  if (nearDone && !expanded) {
    return (
      <section className="flex items-center justify-between gap-3 rounded-md border border-accent/30 bg-accent-soft/40 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="hud-label text-accent">SETUP</span>
          <span className="font-mono text-xs text-fg">
            {done}/{steps.length}
          </span>
          <span className="truncate text-xs text-muted">
            {done === steps.length ? 'All set — you’re ready to go.' : 'Almost there — one step left.'}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {done < steps.length ? (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="rounded px-2 py-1 text-xs text-muted transition-colors hover:bg-surface-2 hover:text-fg"
            >
              Resume
            </button>
          ) : null}
          <button
            type="button"
            onClick={dismiss}
            className="rounded px-2 py-1 text-xs text-muted transition-colors hover:bg-surface-2 hover:text-fg"
            aria-label="Dismiss the setup checklist"
          >
            ✕
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-[10px] border border-accent/30 bg-accent-soft/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-fg">Get set up</h2>
          <p className="text-xs text-muted">
            A few steps to go from empty to a scored inbox.{' '}
            <span className="font-mono text-fg">
              {done}/{steps.length}
            </span>{' '}
            done.
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="rounded-md px-2 py-1 text-xs text-muted transition-colors hover:bg-surface-2 hover:text-fg"
          aria-label="Dismiss the setup checklist"
        >
          Dismiss ✕
        </button>
      </div>

      <ol className="mt-3 grid gap-1.5">
        {steps.map((step, i) => (
          <li key={step.href + step.label}>
            <Link
              href={step.href}
              className={cn(
                'flex items-center gap-3 rounded-md border border-transparent px-2.5 py-2 transition-colors',
                step.done ? 'opacity-60' : 'hover:border-border hover:bg-surface',
              )}
            >
              <span
                className={cn(
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold',
                  step.done
                    ? 'bg-status-offer/20 text-status-offer'
                    : 'border border-border bg-surface text-muted',
                )}
                aria-hidden
              >
                {step.done ? '✓' : i + 1}
              </span>
              <span className="min-w-0">
                <span
                  className={cn(
                    'block text-sm text-fg',
                    step.done && 'line-through decoration-muted/50',
                  )}
                >
                  {step.label}
                </span>
                <span className="block text-xs text-muted">{step.hint}</span>
              </span>
              {step.done ? null : (
                <span className="ml-auto shrink-0 text-faint" aria-hidden>
                  →
                </span>
              )}
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
