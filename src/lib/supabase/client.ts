'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/database';

// Browser-side Supabase client. Safe to call from Client Components.
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
