'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { runUserIngestion, type IngestionSummary } from '@/lib/actions/jobs';
import { Button, Textarea } from './ui';
import { Modal } from './modal';

export function RefreshInboxButton() {
  const [pending, start] = useTransition();
  const [summary, setSummary] = useState<IngestionSummary | null>(null);
  const router = useRouter();

  return (
    <div className="flex items-center gap-2">
      {summary ? (
        <span className="text-xs text-muted">
          {summary.error
            ? summary.error
            : `+${summary.upserted} upserted from ${summary.perSource.length} source${
                summary.perSource.length === 1 ? '' : 's'
              }`}
        </span>
      ) : null}
      <Button
        variant="secondary"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await runUserIngestion();
            setSummary(res);
            router.refresh();
          })
        }
      >
        {pending ? 'Refreshing…' : '↻ Refresh inbox'}
      </Button>
    </div>
  );
}

export function ImportPasteButton() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [pending, start] = useTransition();
  const [result, setResult] = useState<string | null>(null);
  const router = useRouter();

  function submit() {
    setResult(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      setResult('Not valid JSON.');
      return;
    }
    start(async () => {
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed),
      });
      const data = await res.json();
      if (res.ok) {
        setResult(`Imported ${data.imported} job(s)${data.skipped ? `, skipped ${data.skipped}` : ''}.`);
        setText('');
        router.refresh();
      } else {
        setResult(data.error ?? 'Import failed.');
      }
    });
  }

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Paste import
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Import jobs (JSON)">
        <div className="space-y-3">
          <p className="text-xs text-muted">
            Paste an array of normalized jobs (or <code>{'{ "jobs": [...] }'}</code>). Each
            needs at least a <code>title</code>. This is the target for the Cowork
            on-demand recipe — see the README.
          </p>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder='[{ "title": "Senior Engineer", "company": "ASML", "url": "https://…" }]'
            className="min-h-[180px] font-mono text-xs"
          />
          {result ? <p className="text-xs text-muted">{result}</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Close
            </Button>
            <Button variant="primary" disabled={pending || !text.trim()} onClick={submit}>
              {pending ? 'Importing…' : 'Import'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
