'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { clearFollowUp, deleteContact } from '@/lib/actions/contacts';
import { deleteCompany } from '@/lib/actions/companies';
import { Button } from './ui';

// One-click clear for a due follow-up on the command bridge. Optimistic ✓ Cleared,
// mirroring ClearActionButton for applications.
export function ClearFollowUpButton({ id }: { id: string }) {
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
          await clearFollowUp(id);
          router.refresh();
        })
      }
    >
      {cleared ? '✓ Cleared' : '✓ Clear'}
    </Button>
  );
}

export function DeleteContactButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Button
      variant="danger"
      size="sm"
      disabled={pending}
      onClick={() => {
        if (!confirm('Delete this contact? This cannot be undone.')) return;
        start(async () => {
          await deleteContact(id);
          router.refresh();
        });
      }}
    >
      {pending ? 'Deleting…' : 'Delete'}
    </Button>
  );
}

export function DeleteCompanyButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Button
      variant="danger"
      size="sm"
      disabled={pending}
      onClick={() => {
        if (!confirm('Delete this company? Contacts and applications keep their data but unlink.'))
          return;
        start(async () => {
          await deleteCompany(id);
          // Drop the ?company= filter so we don't linger on a deleted company.
          router.push('/contacts');
          router.refresh();
        });
      }}
    >
      {pending ? 'Deleting…' : 'Delete'}
    </Button>
  );
}
