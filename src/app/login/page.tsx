'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button, Card, CardBody, Input, Label } from '@/components/ui';

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const params = useSearchParams();
  const redirectTo = params.get('redirect') || '/needs-action';

  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const siteUrl =
    typeof window !== 'undefined' ? window.location.origin : '';

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setStatus('sending');
    setMessage('');
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${siteUrl}/auth/callback?next=${encodeURIComponent(redirectTo)}`,
      },
    });
    if (error) {
      setStatus('error');
      setMessage(error.message);
    } else {
      setStatus('sent');
    }
  }

  async function signInWithGoogle() {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${siteUrl}/auth/callback?next=${encodeURIComponent(redirectTo)}`,
      },
    });
    if (error) {
      setStatus('error');
      setMessage(error.message);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="font-mono text-sm tracking-widest text-accent">JOB · CC</div>
          <h1 className="mt-2 text-lg font-semibold text-fg">Command Center</h1>
          <p className="mt-1 text-sm text-muted">
            Sign in to your discovery inbox and pipeline.
          </p>
        </div>

        <Card>
          <CardBody className="space-y-4">
            {status === 'sent' ? (
              <div className="rounded-md border border-success/40 bg-success/10 px-3 py-3 text-sm text-fg">
                Check <span className="font-mono">{email}</span> for a magic link.
                Open it in this browser to finish signing in.
              </div>
            ) : (
              <form onSubmit={sendMagicLink} className="space-y-3">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <Button
                  type="submit"
                  variant="primary"
                  className="w-full"
                  disabled={status === 'sending'}
                >
                  {status === 'sending' ? 'Sending…' : 'Send magic link'}
                </Button>
              </form>
            )}

            <div className="flex items-center gap-3 text-xs text-faint">
              <span className="h-px flex-1 bg-border" />
              or
              <span className="h-px flex-1 bg-border" />
            </div>

            <Button variant="secondary" className="w-full" onClick={signInWithGoogle}>
              Continue with Google
            </Button>

            {status === 'error' ? (
              <p className="text-xs text-status-rejected">{message}</p>
            ) : null}
          </CardBody>
        </Card>

        <p className="mt-4 text-center text-xs text-faint">
          Google sign-in requires the provider to be enabled in Supabase.
        </p>
      </div>
    </main>
  );
}
