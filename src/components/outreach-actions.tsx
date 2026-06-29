'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { clearBump, setOutreachStatus } from '@/lib/actions/outreach';
import { OUTREACH_STATUSES } from '@/lib/constants';
import type { OutreachStatus } from '@/types/database';
import { Button, Select } from './ui';

// One-click clear for a due bump on the command bridge. Optimistic ✓ Cleared.
export function ClearBumpButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
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
          await clearBump(id);
          router.refresh();
        })
      }
    >
      {cleared ? '✓ Cleared' : '✓ Clear'}
    </Button>
  );
}

// Inline status changer for an outreach row (Sent → Replied → …).
export function OutreachStatusSelect({
  id,
  status,
  companyName,
}: {
  id: string;
  status: OutreachStatus;
  companyName?: string | null;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Select
      aria-label="Outreach status"
      className="h-7 w-[120px] py-0 text-xs"
      defaultValue={status}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.value as OutreachStatus;
        start(async () => {
          await setOutreachStatus(id, next, companyName);
          router.refresh();
        });
      }}
    >
      {OUTREACH_STATUSES.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </Select>
  );
}
