import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/types/database';

// Paths that are always reachable without a session.
const PUBLIC_PATHS = ['/login', '/auth', '/legal'];

function isPublic(pathname: string): boolean {
  if (pathname === '/') return true;
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

// Refreshes the Supabase auth session on every request (Server Components cannot
// write cookies) and gates protected routes. Invoked from the root `proxy.ts`,
// which replaces the old `middleware.ts` convention in Next.js 16.
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: do not run code between createServerClient and getUser(), and
  // always return the supabaseResponse object so refreshed cookies propagate.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && !isPublic(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }

  // Signed-in users have no reason to sit on the login screen.
  if (user && pathname === '/login') {
    const url = request.nextUrl.clone();
    url.pathname = '/needs-action';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
