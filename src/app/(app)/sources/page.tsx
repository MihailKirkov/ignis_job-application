import { createClient } from '@/lib/supabase/server';
import { SOURCE_META } from '@/lib/constants';
import { formatDate } from '@/lib/utils';
import type { SourceRow } from '@/types/database';
import { AddSourceButton } from '@/components/add-source-form';
import { DeleteSourceButton, ToggleSourceButton } from '@/components/source-controls';
import { RefreshInboxButton } from '@/components/discovery-actions';
import { EmptyState } from '@/components/ui';

export default async function SourcesPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('sources')
    .select('*')
    .order('created_at', { ascending: true });
  const sources = (data ?? []) as SourceRow[];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-fg">Sources</h1>
          <p className="text-sm text-muted">
            Job feeds and target-company ATS boards to ingest.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RefreshInboxButton />
          <AddSourceButton />
        </div>
      </header>

      {sources.length === 0 ? (
        <EmptyState
          title="No sources yet"
          hint="Add Adzuna for NL/remote search, or a Greenhouse/Lever/Ashby/Workable token for a target Brainport company."
        />
      ) : (
        <div className="grid gap-2">
          {sources.map((s) => {
            const meta = SOURCE_META[s.type];
            return (
              <div
                key={s.id}
                className="flex items-start justify-between gap-3 rounded-[10px] border border-border bg-surface p-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-fg">{meta.label}</span>
                    {!s.enabled ? (
                      <span className="rounded-full border border-border px-1.5 py-0.5 text-[10px] text-faint">
                        disabled
                      </span>
                    ) : null}
                  </div>
                  <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-all font-mono text-xs text-muted">
                    {JSON.stringify(s.config)}
                  </pre>
                  <p className="mt-1 font-mono text-[11px] text-faint">
                    {s.last_run_at ? `last run ${formatDate(s.last_run_at)}` : 'never run'}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <ToggleSourceButton id={s.id} enabled={s.enabled} />
                  <DeleteSourceButton id={s.id} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-faint">
        Adzuna needs <code>ADZUNA_APP_ID</code> / <code>ADZUNA_APP_KEY</code> in env.
        ATS tokens are the public board slugs (not secrets). Sources respect each
        provider&apos;s terms — no scraping.
      </p>
    </div>
  );
}
