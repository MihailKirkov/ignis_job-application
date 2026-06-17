'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { SectionLabel } from './hud';

// Live ticking widgets. Mount-guarded so the server-rendered markup (which has
// no "now") doesn't mismatch on hydration. The 1s interval is the single
// allowed animated element on the bridge; reduced-motion still shows the value
// updating but no transitions fire.

function useNow(active: boolean): Date | null {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    if (!active) return;
    // Defer the first tick off the effect body (no synchronous setState) — the
    // mount guard already prevents a hydration mismatch.
    const first = setTimeout(() => setNow(new Date()), 0);
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [active]);
  return now;
}

const pad = (n: number) => String(n).padStart(2, '0');

// --------------------------------------------------------------------------- CountdownTimer
// T-MINUS to a target date (e.g. funding-runway end / relocation date).
export function CountdownTimer({
  target,
  label = 'T-MINUS',
  className,
}: {
  target: string; // ISO date
  label?: string;
  className?: string;
}) {
  const now = useNow(true);
  const targetMs = new Date(`${target}T00:00:00`).getTime();

  let body = '——D ——:——:——';
  let elapsed = false;
  if (now) {
    const diff = targetMs - now.getTime();
    elapsed = diff <= 0;
    const s = Math.max(0, Math.floor(diff / 1000));
    const days = Math.floor(s / 86400);
    const hours = Math.floor((s % 86400) / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    body = `${days}D ${pad(hours)}:${pad(mins)}:${pad(secs)}`;
  }

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <SectionLabel>{elapsed ? 'TARGET ELAPSED' : label}</SectionLabel>
      <span
        className="font-mono text-lg font-semibold leading-none tabular-nums text-accent"
        suppressHydrationWarning
      >
        {body}
      </span>
    </div>
  );
}

