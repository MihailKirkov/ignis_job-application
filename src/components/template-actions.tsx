'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { deleteTemplate } from '@/lib/actions/templates';
import { Button } from './ui';

export function DeleteTemplateButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Button
      variant="danger"
      size="sm"
      disabled={pending}
      onClick={() => {
        if (!confirm('Delete this template? This cannot be undone.')) return;
        start(async () => {
          await deleteTemplate(id);
          router.refresh();
        });
      }}
    >
      {pending ? 'Deleting…' : 'Delete'}
    </Button>
  );
}
