import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, IngestionTrigger } from '@/types/database';
import type { IngestionOutcome } from '@/lib/discovery/ingest';
import { logActivity } from './log';

// Strip anything secret-shaped out of a stored message: full query strings, and
// common key params even when not part of a URL. Never persist URLs with keys.
export function redactSecrets(message: string | null): string | null {
  if (!message) return message;
  return message
    // drop the query string of any URL
    .replace(/(https?:\/\/[^\s?]+)\?[^\s]*/gi, '$1')
    // belt-and-braces: redact common secret params anywhere
    .replace(/\b(app_key|app_id|api_key|apikey|key|token|secret|password)=[^\s&]+/gi, '$1=***');
}

export interface RecordRunInput {
  trigger: IngestionTrigger;
  startedAt: string;
  finishedAt: string;
  outcome: IngestionOutcome;
}

// Persist one ingestion run + its per-source breakdown, then emit a single
// `ingestion.completed` activity event referencing the run. Returns the run id
// (or null if the run row couldn't be written — never throws into the caller).
export async function recordIngestionRun(
  supabase: SupabaseClient<Database>,
  userId: string,
  { trigger, startedAt, finishedAt, outcome }: RecordRunInput,
): Promise<string | null> {
  const durationMs = new Date(finishedAt).getTime() - new Date(startedAt).getTime();

  const { data: run, error } = await supabase
    .from('ingestion_runs')
    .insert({
      user_id: userId,
      trigger,
      status: outcome.status,
      sources_run: outcome.sourcesRun,
      jobs_fetched: outcome.fetched,
      jobs_new: outcome.new,
      jobs_updated: outcome.updated,
      started_at: startedAt,
      finished_at: finishedAt,
      duration_ms: durationMs,
    })
    .select('id')
    .single();

  if (error || !run) return null;
  const runId = (run as { id: string }).id;

  if (outcome.sources.length > 0) {
    await supabase.from('ingestion_run_sources').insert(
      outcome.sources.map((s) => ({
        run_id: runId,
        user_id: userId,
        source_id: s.sourceId,
        source_type: s.type,
        source_label: s.label,
        status: s.status,
        http_status: s.httpStatus,
        jobs_fetched: s.fetched,
        jobs_new: s.new,
        jobs_updated: s.updated,
        duration_ms: s.durationMs,
        message: redactSecrets(s.message),
      })),
    );
  }

  await logActivity(supabase, userId, {
    type: 'ingestion.completed',
    entityType: 'ingestion_run',
    entityId: runId,
    meta: {
      run_id: runId,
      status: outcome.status,
      sources_run: outcome.sourcesRun,
      fetched: outcome.fetched,
      new: outcome.new,
      updated: outcome.updated,
    },
  });

  return runId;
}
