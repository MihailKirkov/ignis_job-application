'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/supabase/auth';
import { encryptSecret } from '@/lib/ai/crypto';

export type KeyActionState = { ok: boolean; error?: string } | null;

// Store the user's Anthropic API key, encrypted at rest. The plaintext key is
// never returned, never logged, and never persisted unencrypted.
export async function setApiKey(
  _prev: KeyActionState,
  fd: FormData,
): Promise<KeyActionState> {
  const user = await requireUser();
  const raw = String(fd.get('api_key') ?? '').trim();
  if (!raw) return { ok: false, error: 'Enter an API key.' };
  if (!raw.startsWith('sk-ant-')) {
    return { ok: false, error: 'That does not look like an Anthropic key (expected sk-ant-…).' };
  }

  let ciphertext: string;
  try {
    ciphertext = encryptSecret(raw);
  } catch {
    return {
      ok: false,
      error: 'Server is missing APP_ENCRYPTION_KEY, so keys cannot be stored. Contact the admin.',
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('user_secrets')
    .upsert({ user_id: user.id, anthropic_api_key: ciphertext }, { onConflict: 'user_id' });
  if (error) return { ok: false, error: error.message };

  revalidatePath('/profile');
  revalidatePath('/discovery');
  return { ok: true };
}

// Remove the user's stored key (falls back to the env key if one is configured).
export async function clearApiKey(): Promise<void> {
  const user = await requireUser();
  const supabase = await createClient();
  await supabase.from('user_secrets').delete().eq('user_id', user.id);
  revalidatePath('/profile');
  revalidatePath('/discovery');
}
