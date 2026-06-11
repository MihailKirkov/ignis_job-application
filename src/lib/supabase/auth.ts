import { redirect } from 'next/navigation';
import { createClient } from './server';

// Returns the signed-in user (verified against the auth server), or null.
export async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

// Use in protected Server Components / Actions. Redirects to /login if absent.
export async function requireUser() {
  const user = await getUser();
  if (!user) redirect('/login');
  return user;
}
