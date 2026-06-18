import { createClient } from '@/lib/supabase/server';
import type { SourceRow } from '@/types/database';
import { AddSourceButton } from '@/components/add-source-form';
import { SourceCard } from '@/components/source-card';
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
          {sources.map((s) => (
            <SourceCard key={s.id} source={s} />
          ))}
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
