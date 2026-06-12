'use client';

import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { SOURCE_META, SOURCE_TYPES } from '@/lib/constants';
import { Button, Input, Label, Select } from './ui';
import { cn } from '@/lib/utils';

const MODES = ['On-site', 'Hybrid', 'Remote'] as const;
const SENIORITIES = ['intern', 'junior', 'medior', 'senior', 'lead', 'principal'] as const;
const FILTER_KEYS = [
  'inc', 'incMatch', 'exc', 'loc', 'locText', 'salaryMin', 'sen', 'mode', 'days', 'src', 'lang',
  'minFit',
];

function CheckChip({
  checked,
  onClick,
  children,
}: {
  checked: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onClick}
      className={cn(
        'rounded-full border px-2.5 py-1 text-xs capitalize transition-colors',
        checked
          ? 'border-accent/40 bg-accent-soft text-fg'
          : 'border-border text-muted hover:text-fg',
      )}
    >
      {children}
    </button>
  );
}

export function FilterPanel() {
  const router = useRouter();
  const sp = useSearchParams();
  const stateParam = sp.get('state') ?? 'new';

  const activeCount = useMemo(
    () => FILTER_KEYS.filter((k) => sp.get(k)).length,
    [sp],
  );

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>(() => {
    const d: Record<string, string> = {};
    for (const k of FILTER_KEYS) {
      const v = sp.get(k);
      if (v) d[k] = v;
    }
    return d;
  });

  function setKey(k: string, v: string) {
    setDraft((prev) => {
      const next = { ...prev };
      if (v) next[k] = v;
      else delete next[k];
      return next;
    });
  }

  function listOf(k: string): string[] {
    return (draft[k] ?? '').split(',').filter(Boolean);
  }
  function toggleInList(k: string, value: string) {
    const cur = listOf(k);
    const next = cur.includes(value) ? cur.filter((x) => x !== value) : [...cur, value];
    setKey(k, next.join(','));
  }

  function apply() {
    const params = new URLSearchParams();
    params.set('state', stateParam);
    for (const [k, v] of Object.entries(draft)) if (v) params.set(k, v);
    router.replace(`/discovery?${params.toString()}`);
    setOpen(false);
  }

  function clear() {
    setDraft({});
    router.replace(`/discovery?state=${stateParam}`);
    setOpen(false);
  }

  return (
    <div className="rounded-[10px] border border-border bg-surface">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-2.5 text-sm text-fg"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          Filters
          {activeCount > 0 ? (
            <span className="rounded-full bg-accent px-1.5 py-0.5 font-mono text-[10px] font-semibold text-accent-fg">
              {activeCount}
            </span>
          ) : null}
        </span>
        <span className="text-muted">{open ? '▲' : '▼'}</span>
      </button>

      {open ? (
        <div className="space-y-4 border-t border-border p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="inc">Include keywords / stack</Label>
              <Input
                id="inc"
                placeholder="react, typescript"
                defaultValue={draft.inc ?? ''}
                onChange={(e) => setKey('inc', e.target.value)}
              />
              <div className="mt-1 flex items-center gap-2 text-xs text-muted">
                match
                <Select
                  aria-label="Include match mode"
                  className="h-7 w-auto py-0 text-xs"
                  value={draft.incMatch ?? 'any'}
                  onChange={(e) => setKey('incMatch', e.target.value === 'all' ? 'all' : '')}
                >
                  <option value="any">any</option>
                  <option value="all">all</option>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="exc">Exclude keywords</Label>
              <Input
                id="exc"
                placeholder="php, wordpress"
                defaultValue={draft.exc ?? ''}
                onChange={(e) => setKey('exc', e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="loc">Location</Label>
              <Select
                id="loc"
                value={draft.loc ?? 'any'}
                onChange={(e) => setKey('loc', e.target.value === 'any' ? '' : e.target.value)}
              >
                <option value="any">Anywhere</option>
                <option value="eindhoven">Eindhoven + radius</option>
                <option value="nl">Netherlands</option>
                <option value="remote">Remote</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="salaryMin">Min salary</Label>
              <Input
                id="salaryMin"
                type="number"
                placeholder="50000"
                defaultValue={draft.salaryMin ?? ''}
                onChange={(e) => setKey('salaryMin', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="days">Posted within</Label>
              <Select
                id="days"
                value={draft.days ?? ''}
                onChange={(e) => setKey('days', e.target.value)}
              >
                <option value="">Any time</option>
                <option value="3">3 days</option>
                <option value="7">7 days</option>
                <option value="14">14 days</option>
                <option value="30">30 days</option>
              </Select>
            </div>
          </div>

          <div>
            <Label>Work mode</Label>
            <div className="flex flex-wrap gap-1.5">
              {MODES.map((m) => (
                <CheckChip
                  key={m}
                  checked={listOf('mode').includes(m)}
                  onClick={() => toggleInList('mode', m)}
                >
                  {m}
                </CheckChip>
              ))}
            </div>
          </div>

          <div>
            <Label>Seniority</Label>
            <div className="flex flex-wrap gap-1.5">
              {SENIORITIES.map((s) => (
                <CheckChip
                  key={s}
                  checked={listOf('sen').includes(s)}
                  onClick={() => toggleInList('sen', s)}
                >
                  {s}
                </CheckChip>
              ))}
            </div>
          </div>

          <div>
            <Label>Source</Label>
            <div className="flex flex-wrap gap-1.5">
              {SOURCE_TYPES.map((s) => (
                <CheckChip
                  key={s}
                  checked={listOf('src').includes(s)}
                  onClick={() => toggleInList('src', s)}
                >
                  {SOURCE_META[s].label.split(' ')[0]}
                </CheckChip>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Select
                aria-label="Language"
                className="h-9 w-auto"
                value={draft.lang ?? ''}
                onChange={(e) => setKey('lang', e.target.value)}
              >
                <option value="">Any language</option>
                <option value="en">English</option>
                <option value="nl">Dutch</option>
              </Select>
              <Select
                aria-label="Minimum fit score"
                className="h-9 w-auto"
                value={draft.minFit ?? ''}
                onChange={(e) => setKey('minFit', e.target.value)}
              >
                <option value="">Any fit</option>
                <option value="50">Fit ≥ 50</option>
                <option value="70">Fit ≥ 70</option>
                <option value="80">Fit ≥ 80</option>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={clear}>
                Clear
              </Button>
              <Button variant="primary" onClick={apply}>
                Apply filters
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
