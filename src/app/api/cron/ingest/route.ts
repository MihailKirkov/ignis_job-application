import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { serverFetchContext } from '@/lib/sources';
import { executeIngestion } from '@/lib/discovery/ingest';
import { recordIngestionRun } from '@/lib/activity/record-run';
import type { SourceRow } from '@/types/database';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Scheduled ingestion. Vercel Cron calls this daily (see vercel.json) and, when
// CRON_SECRET is set, includes `Authorization: Bearer <CRON_SECRET>`. Idempotent:
// the (user_id, source, external_id) upsert preserves each job's user state.
export async function GET(request: NextRequest) {
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
    perUser: {
      userId: string;
      runId: string | null;
      fetched: number;
      new: number;
      updated: number;
      sources: number;
      status: string;
    }[];
  } = { users: byUser.size, totalFetched: 0, totalNew: 0, totalUpdated: 0, perUser: [] };

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

  return NextResponse.json({ ok: true, ...summary });
}
