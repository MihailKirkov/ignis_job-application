import 'server-only';

// Resolve the Anthropic API key for a user, server-side only:
//   1. the user's own key (decrypted from user_secrets), else
//   2. the owner/demo ANTHROPIC_API_KEY env fallback, else
//   3. null (caller disables scoring with a clear message — never crashes).
// The decrypted key is returned only to the calling Server Action and never sent
// to the client or logged.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { decryptSecret } from './crypto';

type DB = SupabaseClient<Database>;

export async function resolveAnthropicKey(
  supabase: DB,
  userId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('user_secrets')
    .select('anthropic_api_key')
    .eq('user_id', userId)
    .maybeSingle();

  if (data?.anthropic_api_key) {
    try {
      return decryptSecret(data.anthropic_api_key);
    } catch {
      // Bad ciphertext (e.g. APP_ENCRYPTION_KEY rotated) — fall through to env.
    }
  }
  return process.env.ANTHROPIC_API_KEY ?? null;
}

// Cheap availability check for the UI (no decryption): does the user have a key,
// or is an env fallback configured?
export async function hasAnthropicKey(supabase: DB, userId: string): Promise<boolean> {
  if (process.env.ANTHROPIC_API_KEY) return true;
  const { data } = await supabase
    .from('user_secrets')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();
  return Boolean(data);
}
