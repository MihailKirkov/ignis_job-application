'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  createCompany,
  updateCompany,
  type CompanyActionState,
} from '@/lib/actions/companies';
import type { CompanyRow } from '@/types/database';
import { Modal } from './modal';
import { Button, Input, Label, Textarea } from './ui';

function Field({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>;
}

function CompanyForm({ row, onDone }: { row?: CompanyRow; onDone: () => void }) {
  const router = useRouter();
  const action = row ? updateCompany : createCompany;
  const [state, formAction, pending] = useActionState<CompanyActionState, FormData>(
    action,
    null,
  );

  useEffect(() => {
    if (state?.ok) {
      router.refresh();
      onDone();
    }
  }, [state, router, onDone]);

  return (
    <form action={formAction} className="space-y-3">
      {row ? <input type="hidden" name="id" value={row.id} /> : null}

      <Field>
        <Label htmlFor="company-name">Name *</Label>
        <Input id="company-name" name="name" required defaultValue={row?.name ?? ''} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field>
          <Label htmlFor="website">Website</Label>
          <Input id="website" name="website" placeholder="acme.io" defaultValue={row?.website ?? ''} />
        </Field>
        <Field>
          <Label htmlFor="company-location">Location</Label>
          <Input id="company-location" name="location" defaultValue={row?.location ?? ''} />
        </Field>
      </div>

      <Field>
        <Label htmlFor="ats_type">ATS / board type</Label>
        <Input id="ats_type" name="ats_type" placeholder="greenhouse, lever, …" defaultValue={row?.ats_type ?? ''} />
      </Field>

      <Field>
        <Label htmlFor="company-notes">Notes</Label>
        <Textarea id="company-notes" name="notes" defaultValue={row?.notes ?? ''} />
      </Field>

      {state?.error ? <p className="text-xs text-status-rejected">{state.error}</p> : null}

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? 'Saving…' : row ? 'Save changes' : 'Add company'}
        </Button>
      </div>
    </form>
  );
}

export function NewCompanyButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        + Company
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="New company">
        <CompanyForm onDone={() => setOpen(false)} />
      </Modal>
    </>
  );
}

export function EditCompanyButton({ row }: { row: CompanyRow }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Edit
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={row.name}>
        <CompanyForm row={row} onDone={() => setOpen(false)} />
      </Modal>
    </>
  );
}
