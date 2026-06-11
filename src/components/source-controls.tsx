'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { deleteSource, toggleSource } from '@/lib/actions/sources';
import { Button } from './ui';

export function ToggleSourceButton({ id, enabled }: { id: string; enabled: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      disabled={pending}
      onClick={() =>
        start(async () => {
          await toggleSource(id, !enabled);
          router.refresh();
        })
      }
      className={`relative h-5 w-9 rounded-full transition-colors disabled:opacity-50 ${
        enabled ? 'bg-accent' : 'bg-surface-2 border border-border'
      }`}
      aria-label={enabled ? 'Disable source' : 'Enable source'}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-bg transition-transform ${
          enabled ? 'translate-x-4' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

export function DeleteSourceButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Button
      variant="danger"
      size="sm"
      disabled={pending}
      onClick={() => {
        if (!confirm('Remove this source?')) return;
        start(async () => {
          await deleteSource(id);
          router.refresh();
        });
      }}
    >
      Remove
    </Button>
  );
}
