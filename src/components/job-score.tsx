'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { scoreJob } from '@/lib/actions/scoring';
import { Button } from './ui';

// Controlled mode lets DiscoveryList own the scoring lifecycle so each card's
// fit badge updates incrementally as its score returns. Uncontrolled mode keeps
// the standalone behaviour (server action + refresh).
export type JobScoreControl = {
  pending: boolean;
  error: string | null;
  onScore: () => void;
};

// Per-card "Score fit" / "Rescore" button. When a job is already scored for the
// current profile, rescoring is forced; otherwise it scores fresh.
export function JobScoreButton({
  jobId,
  scored,
  control,
}: {
  jobId: string;
  scored: boolean;
  control?: JobScoreControl;
}) {
  const [selfPending, start] = useTransition();
  const [selfError, setSelfError] = useState<string | null>(null);
  const router = useRouter();

  const pending = control ? control.pending : selfPending;
  const error = control ? control.error : selfError;

  const onClick = () => {
    if (control) {
      control.onScore();
      return;
    }
    start(async () => {
      setSelfError(null);
      const res = await scoreJob(jobId, { force: scored });
      if (!res.ok) setSelfError(res.error ?? 'Scoring failed.');
      router.refresh();
    });
  };

  return (
    <span className="flex items-center gap-2">
      {error ? <span className="text-[11px] text-status-rejected">{error}</span> : null}
      <Button variant="ghost" size="sm" disabled={pending} onClick={onClick}>
        {pending ? 'Scoring…' : scored ? 'Rescore' : '✦ Score fit'}
      </Button>
    </span>
  );
}
