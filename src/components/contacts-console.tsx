'use client';

import { useMemo, useState } from 'react';
import type { ContactRow } from '@/types/database';
import { formatDate, isDueOrOverdue } from '@/lib/utils';
import { HudFrame } from './hud-frame';
import { EditContactButton, type CompanyOption } from './contact-dialog';
import { DeleteContactButton } from './contact-actions';
import { LogOutreachButton, type TemplateOption } from './outreach-dialog';

type SortKey = 'name' | 'company' | 'role' | 'email' | 'last' | 'follow';

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'name', label: 'NAME' },
  { key: 'company', label: 'COMPANY' },
  { key: 'role', label: 'ROLE' },
  { key: 'email', label: 'EMAIL' },
  { key: 'last', label: 'LAST' },
  { key: 'follow', label: 'FOLLOW-UP' },
];

function sortValue(
  row: ContactRow,
  key: SortKey,
  companyNames: Record<string, string>,
): string {
  switch (key) {
    case 'name':
      return row.name.toLowerCase();
    case 'company':
      return (row.company_id ? companyNames[row.company_id] ?? '' : '').toLowerCase();
    case 'role':
      return (row.role ?? '').toLowerCase();
    case 'email':
      return (row.email ?? '').toLowerCase();
    case 'last':
      return row.last_contacted_at ?? '';
    case 'follow':
      return row.next_follow_up_at ?? '9999-12-31';
  }
}

export function ContactsConsole({
  contacts,
  companyNames,
  companies,
  templates = [],
}: {
  contacts: ContactRow[];
  companyNames: Record<string, string>;
  companies: CompanyOption[];
  templates?: TemplateOption[];
}) {
  const [sortKey, setSortKey] = useState<SortKey>('follow');
  const [asc, setAsc] = useState(true);

  const sorted = useMemo(() => {
    const rows = [...contacts];
    rows.sort((a, b) => {
      const va = sortValue(a, sortKey, companyNames);
      const vb = sortValue(b, sortKey, companyNames);
      if (va < vb) return asc ? -1 : 1;
      if (va > vb) return asc ? 1 : -1;
      return 0;
    });
    return rows;
  }, [contacts, sortKey, asc, companyNames]);

  function toggle(key: SortKey) {
    if (key === sortKey) setAsc((v) => !v);
    else {
      setSortKey(key);
      setAsc(true);
    }
  }

  const widths = ['18%', '14%', '12%', '18%', '10%', '11%', '17%'];

  return (
    <HudFrame flush chamfer={['tl', 'br']} accentTone="system">
      <div className="max-h-[calc(100dvh-300px)] overflow-y-auto overflow-x-hidden">
        <table className="w-full table-fixed border-collapse font-mono text-xs">
          <colgroup>
            {widths.map((w, i) => (
              <col key={i} style={{ width: w }} />
            ))}
          </colgroup>
          <thead>
            <tr className="border-b border-border bg-surface">
              {COLUMNS.map((c) => (
                <th
                  key={c.key}
                  className="sticky top-0 z-10 bg-surface px-3 py-2.5 text-left font-normal"
                >
                  <button
                    type="button"
                    onClick={() => toggle(c.key)}
                    className={
                      'inline-flex items-center gap-1 uppercase tracking-wider transition-colors ' +
                      (sortKey === c.key ? 'text-system' : 'text-faint hover:text-muted')
                    }
                  >
                    {c.label}
                    {sortKey === c.key ? (
                      <span className="text-[9px]">{asc ? '▲' : '▼'}</span>
                    ) : null}
                  </button>
                </th>
              ))}
              <th className="sticky top-0 z-10 bg-surface px-3 py-2.5" aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => {
              const company = row.company_id ? companyNames[row.company_id] : undefined;
              const followDue = isDueOrOverdue(row.next_follow_up_at);
              return (
                <tr
                  key={row.id}
                  className="border-b border-border/50 transition-colors last:border-0 hover:bg-[color-mix(in_srgb,var(--color-system)_8%,transparent)]"
                >
                  <td className="truncate px-3 py-2 text-fg" title={row.name}>
                    {row.linkedin_url ? (
                      <a
                        href={row.linkedin_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="transition-colors hover:text-system"
                      >
                        {row.name}
                      </a>
                    ) : (
                      row.name
                    )}
                  </td>
                  <td className="truncate px-3 py-2 text-muted" title={company}>
                    {company ? (
                      <a
                        href={`/contacts?company=${row.company_id}`}
                        className="transition-colors hover:text-system"
                      >
                        {company}
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="truncate px-3 py-2 text-muted" title={row.role ?? undefined}>
                    {row.role ?? '—'}
                  </td>
                  <td className="truncate px-3 py-2 text-muted" title={row.email ?? undefined}>
                    {row.email ? (
                      <a
                        href={`mailto:${row.email}`}
                        className="transition-colors hover:text-system"
                      >
                        {row.email}
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="truncate px-3 py-2 text-faint">
                    {row.last_contacted_at ? formatDate(row.last_contacted_at) : '—'}
                  </td>
                  <td className="truncate px-3 py-2">
                    <span className={followDue ? 'text-accent' : 'text-muted'}>
                      {row.next_follow_up_at
                        ? `${formatDate(row.next_follow_up_at)}${followDue ? ' ⚠' : ''}`
                        : '—'}
                    </span>
                  </td>
                  <td className="px-1 py-1 text-right">
                    <span className="flex items-center justify-end">
                      <LogOutreachButton
                        ctx={{
                          contactId: row.id,
                          companyId: row.company_id,
                          companyName: company,
                          channel: row.channel,
                        }}
                        templates={templates}
                      />
                      <EditContactButton row={row} companyName={company} companies={companies} />
                      <DeleteContactButton id={row.id} />
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </HudFrame>
  );
}
