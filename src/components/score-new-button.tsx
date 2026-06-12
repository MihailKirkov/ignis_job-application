'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { scoreNewJobs } from '@/lib/actions/scoring';
import { Button } from './ui';

// Batch-score the unscored New jobs (bounded concurrency + capped server-side).
export function ScoreNewButton() {
  const [pending, start] = useTransition();
  const [summary, setSummary] = useState<string | null>(null);
  const router = useRouter();

  return (
    <div className="flex items-center gap-2">
      {summary ? <span className="text-xs text-muted">{summary}</span> : null}
      <Button
        variant="secondary"
        disabled={pending}
        title="Scoring runs on your own Anthropic API key"
        onClick={() =>
          start(async () => {
            const res = await scoreNewJobs();
            setSummary(
              res.ok
                ? `Scored ${res.scored}` +
                    (res.failed ? `, ${res.failed} failed` : '') +
                    (res.skipped ? `, ${res.skipped} already scored` : '')
                : (res.error ?? 'Scoring failed.'),
            );
            router.refresh();
          })
        }
      >
        {pending ? 'Scoring…' : '✦ Score new jobs'}
      </Button>
    </div>
  );
}
