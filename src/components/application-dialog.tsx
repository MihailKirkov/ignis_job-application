'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  createApplication,
  updateApplication,
  type ActionState,
} from '@/lib/actions/applications';
import {
  APPLICATION_STATUSES,
  CHANNELS,
  WORK_MODES,
} from '@/lib/constants';
import type { ApplicationRow, ApplicationStatus } from '@/types/database';
import { Modal } from './modal';
import { Button, Input, Label, Select, Textarea } from './ui';

function Field({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>;
}

function ApplicationForm({
  row,
  presetStatus,
  onDone,
}: {
  row?: ApplicationRow;
  presetStatus?: ApplicationStatus;
  onDone: () => void;
}) {
  const router = useRouter();
  const action = row ? updateApplication : createApplication;
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
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
      {row?.job_id ? <input type="hidden" name="job_id" value={row.job_id} /> : null}

      <div className="grid grid-cols-2 gap-3">
        <Field>
          <Label htmlFor="company">Company *</Label>
          <Input id="company" name="company" required defaultValue={row?.company ?? ''} />
        </Field>
        <Field>
          <Label htmlFor="role">Role *</Label>
          <Input id="role" name="role" required defaultValue={row?.role ?? ''} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field>
          <Label htmlFor="location">Location</Label>
          <Input id="location" name="location" defaultValue={row?.location ?? ''} />
        </Field>
        <Field>
          <Label htmlFor="mode">Mode</Label>
          <Select id="mode" name="mode" defaultValue={row?.mode ?? ''}>
            <option value="">—</option>
            {WORK_MODES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
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
        <Field>
          <Label htmlFor="status">Status</Label>
          <Select id="status" name="status" defaultValue={row?.status ?? presetStatus ?? 'To apply'}>
            {APPLICATION_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field>
          <Label htmlFor="salary">Salary</Label>
          <Input id="salary" name="salary" placeholder="€60–70k" defaultValue={row?.salary ?? ''} />
        </Field>
        <Field>
          <Label htmlFor="date_applied">Date applied</Label>
          <Input id="date_applied" name="date_applied" type="date" defaultValue={row?.date_applied ?? ''} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field>
          <Label htmlFor="next_action">Next action</Label>
          <Input id="next_action" name="next_action" placeholder="Follow up with recruiter" defaultValue={row?.next_action ?? ''} />
        </Field>
        <Field>
          <Label htmlFor="next_action_date">Next action date</Label>
          <Input id="next_action_date" name="next_action_date" type="date" defaultValue={row?.next_action_date ?? ''} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field>
          <Label htmlFor="link">Link</Label>
          <Input id="link" name="link" type="url" placeholder="https://" defaultValue={row?.link ?? ''} />
        </Field>
        <Field>
          <Label htmlFor="contact">Contact</Label>
          <Input id="contact" name="contact" defaultValue={row?.contact ?? ''} />
        </Field>
      </div>

      <Field>
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" name="notes" defaultValue={row?.notes ?? ''} />
      </Field>

      {state?.error ? (
        <p className="text-xs text-status-rejected">{state.error}</p>
      ) : null}

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? 'Saving…' : row ? 'Save changes' : 'Add application'}
        </Button>
      </div>
    </form>
  );
}

export function NewApplicationButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>
        + New application
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="New application">
        <ApplicationForm onDone={() => setOpen(false)} />
      </Modal>
    </>
  );
}

// Compact "+" in a board lane header — opens the form pre-set to that lane's status.
export function LaneAddButton({ status }: { status: ApplicationStatus }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Add application to ${status}`}
        title={`Add to ${status}`}
        className="inline-flex h-5 w-5 items-center justify-center text-base leading-none text-faint transition-colors hover:text-system"
      >
        +
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={`New application · ${status}`}>
        <ApplicationForm presetStatus={status} onDone={() => setOpen(false)} />
      </Modal>
    </>
  );
}

export function EditApplicationButton({ row }: { row: ApplicationRow }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Edit
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={`${row.company} — ${row.role}`}>
        <ApplicationForm row={row} onDone={() => setOpen(false)} />
      </Modal>
    </>
  );
}
