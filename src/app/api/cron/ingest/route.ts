import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { serverFetchContext } from '@/lib/sources';
import { executeIngestion } from '@/lib/discovery/ingest';
import { recordIngestionRun } from '@/lib/activity/record-run';
import { runScoringToCompletion } from '@/lib/ai/scoring-run';
import { SCORING_CRON_CAP } from '@/lib/constants';
import type { SourceRow } from '@/types/database';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Stop starting new scoring work this many ms into the run, leaving a buffer
// under maxDuration. Leftover unscored jobs roll into the next cron run.
const SCORING_DEADLINE_MS = 50_000;

// Scheduled ingestion. Vercel Cron calls this daily (see vercel.json) and, when
// CRON_SECRET is set, includes `Authorization: Bearer <CRON_SECRET>`. Idempotent:
// the (user_id, source, external_id) upsert preserves each job's user state.
export async function GET(request: NextRequest) {
  const startedMs = Date.now();
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get('authorization');
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Admin client failed.' },
      { status: 500 },
    );
  }

  const { data, error } = await admin.from('sources').select('*').eq('enabled', true);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  // Group enabled sources by owner so each user's jobs are written with their id.
  const byUser = new Map<string, SourceRow[]>();
  for (const s of (data ?? []) as SourceRow[]) {
    const list = byUser.get(s.user_id) ?? [];
    list.push(s);
    byUser.set(s.user_id, list);
  }

  const ctx = serverFetchContext();
  const summary: {
    users: number;
    totalFetched: number;
    totalNew: number;
    totalUpdated: number;
    totalScored: number;
    perUser: {
      userId: string;
      runId: string | null;
      fetched: number;
      new: number;
      updated: number;
      sources: number;
      status: string;
      scored?: number;
    }[];
  } = { users: byUser.size, totalFetched: 0, totalNew: 0, totalUpdated: 0, totalScored: 0, perUser: [] };

  for (const [userId, sources] of byUser) {
    const startedAt = new Date().toISOString();
    const outcome = await executeIngestion(
      admin,
      userId,
      sources.map((s) => ({ id: s.id, type: s.type, config: s.config })),
      ctx,
    );
    const finishedAt = new Date().toISOString();

    await admin
      .from('sources')
      .update({ last_run_at: finishedAt })
      .in('id', sources.map((s) => s.id));

    const runId = await recordIngestionRun(admin, userId, {
      trigger: 'cron',
      startedAt,
      finishedAt,
      outcome,
    });

    summary.totalFetched += outcome.fetched;
    summary.totalNew += outcome.new;
    summary.totalUpdated += outcome.updated;
    summary.perUser.push({
      userId,
      runId,
      fetched: outcome.fetched,
      new: outcome.new,
      updated: outcome.updated,
      sources: sources.length,
      status: outcome.status,
    });
  }

  // Auto-score: after ingestion, score each user's newly-ingested / still-unscored
  // jobs server-side in bounded chunks (one batched + cached call per chunk), so
  // the inbox is mostly pre-scored and the manual path rarely has a backlog. Hard
  // deadline keeps the whole phase under the function budget. No key → skipped.
  const scoringDeadline = startedMs + SCORING_DEADLINE_MS;
  for (const entry of summary.perUser) {
    if (Date.now() > scoringDeadline) break;
    const run = await runScoringToCompletion(
      admin,
      entry.userId,
      'cron',
      SCORING_CRON_CAP,
      scoringDeadline,
    );
    if (run) {
      entry.scored = run.completed;
      summary.totalScored += run.completed;
    }
  }

  return NextResponse.json({ ok: true, ...summary });
}
