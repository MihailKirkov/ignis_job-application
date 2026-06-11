'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useRef, useState } from 'react';
import { APPLICATION_STATUSES } from '@/lib/constants';
import { Input, Select } from './ui';

// Status filter + free-text search, both reflected in the URL so the server
// component can read them. Debounced search keeps typing snappy.
export function TrackerToolbar() {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`/tracker?${next.toString()}`);
  }

  function onSearch(value: string) {
    setQ(value);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setParam('q', value), 250);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        type="search"
        placeholder="Search company, role, notes…"
        value={q}
        onChange={(e) => onSearch(e.target.value)}
        className="h-9 w-full sm:w-64"
      />
      <Select
        value={params.get('status') ?? ''}
        onChange={(e) => setParam('status', e.target.value)}
        className="h-9 w-auto"
        aria-label="Filter by status"
      >
        <option value="">All statuses</option>
        {APPLICATION_STATUSES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </Select>
    </div>
  );
}
