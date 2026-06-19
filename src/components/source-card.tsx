'use client';

import { useOptimistic, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { deleteSource, toggleSource, updateSource } from '@/lib/actions/sources';
import { runSingleSource } from '@/lib/actions/jobs';
import type { IngestionSummary } from '@/lib/actions/jobs';
import { SOURCE_META } from '@/lib/constants';
import { formatDateTime } from '@/lib/utils';
import type { SourceRow } from '@/types/database';
import { HudFrame } from './hud-frame';
import { Button, Input, Label } from './ui';

function configName(config: Record<string, unknown>): string {
  return typeof config.name === 'string' ? config.name : '';
}

// One icon-button slot. Square, ghost, sharp — matches the command-center kit.
function IconButton({
  title,
  onClick,
  disabled,
  children,
  danger,
}: {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className={`flex h-7 w-7 items-center justify-center text-sm transition-colors disabled:opacity-50 ${
        danger
          ? 'text-faint hover:bg-status-rejected/10 hover:text-status-rejected'
          : 'text-faint hover:bg-surface-2 hover:text-system'
      }`}
    >
      {children}
    </button>
  );
}

export function SourceCard({ source }: { source: SourceRow }) {
  const meta = SOURCE_META[source.type];
  const router = useRouter();

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(configName(source.config));
  const [configText, setConfigText] = useState(JSON.stringify(source.config, null, 2));
  const [editError, setEditError] = useState<string | null>(null);

  const [run, setRun] = useState<IngestionSummary | null>(null);
  const [pending, start] = useTransition();
  // Optimistic enabled state so the toggle flips instantly; reconciles on the
  // server response (and reverts on failure when props re-sync).
  const [optimisticEnabled, setOptimisticEnabled] = useOptimistic(source.enabled);

  const friendlyName = configName(source.config);

  function doRun() {
    setEditError(null);
    start(async () => {
      const res = await runSingleSource(source.id);
      setRun(res);
      router.refresh();
    });
  }

  function doToggle() {
    const next = !source.enabled;
    start(async () => {
      setOptimisticEnabled(next);
      await toggleSource(source.id, next);
      router.refresh();
    });
  }

  function doDelete() {
    if (!confirm('Remove this source?')) return;
    start(async () => {
      await deleteSource(source.id);
      router.refresh();
    });
  }

  function doSave() {
    setEditError(null);
    start(async () => {
      const res = await updateSource(source.id, name, configText);
      if (res?.ok) {
        setEditing(false);
        router.refresh();
      } else {
        setEditError(res?.error ?? 'Could not save.');
      }
    });
  }

  function cancelEdit() {
    setName(configName(source.config));
    setConfigText(JSON.stringify(source.config, null, 2));
    setEditError(null);
    setEditing(false);
  }

  return (
    <HudFrame chamfer={['tl']} flush bodyClassName="px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-fg">{meta.label}</span>
            {friendlyName ? (
              <span className="truncate font-mono text-xs text-system">{friendlyName}</span>
            ) : null}
            {!optimisticEnabled ? (
              <span className="border border-border px-1.5 py-0.5 text-[10px] text-faint">
                disabled
              </span>
            ) : null}
          </div>
          {!editing ? (
            <>
              <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-all font-mono text-xs text-muted">
                {JSON.stringify(source.config)}
              </pre>
              <p className="mt-1 font-mono text-[11px] text-faint">
                {run && !run.error ? (
                  <span className="text-muted">
                    {run.fetched} fetched · {run.new} new · {run.updated} updated
                  </span>
                ) : run?.error ? (
                  <span className="text-status-rejected">{run.error}</span>
                ) : source.last_run_at ? (
                  `last run ${formatDateTime(source.last_run_at)}`
                ) : (
                  'never run'
                )}
              </p>
            </>
          ) : null}
        </div>

        {!editing ? (
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              role="switch"
              aria-checked={optimisticEnabled}
              disabled={pending}
              onClick={doToggle}
              className={`relative h-5 w-9 rounded-full transition-colors disabled:opacity-50 ${
                optimisticEnabled ? 'bg-accent' : 'border border-border bg-surface-2'
              }`}
              aria-label={optimisticEnabled ? 'Disable source' : 'Enable source'}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-bg transition-transform ${
                  optimisticEnabled ? 'translate-x-0.6' : 'translate-x-[-0.9rem]'
                }`}
              />
            </button>
            <IconButton title="Run this source" onClick={doRun} disabled={pending}>
              {pending ? '…' : '▶'}
            </IconButton>
            <IconButton title="Edit source" onClick={() => setEditing(true)} disabled={pending}>
              ✎
            </IconButton>
            <IconButton title="Remove source" onClick={doDelete} disabled={pending} danger>
              ✕
            </IconButton>
          </div>
        ) : null}
      </div>

      {editing ? (
        <div className="mt-3 space-y-3 border-t border-border pt-3">
          <div>
            <Label htmlFor={`name-${source.id}`}>Name (optional)</Label>
            <Input
              id={`name-${source.id}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={meta.label}
            />
          </div>
          <div>
            <Label htmlFor={`config-${source.id}`}>Config (JSON)</Label>
            <textarea
              id={`config-${source.id}`}
              value={configText}
              onChange={(e) => setConfigText(e.target.value)}
              className="min-h-[120px] w-full resize-y border border-system/30 bg-surface-2 px-3 py-2 font-mono text-xs text-fg focus:border-system focus:shadow-[var(--glow-system)] focus:outline-none"
            />
            <p className="mt-1 text-xs text-faint">Fields: {meta.configHint}</p>
          </div>
          {editError ? <p className="text-xs text-status-rejected">{editError}</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={cancelEdit} disabled={pending}>
              Cancel
            </Button>
            <Button variant="primary" onClick={doSave} disabled={pending}>
              {pending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      ) : null}
    </HudFrame>
  );
}
