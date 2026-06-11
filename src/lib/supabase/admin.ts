import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

// Service-role client. SERVER-ONLY — bypasses RLS, so it must never be imported
// into client code or exposed to the browser. Used by the cron route to ingest
// on behalf of every user (there is no session to scope RLS during a cron run).
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      'Cron ingestion requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
    );
  }
  return createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
