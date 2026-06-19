'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { clearNextAction, deleteApplication } from '@/lib/actions/applications';
import { Button } from './ui';

export function DeleteApplicationButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Button
      variant="danger"
      size="sm"
      disabled={pending}
      onClick={() => {
        if (!confirm('Delete this application? This cannot be undone.')) return;
        start(async () => {
          await deleteApplication(id);
          router.refresh();
        });
      }}
    >
      {pending ? 'Deleting…' : 'Delete'}
    </Button>
  );
}

export function ClearActionButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  // Optimistic: flip to a settled "✓ Cleared" the instant it's clicked (no
  // spinner-then-jump). The row leaves the queue when the refresh lands.
  const [cleared, setCleared] = useState(false);
  const router = useRouter();
  return (
    <Button
      variant="primary"
      size="sm"
      disabled={pending || cleared}
      onClick={() =>
        start(async () => {
          setCleared(true);
          await clearNextAction(id);
          router.refresh();
        })
      }
    >
      {cleared ? '✓ Cleared' : '✓ Clear'}
    </Button>
  );
}
