import type { SupabaseClient } from '@supabase/supabase-js';
import type { ActivityType, Database } from '@/types/database';
import { buildActivitySummary, categoryFromType } from './summary';

export interface ActivityInput {
  type: ActivityType;
  entityType?: string | null;
  entityId?: string | null;
  // If omitted, derived from `type` + `meta` via buildActivitySummary.
  summary?: string;
  meta?: Record<string, unknown>;
}

// The single emission point for the unified activity feed. Called from every
// mutating Server Action (one event per user-meaningful action). Best-effort:
// a logging failure must never break the mutation it accompanies.
export async function logActivity(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: ActivityInput,
): Promise<void> {
  const meta = input.meta ?? {};
  const summary = input.summary ?? buildActivitySummary(input.type, meta);
  try {
    await supabase.from('activity_events').insert({
      user_id: userId,
      type: input.type,
      category: categoryFromType(input.type),
      entity_type: input.entityType ?? null,
      entity_id: input.entityId ?? null,
      summary,
      meta,
    });
  } catch {
    // Swallow — the activity log is a side-channel, never load-bearing.
  }
}
