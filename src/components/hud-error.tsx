'use client';

import { useEffect } from 'react';
import { StatusLed } from './hud';
import { Button } from './ui';

// Shared HUD-styled error fallback for the per-route error.tsx boundaries. A
// framed "signal lost" panel with a red alert LED and a retry that re-renders
// the crashed segment — never a blank page.
//
// Next 16 passes `unstable_retry`; older signatures used `reset`. We accept
// either so the boundary works regardless of which the runtime injects.
export function HudError({
  title = 'Signal lost',
  segment,
  error,
  retry,
}: {
  title?: string;
  segment: string;
  error: Error & { digest?: string };
  retry?: () => void;
}) {
  useEffect(() => {
    console.error(`[${segment}]`, error);
  }, [error, segment]);

  return (
    <div className="py-10">
      <div className="hud-cut mx-auto max-w-md border border-status-rejected/40 bg-surface">
        <div className="flex items-center gap-2 border-b border-status-rejected/25 px-4 py-2.5">
          <StatusLed colorToken="status-rejected" alert size={8} />
          <span className="hud-label text-status-rejected">{segment} · FAULT</span>
        </div>
        <div className="space-y-3 p-5">
          <p className="text-sm font-medium text-fg">{title}</p>
          <p className="text-xs leading-relaxed text-muted">
            This panel failed to load. The rest of the command center is
            unaffected — retry to re-establish the feed.
          </p>
          {error.digest ? (
            <p className="font-mono text-[11px] text-faint">ref · {error.digest}</p>
          ) : null}
          {retry ? (
            <Button variant="primary" size="sm" onClick={retry}>
              ↻ Retry
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
