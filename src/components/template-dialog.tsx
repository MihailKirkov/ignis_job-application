'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { saveTemplate, type TemplateActionState } from '@/lib/actions/templates';
import { TEMPLATE_KINDS, TEMPLATE_KIND_LABEL } from '@/lib/constants';
import { TEMPLATE_VARS } from '@/lib/templates';
import type { MessageTemplateRow } from '@/types/database';
import { Modal } from './modal';
import { Button, Input, Label, Select, Textarea } from './ui';

function Field({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>;
}

function TemplateForm({ row, onDone }: { row?: MessageTemplateRow; onDone: () => void }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<TemplateActionState, FormData>(
    saveTemplate,
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
          <Label htmlFor="t-name">Name *</Label>
          <Input id="t-name" name="name" required defaultValue={row?.name ?? ''} placeholder="Open application" />
        </Field>
        <Field>
          <Label htmlFor="t-kind">Kind</Label>
          <Select id="t-kind" name="kind" defaultValue={row?.kind ?? 'other'}>
            {TEMPLATE_KINDS.map((k) => (
              <option key={k} value={k}>
                {TEMPLATE_KIND_LABEL[k]}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field>
        <Label htmlFor="t-subject">Subject</Label>
        <Input id="t-subject" name="subject" defaultValue={row?.subject ?? ''} placeholder="Open application — {role}" />
      </Field>

      <Field>
        <Label htmlFor="t-body">Body *</Label>
        <Textarea
          id="t-body"
          name="body"
          required
          rows={7}
          defaultValue={row?.body ?? ''}
          placeholder={'Hi {contact},\n\nI came across {company} and would love to…'}
        />
        <p className="mt-1 font-mono text-[11px] text-faint">
          Variables: {TEMPLATE_VARS.map((v) => `{${v}}`).join('  ')}
        </p>
      </Field>

      {state?.error ? <p className="text-xs text-status-rejected">{state.error}</p> : null}

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? 'Saving…' : row ? 'Save changes' : 'Add template'}
        </Button>
      </div>
    </form>
  );
}

export function NewTemplateButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        + Template
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="New template">
        <TemplateForm onDone={() => setOpen(false)} />
      </Modal>
    </>
  );
}

export function EditTemplateButton({ row }: { row: MessageTemplateRow }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Edit
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={row.name}>
        <TemplateForm row={row} onDone={() => setOpen(false)} />
      </Modal>
    </>
  );
}
