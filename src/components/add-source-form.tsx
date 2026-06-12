'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createSource } from '@/lib/actions/sources';
import { SOURCE_META, SOURCE_TYPES } from '@/lib/constants';
import type { SourceType } from '@/types/database';
import { Button, Label, Select } from './ui';
import { Modal } from './modal';

const EXAMPLE_CONFIG: Record<SourceType, string> = {
  adzuna:
    '{ "query": "react", "where": "Eindhoven", "country": "nl", "salary_min": 50000, "max_days_old": 14, "full_time": true, "pages": 1 }',
  arbeitnow: '{ "remote": true }',
  remotive: '{ "search": "react", "limit": 50 }',
  remoteok: '{ "tags": "react,typescript" }',
  greenhouse: '{ "token": "stripe", "name": "Stripe" }',
  lever: '{ "token": "netflix", "name": "Netflix" }',
  ashby: '{ "token": "ramp", "name": "Ramp" }',
  workable: '{ "token": "acme", "name": "Acme" }',
  recruitee: '{ "token": "acme", "name": "Acme" }',
  smartrecruiters: '{ "token": "bosch", "name": "Bosch" }',
};

export function AddSourceButton() {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<SourceType>('adzuna');
  const [config, setConfig] = useState(EXAMPLE_CONFIG.adzuna);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res = await createSource(null, fd);
      if (res?.ok) {
        router.refresh();
        setOpen(false);
      } else {
        setError(res?.error ?? 'Could not add source.');
      }
    });
  }

  const meta = SOURCE_META[type];

  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>
        + Add source
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Add a source">
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <Label htmlFor="type">Source</Label>
            <Select
              id="type"
              name="type"
              value={type}
              onChange={(e) => {
                const t = e.target.value as SourceType;
                setType(t);
                setConfig(EXAMPLE_CONFIG[t]);
              }}
            >
              {SOURCE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {SOURCE_META[t].label}
                </option>
              ))}
            </Select>
            <p className="mt-1 text-xs text-muted">{meta.apiNote}</p>
          </div>

          <div>
            <Label htmlFor="config">Config (JSON)</Label>
            <textarea
              id="config"
              name="config"
              value={config}
              onChange={(e) => setConfig(e.target.value)}
              className="min-h-[96px] w-full resize-y rounded-md border border-border bg-bg px-3 py-2 font-mono text-xs text-fg focus:border-accent focus:outline-none"
            />
            <p className="mt-1 text-xs text-faint">Fields: {meta.configHint}</p>
          </div>

          {error ? <p className="text-xs text-status-rejected">{error}</p> : null}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? 'Adding…' : 'Add source'}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
