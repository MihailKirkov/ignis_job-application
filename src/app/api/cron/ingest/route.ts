import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { serverFetchContext } from '@/lib/sources';
import { runFetchers, persistJobs } from '@/lib/discovery/ingest';
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
  const ranAt = new Date().toISOString();
  const summary: {
    users: number;
    totalUpserted: number;
    perUser: { userId: string; upserted: number; sources: number; errors: string[] }[];
  } = { users: byUser.size, totalUpserted: 0, perUser: [] };

  for (const [userId, sources] of byUser) {
    const { jobs, results } = await runFetchers(
      sources.map((s) => ({ id: s.id, type: s.type, config: s.config })),
      ctx,
    );
    let upserted = 0;
    const errors = results.filter((r) => r.error).map((r) => `${r.type}: ${r.error}`);
    try {
      upserted = await persistJobs(admin, userId, jobs);
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
    await admin
      .from('sources')
      .update({ last_run_at: ranAt })
      .in('id', sources.map((s) => s.id));

    summary.totalUpserted += upserted;
    summary.perUser.push({ userId, upserted, sources: sources.length, errors });
  }

  return NextResponse.json({ ok: true, ranAt, ...summary });
}
