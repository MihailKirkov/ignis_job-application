import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { parseImportPayload } from '@/lib/discovery/import-schema';
import { persistJobs } from '@/lib/discovery/ingest';

// POST /api/import — accepts an array of normalized jobs (or { jobs: [...] }) and
// upserts them into the signed-in user's inbox. Session-protected; RLS scopes the
// write to the current user (no service-role secret involved). This is the target
// for the Cowork on-demand recipe and the in-app paste-import box.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body.' }, { status: 400 });
  }

  const { jobs, errors } = parseImportPayload(body);
  if (jobs.length === 0) {
    return NextResponse.json(
      { ok: false, error: 'No valid jobs in payload.', errors },
      { status: 400 },
    );
  }

  try {
    const { fetched, new: created, updated } = await persistJobs(supabase, user.id, jobs);
    return NextResponse.json({
      ok: true,
      imported: fetched,
      new: created,
      updated,
      skipped: errors.length,
      errors,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Import failed.' },
      { status: 500 },
    );
  }
}
