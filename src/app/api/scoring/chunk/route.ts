import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { processChunk } from '@/lib/ai/scoring-run';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Process ONE chunk of a scoring run: one batched + prompt-cached Anthropic call
// scoring up to BATCH_SCORE_CAP jobs, writing their fit columns and bumping the
// run counters. The Discovery client calls this repeatedly until `done`, updating
// the progress indicator and filling each fit badge from `updated`. RLS scopes
// the run + jobs to the signed-in user.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  let runId: unknown;
  try {
    ({ runId } = await request.json());
  } catch {
    runId = null;
  }
  if (typeof runId !== 'string' || !runId) {
    return NextResponse.json({ ok: false, error: 'Missing runId.' }, { status: 400 });
  }

  const result = await processChunk(supabase, user.id, runId);
  return NextResponse.json(result);
}
