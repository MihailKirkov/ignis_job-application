'use client';

import { useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { deleteFilter, saveFilter } from '@/lib/actions/filters';
import { Button } from './ui';

const FILTER_KEYS = [
  'inc', 'incMatch', 'exc', 'loc', 'locText', 'salaryMin', 'sen', 'mode', 'days', 'src', 'lang',
];

export interface PresetItem {
  id: string;
  name: string;
  criteria: Record<string, string>;
}

export function PresetBar({ presets }: { presets: PresetItem[] }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, start] = useTransition();
  const stateParam = sp.get('state') ?? 'new';

  function apply(criteria: Record<string, string>) {
    const params = new URLSearchParams();
    params.set('state', stateParam);
    for (const [k, v] of Object.entries(criteria)) if (v) params.set(k, v);
    router.replace(`/discovery?${params.toString()}`);
  }

  function currentCriteria(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const k of FILTER_KEYS) {
      const v = sp.get(k);
      if (v) out[k] = v;
    }
    return out;
  }

  function onSave() {
    const criteria = currentCriteria();
    if (Object.keys(criteria).length === 0) {
      alert('Set at least one filter before saving a preset.');
      return;
    }
    const name = prompt('Preset name?');
    if (!name) return;
    start(async () => {
      const res = await saveFilter(name, criteria);
      if (!res.ok) alert(res.error ?? 'Could not save preset.');
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-faint">Presets:</span>
      {presets.length === 0 ? (
        <span className="text-xs text-faint">none saved</span>
      ) : (
        presets.map((p) => (
          <span
            key={p.id}
            className="group inline-flex items-center gap-1 border border-system/25 bg-surface-2 pl-2.5 pr-1 py-0.5 text-xs text-fg"
          >
            <button type="button" onClick={() => apply(p.criteria)} className="hover:text-system">
              {p.name}
            </button>
            <button
              type="button"
              aria-label={`Delete preset ${p.name}`}
              disabled={pending}
              onClick={() =>
                start(async () => {
                  await deleteFilter(p.id);
                  router.refresh();
                })
              }
              className="px-1 text-faint hover:text-status-rejected"
            >
              ✕
            </button>
          </span>
        ))
      )}
      <Button variant="ghost" size="sm" onClick={onSave} disabled={pending}>
        + Save current
      </Button>
    </div>
  );
}
