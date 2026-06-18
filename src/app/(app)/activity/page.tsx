import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { ACTIVITY_CATEGORIES, ACTIVITY_CATEGORY_COLOR, ACTIVITY_CATEGORY_ICON } from '@/lib/constants';
import { formatDateTime } from '@/lib/utils';
import { activityHref } from '@/lib/activity/feed';
import type {
  ActivityCategory,
  ActivityEventRow,
  IngestionRunSourceRow,
} from '@/types/database';
import { HudFrame } from '@/components/hud-frame';
import { StatusLed } from '@/components/hud';
import { EmptyState, Label } from '@/components/ui';

const PAGE_SIZE = 25;

type SearchParams = Promise<{ category?: string; from?: string; to?: string; page?: string }>;

type FeedEvent = Pick<
  ActivityEventRow,
  'id' | 'type' | 'category' | 'summary' | 'meta' | 'created_at'
>;

export default async function ActivityPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const category = ACTIVITY_CATEGORIES.includes(sp.category as ActivityCategory)
    ? (sp.category as ActivityCategory)
    : undefined;
  const from = sp.from?.trim() || undefined;
  const to = sp.to?.trim() || undefined;
  const page = Math.max(1, Number(sp.page) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const supabase = await createClient();
  let query = supabase
    .from('activity_events')
    .select('id, type, category, summary, meta, created_at', { count: 'exact' })
    .order('created_at', { ascending: false });
  if (category) query = query.eq('category', category);
  if (from) query = query.gte('created_at', `${from}T00:00:00`);
  if (to) query = query.lte('created_at', `${to}T23:59:59`);
  query = query.range(offset, offset + PAGE_SIZE - 1);

  const { data, count } = await query;
  const events = (data ?? []) as FeedEvent[];
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Pre-fetch per-source breakdowns for the ingestion rows on this page so they
  // can expand without client JS (native <details>).
  const runIds = events
    .filter((e) => e.type === 'ingestion.completed')
    .map((e) => (typeof e.meta?.run_id === 'string' ? e.meta.run_id : null))
    .filter((id): id is string => Boolean(id));
  const breakdowns = new Map<string, IngestionRunSourceRow[]>();
  if (runIds.length > 0) {
    const { data: rs } = await supabase
      .from('ingestion_run_sources')
      .select('*')
      .in('run_id', runIds)
      .order('source_label', { ascending: true });
    for (const row of (rs ?? []) as IngestionRunSourceRow[]) {
      const list = breakdowns.get(row.run_id) ?? [];
      list.push(row);
      breakdowns.set(row.run_id, list);
    }
  }

  function pageHref(p: number) {
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (p > 1) params.set('page', String(p));
    const q = params.toString();
    return q ? `/activity?${q}` : '/activity';
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold text-fg">Activity</h1>
        <p className="text-sm text-muted">Every action across the command center.</p>
      </header>

      {/* ---- Filters ---- */}
      <HudFrame label="FILTER" chamfer={['tl', 'br']} bodyClassName="px-3.5 py-3">
        <form method="get" className="flex flex-wrap items-end gap-3">
          <div className="min-w-[150px]">
            <Label htmlFor="category">Category</Label>
            <select
              id="category"
              name="category"
              defaultValue={category ?? ''}
              className="hud-field hud-select h-9 px-3 py-2 text-sm"
            >
              <option value="">All</option>
              {ACTIVITY_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="from">From</Label>
            <input
              id="from"
              name="from"
              type="date"
              defaultValue={from ?? ''}
              className="hud-field h-9 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <Label htmlFor="to">To</Label>
            <input
              id="to"
              name="to"
              type="date"
              defaultValue={to ?? ''}
              className="hud-field h-9 px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            className="hud-cut h-9 bg-accent px-3.5 text-sm font-medium text-accent-fg hover:brightness-95"
          >
            Apply
          </button>
          {category || from || to ? (
            <Link
              href="/activity"
              className="flex h-9 items-center px-2 text-sm text-muted hover:text-fg"
            >
              Clear
            </Link>
          ) : null}
        </form>
      </HudFrame>

      {/* ---- Feed ---- */}
      {events.length === 0 ? (
        <EmptyState
          title="No activity yet"
          hint="Actions you take — applications, jobs, sources, ingestion runs — show up here."
        />
      ) : (
        <HudFrame
          label="EVENT LOG"
          chamfer={['tl']}
          right={<span className="font-mono text-[11px] text-faint">{total} TOTAL</span>}
        >
          <ul className="flex flex-col divide-y divide-border">
            {events.map((e) => {
              const color = ACTIVITY_CATEGORY_COLOR[e.category] ?? 'system';
              const sources = e.type === 'ingestion.completed'
                ? breakdowns.get(typeof e.meta?.run_id === 'string' ? e.meta.run_id : '')
                : undefined;
              return (
                <li key={e.id} className="py-2.5 first:pt-0 last:pb-0">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex items-center gap-2">
                      <StatusLed colorToken={color} size={7} />
                      <span
                        className="font-mono text-[10px] tracking-wide"
                        style={{ color: `var(--color-${color})` }}
                      >
                        {ACTIVITY_CATEGORY_ICON[e.category]}
                      </span>
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <Link
                          href={activityHref(e)}
                          className="truncate text-sm text-fg transition-colors hover:text-system"
                        >
                          {e.summary}
                        </Link>
                        <span className="shrink-0 font-mono text-[11px] tabular-nums text-faint">
                          {formatDateTime(e.created_at)}
                        </span>
                      </div>

                      {sources && sources.length > 0 ? (
                        <details className="mt-1.5">
                          <summary className="cursor-pointer font-mono text-[11px] text-muted hover:text-system">
                            {sources.length} source{sources.length === 1 ? '' : 's'} · breakdown
                          </summary>
                          <table className="mt-2 w-full font-mono text-[11px]">
                            <thead className="text-faint">
                              <tr className="text-left">
                                <th className="py-1 pr-3 font-normal">Source</th>
                                <th className="py-1 pr-3 font-normal">Status</th>
                                <th className="py-1 pr-3 font-normal text-right">Fetched</th>
                                <th className="py-1 pr-3 font-normal text-right">New</th>
                                <th className="py-1 pr-3 font-normal text-right">Updated</th>
                                <th className="py-1 font-normal">Note</th>
                              </tr>
                            </thead>
                            <tbody className="text-muted">
                              {sources.map((s) => (
                                <tr key={s.id} className="border-t border-border/50">
                                  <td className="py-1 pr-3 text-fg">{s.source_label ?? s.source_type}</td>
                                  <td className="py-1 pr-3">
                                    <span
                                      style={{
                                        color:
                                          s.status === 'error'
                                            ? 'var(--color-status-rejected)'
                                            : s.status === 'skipped'
                                              ? 'var(--color-faint)'
                                              : 'var(--color-status-offer)',
                                      }}
                                    >
                                      {s.status}
                                      {s.http_status ? ` ${s.http_status}` : ''}
                                    </span>
                                  </td>
                                  <td className="py-1 pr-3 text-right tabular-nums">{s.jobs_fetched}</td>
                                  <td className="py-1 pr-3 text-right tabular-nums">{s.jobs_new}</td>
                                  <td className="py-1 pr-3 text-right tabular-nums">{s.jobs_updated}</td>
                                  <td className="py-1 text-faint">{s.message ?? '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </details>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </HudFrame>
      )}

      {/* ---- Pagination ---- */}
      {totalPages > 1 ? (
        <div className="flex items-center justify-between font-mono text-xs text-muted">
          {page > 1 ? (
            <Link href={pageHref(page - 1)} className="hover:text-system">
              ← Newer
            </Link>
          ) : (
            <span className="text-faint">← Newer</span>
          )}
          <span className="text-faint">
            Page {page} / {totalPages}
          </span>
          {page < totalPages ? (
            <Link href={pageHref(page + 1)} className="hover:text-system">
              Older →
            </Link>
          ) : (
            <span className="text-faint">Older →</span>
          )}
        </div>
      ) : null}
    </div>
  );
}
