'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/supabase/auth';
import { logActivity } from '@/lib/activity/log';
import { SOURCE_META, SOURCE_TYPES } from '@/lib/constants';
import type { SourceType } from '@/types/database';

export type SourceActionState = { ok: boolean; error?: string } | null;

function revalidate() {
  revalidatePath('/sources');
  revalidatePath('/discovery');
  revalidatePath('/activity');
}

// Parse a config textarea into a plain JSON object, or return an error string.
function parseConfig(raw: string): { config?: Record<string, unknown>; error?: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { config: {} };
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return { config: parsed as Record<string, unknown> };
    }
    return { error: 'Config must be a JSON object.' };
  } catch {
    return { error: 'Config is not valid JSON.' };
  }
}

export async function createSource(
  _prev: SourceActionState,
  fd: FormData,
): Promise<SourceActionState> {
  const user = await requireUser();
  const type = String(fd.get('type') ?? '') as SourceType;
  if (!SOURCE_TYPES.includes(type)) return { ok: false, error: 'Unknown source type.' };

  const { config, error: cfgErr } = parseConfig(String(fd.get('config') ?? ''));
  if (cfgErr || !config) return { ok: false, error: cfgErr };

  const supabase = await createClient();
  const { data: created, error } = await supabase
    .from('sources')
    .insert({
      user_id: user.id,
      type,
      config,
      enabled: fd.get('enabled') !== 'off',
    })
    .select('id')
    .single();
  if (error) return { ok: false, error: error.message };
  await logActivity(supabase, user.id, {
    type: 'source.added',
    entityType: 'source',
    entityId: (created as { id: string } | null)?.id ?? null,
    meta: { type, label: SOURCE_META[type].label },
  });
  revalidate();
  return { ok: true };
}

// Inline edit (name + config JSON). `name` is a convenience alias for
// config.name; the JSON textarea is the source of truth for everything else.
export async function updateSource(
  id: string,
  name: string,
  configJson: string,
): Promise<SourceActionState> {
  await requireUser();
  const { config, error } = parseConfig(configJson);
  if (error || !config) return { ok: false, error };

  const trimmedName = name.trim();
  if (trimmedName) config.name = trimmedName;
  else delete config.name;

  const supabase = await createClient();
  const { error: dbErr } = await supabase.from('sources').update({ config }).eq('id', id);
  if (dbErr) return { ok: false, error: dbErr.message };
  revalidate();
  return { ok: true };
}

export async function toggleSource(id: string, enabled: boolean): Promise<void> {
  const user = await requireUser();
  const supabase = await createClient();
  const { data } = await supabase.from('sources').select('type').eq('id', id).maybeSingle();
  await supabase.from('sources').update({ enabled }).eq('id', id);
  const type = (data as { type: SourceType } | null)?.type;
  await logActivity(supabase, user.id, {
    type: 'source.toggled',
    entityType: 'source',
    entityId: id,
    meta: { type, label: type ? SOURCE_META[type].label : undefined, enabled },
  });
  revalidate();
}

export async function deleteSource(id: string): Promise<void> {
  const user = await requireUser();
  const supabase = await createClient();
  const { data } = await supabase.from('sources').select('type').eq('id', id).maybeSingle();
  await supabase.from('sources').delete().eq('id', id);
  const type = (data as { type: SourceType } | null)?.type;
  await logActivity(supabase, user.id, {
    type: 'source.removed',
    entityType: 'source',
    entityId: id,
    meta: { type, label: type ? SOURCE_META[type].label : undefined },
  });
  revalidate();
}
