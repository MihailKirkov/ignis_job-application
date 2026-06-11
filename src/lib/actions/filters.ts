'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/supabase/auth';

// Presets store the flat param record (criteriaToParams output), so applying a
// preset is just pushing those keys onto the discovery URL.
export async function saveFilter(
  name: string,
  criteria: Record<string, string>,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: 'Name is required.' };
  if (Object.keys(criteria).length === 0) {
    return { ok: false, error: 'Set at least one filter before saving.' };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from('saved_filters')
    .insert({ user_id: user.id, name: trimmed, criteria });
  if (error) return { ok: false, error: error.message };
  revalidatePath('/discovery');
  return { ok: true };
}

export async function deleteFilter(id: string): Promise<void> {
  await requireUser();
  const supabase = await createClient();
  await supabase.from('saved_filters').delete().eq('id', id);
  revalidatePath('/discovery');
}
