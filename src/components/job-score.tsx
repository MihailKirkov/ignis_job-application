'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { scoreJob } from '@/lib/actions/scoring';
import { Button } from './ui';

// Per-card "Score fit" / "Rescore" button. When a job is already scored for the
// current profile, rescoring is forced; otherwise it scores fresh.
export function JobScoreButton({ jobId, scored }: { jobId: string; scored: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  return (
    <span className="flex items-center gap-2">
      {error ? <span className="text-[11px] text-status-rejected">{error}</span> : null}
      <Button
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const res = await scoreJob(jobId, { force: scored });
            if (!res.ok) setError(res.error ?? 'Scoring failed.');
            router.refresh();
          })
        }
      >
        {pending ? 'Scoring…' : scored ? 'Rescore' : '✦ Score fit'}
      </Button>
    </span>
  );
}
