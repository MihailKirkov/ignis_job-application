'use client';

import { useActionState, useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { logOutreach, type OutreachActionState } from '@/lib/actions/outreach';
import { draftMessage } from '@/lib/actions/templates';
import { CHANNELS, OUTREACH_STATUSES } from '@/lib/constants';
import { Button, Input, Label, Select, Textarea } from './ui';
import { Modal } from './modal';

function Field({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>;
}

// Context the touch is logged against. Any of contact/company/application may be
// set; `companyName` is carried into the activity summary.
export type OutreachContext = {
  contactId?: string | null;
  companyId?: string | null;
  applicationId?: string | null;
  companyName?: string | null;
  channel?: string | null;
};

// The minimal template shape the composer's picker needs.
export type TemplateOption = { id: string; name: string };

function OutreachForm({
  ctx,
  templates = [],
  onDone,
}: {
  ctx: OutreachContext;
  templates?: TemplateOption[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<OutreachActionState, FormData>(
    logOutreach,
    null,
  );

  // Subject/body are controlled so a template (and AI personalize) can fill them.
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [drafting, startDraft] = useTransition();
  const [draftError, setDraftError] = useState<string | null>(null);

  useEffect(() => {
    if (state?.ok) {
      router.refresh();
      onDone();
    }
  }, [state, router, onDone]);

  function applyTemplate(id: string, ai: boolean) {
    setDraftError(null);
    startDraft(async () => {
      const res = await draftMessage({
        templateId: id,
        contactId: ctx.contactId,
        companyId: ctx.companyId,
        ai,
      });
      if (!res.ok) {
        setDraftError(res.error);
        return;
      }
      if (res.subject != null) setSubject(res.subject);
      setBody(res.body);
    });
  }

  return (
    <form action={formAction} className="space-y-3">
      {ctx.contactId ? <input type="hidden" name="contact_id" value={ctx.contactId} /> : null}
      {ctx.companyId ? <input type="hidden" name="company_id" value={ctx.companyId} /> : null}
      {ctx.applicationId ? (
        <input type="hidden" name="application_id" value={ctx.applicationId} />
      ) : null}
      {ctx.companyName ? <input type="hidden" name="company" value={ctx.companyName} /> : null}

      {templates.length > 0 ? (
        <Field>
          <Label htmlFor="o-template">Template</Label>
          <div className="flex items-center gap-2">
            <Select
              id="o-template"
              value={templateId}
              onChange={(e) => {
                const id = e.target.value;
                setTemplateId(id);
                if (id) applyTemplate(id, false);
              }}
            >
              <option value="">— none —</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={!templateId || drafting}
              onClick={() => applyTemplate(templateId, true)}
              title="Personalize the filled template with AI"
            >
              {drafting ? '…' : '✦ AI'}
            </Button>
          </div>
          {draftError ? <p className="mt-1 text-xs text-status-rejected">{draftError}</p> : null}
        </Field>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <Field>
          <Label htmlFor="o-channel">Channel</Label>
          <Select id="o-channel" name="channel" defaultValue={ctx.channel ?? ''}>
            <option value="">—</option>
            {CHANNELS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>
        <Field>
          <Label htmlFor="o-status">Status</Label>
          <Select id="o-status" name="status" defaultValue="Sent">
            {OUTREACH_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field>
        <Label htmlFor="o-subject">Subject</Label>
        <Input
          id="o-subject"
          name="subject"
          placeholder="Open application — Frontend"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />
      </Field>

      <Field>
        <Label htmlFor="o-body">Message</Label>
        <Textarea
          id="o-body"
          name="body"
          placeholder="What you sent…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field>
          <Label htmlFor="o-bump">Next bump</Label>
          <Input id="o-bump" name="next_bump_at" type="date" />
        </Field>
        <Field>
          <Label htmlFor="o-notes">Notes</Label>
          <Input id="o-notes" name="notes" />
        </Field>
      </div>

      {state?.error ? <p className="text-xs text-status-rejected">{state.error}</p> : null}

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? 'Logging…' : 'Log outreach'}
        </Button>
      </div>
    </form>
  );
}

export function LogOutreachButton({
  ctx,
  templates,
  label = 'Log',
  title = 'Log outreach',
  variant = 'ghost',
}: {
  ctx: OutreachContext;
  templates?: TemplateOption[];
  label?: string;
  title?: string;
  variant?: 'ghost' | 'secondary' | 'primary';
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} size="sm" onClick={() => setOpen(true)}>
        {label}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={title}>
        <OutreachForm ctx={ctx} templates={templates} onDone={() => setOpen(false)} />
      </Modal>
    </>
  );
}
