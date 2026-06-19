'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { promoteJob, setJobState } from '@/lib/actions/jobs';
import type { JobState } from '@/types/database';
import { Button } from './ui';

// Controlled mode: the parent (DiscoveryList) owns the optimistic list state and
// drives the mutation, so the card can disappear/move instantly. Uncontrolled
// mode keeps the original self-contained behaviour (server action + refresh).
export type JobStateControl = {
  pending: boolean;
  onSetState: (state: JobState) => void;
  onPromote: () => void;
};

export function JobStateControls({
  id,
  state,
  control,
}: {
  id: string;
  state: JobState;
  control?: JobStateControl;
}) {
  const [selfPending, start] = useTransition();
  const router = useRouter();

  const pending = control ? control.pending : selfPending;

  const setState = (next: JobState) => {
    if (control) {
      control.onSetState(next);
      return;
    }
    start(async () => {
      await setJobState(id, next);
      router.refresh();
    });
  };

  const onPromote = () => {
    if (control) {
      control.onPromote();
      return;
    }
    start(async () => {
      const res = await promoteJob(id);
      if (!res.ok) alert(res.error ?? 'Could not promote job.');
      router.refresh();
    });
  };

  if (state === 'promoted') {
    return <span className="text-xs text-status-offer">✓ Promoted to pipeline</span>;
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
          onClick={() => setState('saved')}
        >
          Save
        </Button>
      ) : null}

      {state !== 'dismissed' ? (
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => setState('dismissed')}
        >
          Dismiss
        </Button>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => setState('new')}
        >
          Restore
        </Button>
      )}
    </div>
  );
}
