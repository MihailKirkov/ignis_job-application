'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  createContact,
  updateContact,
  type ContactActionState,
} from '@/lib/actions/contacts';
import { CHANNELS } from '@/lib/constants';
import type { ContactRow } from '@/types/database';
import { Modal } from './modal';
import { Button, Input, Label, Select, Textarea } from './ui';

export type CompanyOption = { id: string; name: string };

function Field({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>;
}

// Sentinel option value that flips the picker into free-text mode for a brand-new
// company (the contact action auto-creates-or-links by name).
const NEW_COMPANY = '__new_company__';

// Company chooser: a real native <Select> of existing companies (opens reliably
// like every other dropdown), plus a "+ New company…" escape hatch that swaps in a
// text input so you can still type an employer that doesn't exist yet. Whichever is
// shown carries name="company", so the form always submits a single company name.
function CompanyPicker({
  companies,
  defaultValue,
}: {
  companies: CompanyOption[];
  defaultValue: string;
}) {
  const known = companies.some((c) => c.name === defaultValue);
  // Start in free-text mode when there's nothing to pick from, or the preset name
  // isn't an existing company.
  const [creating, setCreating] = useState(
    companies.length === 0 || (defaultValue !== '' && !known),
  );
  const [value, setValue] = useState(defaultValue);

  if (creating) {
    return (
      <>
        <Input
          id="company"
          name="company"
          placeholder="e.g. Sioux"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoFocus={companies.length > 0}
        />
        {companies.length > 0 ? (
          <button
            type="button"
            className="mt-1 font-mono text-[11px] text-faint transition-colors hover:text-system"
            onClick={() => {
              setCreating(false);
              setValue('');
            }}
          >
            ← Pick existing
          </button>
        ) : null}
      </>
    );
  }

  return (
    <Select
      id="company"
      name="company"
      value={value}
      onChange={(e) => {
        if (e.target.value === NEW_COMPANY) {
          setCreating(true);
          setValue('');
          return;
        }
        setValue(e.target.value);
      }}
    >
      <option value="">—</option>
      {companies.map((c) => (
        <option key={c.id} value={c.name}>
          {c.name}
        </option>
      ))}
      <option value={NEW_COMPANY}>+ New company…</option>
    </Select>
  );
}

function ContactForm({
  row,
  companyName,
  companies,
  presetCompanyName,
  onDone,
}: {
  row?: ContactRow;
  companyName?: string;
  companies: CompanyOption[];
  presetCompanyName?: string;
  onDone: () => void;
}) {
  const router = useRouter();
  const action = row ? updateContact : createContact;
  const [state, formAction, pending] = useActionState<ContactActionState, FormData>(
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

      <div className="grid grid-cols-2 gap-3">
        <Field>
          <Label htmlFor="name">Name *</Label>
          <Input id="name" name="name" required defaultValue={row?.name ?? ''} />
        </Field>
        <Field>
          <Label htmlFor="company">Company</Label>
          <CompanyPicker
            companies={companies}
            defaultValue={companyName ?? presetCompanyName ?? ''}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field>
          <Label htmlFor="role">Role</Label>
          <Input id="role" name="role" placeholder="Recruiter" defaultValue={row?.role ?? ''} />
        </Field>
        <Field>
          <Label htmlFor="channel">Channel</Label>
          <Select id="channel" name="channel" defaultValue={row?.channel ?? ''}>
            <option value="">—</option>
            {CHANNELS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field>
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" placeholder="name@company.com" defaultValue={row?.email ?? ''} />
        </Field>
        <Field>
          <Label htmlFor="linkedin_url">LinkedIn</Label>
          <Input id="linkedin_url" name="linkedin_url" placeholder="linkedin.com/in/…" defaultValue={row?.linkedin_url ?? ''} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field>
          <Label htmlFor="last_contacted_at">Last contacted</Label>
          <Input
            id="last_contacted_at"
            name="last_contacted_at"
            type="date"
            defaultValue={row?.last_contacted_at ? row.last_contacted_at.slice(0, 10) : ''}
          />
        </Field>
        <Field>
          <Label htmlFor="next_follow_up_at">Next follow-up</Label>
          <Input
            id="next_follow_up_at"
            name="next_follow_up_at"
            type="date"
            defaultValue={row?.next_follow_up_at ?? ''}
          />
        </Field>
      </div>

      <Field>
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" name="notes" defaultValue={row?.notes ?? ''} />
      </Field>

      {state?.error ? <p className="text-xs text-status-rejected">{state.error}</p> : null}

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? 'Saving…' : row ? 'Save changes' : 'Add contact'}
        </Button>
      </div>
    </form>
  );
}

export function NewContactButton({
  companies,
  presetCompanyName,
}: {
  companies: CompanyOption[];
  presetCompanyName?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>
        + New contact
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="New contact">
        <ContactForm
          companies={companies}
          presetCompanyName={presetCompanyName}
          onDone={() => setOpen(false)}
        />
      </Modal>
    </>
  );
}

export function EditContactButton({
  row,
  companyName,
  companies,
}: {
  row: ContactRow;
  companyName?: string;
  companies: CompanyOption[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Edit
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={row.name}>
        <ContactForm
          row={row}
          companyName={companyName}
          companies={companies}
          onDone={() => setOpen(false)}
        />
      </Modal>
    </>
  );
}
