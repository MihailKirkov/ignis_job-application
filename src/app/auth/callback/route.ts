import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Handles the PKCE `code` flow: Google OAuth always, plus magic links when the
// same-browser default Supabase template is used instead of the cross-device
// token_hash one. Exchanges the code for a session, then redirects onward.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/needs-action';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // `x-forwarded-host` is set behind the Vercel proxy in production.
      const forwardedHost = request.headers.get('x-forwarded-host');
      const isLocal = process.env.NODE_ENV === 'development';
      const safeNext = next.startsWith('/') ? next : '/needs-action';
      if (isLocal) return NextResponse.redirect(`${origin}${safeNext}`);
      if (forwardedHost) return NextResponse.redirect(`https://${forwardedHost}${safeNext}`);
      return NextResponse.redirect(`${origin}${safeNext}`);
    }
  }

  return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}
