'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { promoteJob, setJobState } from '@/lib/actions/jobs';
import type { JobState } from '@/types/database';
import { Button } from './ui';

export function JobStateControls({
  id,
  state,
}: {
  id: string;
  state: JobState;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();

  function act(fn: () => Promise<unknown>) {
    start(async () => {
      await fn();
      router.refresh();
    });
  }

  async function onPromote() {
    start(async () => {
      const res = await promoteJob(id);
      if (!res.ok) alert(res.error ?? 'Could not promote job.');
      router.refresh();
    });
  }

  if (state === 'promoted') {
    return (
      <span className="text-xs text-status-offer">✓ Promoted to pipeline</span>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <Button variant="primary" size="sm" disabled={pending} onClick={onPromote}>
        Promote
      </Button>

      {state !== 'saved' ? (
        <Button
          variant="secondary"
          size="sm"
          disabled={pending}
          onClick={() => act(() => setJobState(id, 'saved'))}
        >
          Save
        </Button>
      ) : null}

      {state !== 'dismissed' ? (
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => act(() => setJobState(id, 'dismissed'))}
        >
          Dismiss
        </Button>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => act(() => setJobState(id, 'new'))}
        >
          Restore
        </Button>
      )}
    </div>
  );
}
