'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/supabase/auth';
import { SOURCE_TYPES } from '@/lib/constants';
import type { SourceType } from '@/types/database';

export type SourceActionState = { ok: boolean; error?: string } | null;

function revalidate() {
  revalidatePath('/sources');
  revalidatePath('/discovery');
}

export async function createSource(
  _prev: SourceActionState,
  fd: FormData,
): Promise<SourceActionState> {
  const user = await requireUser();
  const type = String(fd.get('type') ?? '') as SourceType;
  if (!SOURCE_TYPES.includes(type)) return { ok: false, error: 'Unknown source type.' };

  const rawConfig = String(fd.get('config') ?? '').trim();
  let config: Record<string, unknown> = {};
  if (rawConfig) {
    try {
      const parsed = JSON.parse(rawConfig);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        config = parsed as Record<string, unknown>;
      } else {
        return { ok: false, error: 'Config must be a JSON object.' };
      }
    } catch {
      return { ok: false, error: 'Config is not valid JSON.' };
    }
  }

  const supabase = await createClient();
  const { error } = await supabase.from('sources').insert({
    user_id: user.id,
    type,
    config,
    enabled: fd.get('enabled') !== 'off',
  });
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

export async function toggleSource(id: string, enabled: boolean): Promise<void> {
  await requireUser();
  const supabase = await createClient();
  await supabase.from('sources').update({ enabled }).eq('id', id);
  revalidate();
}

export async function deleteSource(id: string): Promise<void> {
  await requireUser();
  const supabase = await createClient();
  await supabase.from('sources').delete().eq('id', id);
  revalidate();
}
