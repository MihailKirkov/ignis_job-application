'use client';

import { useActionState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { clearApiKey, setApiKey, type KeyActionState } from '@/lib/actions/ai-key';
import { Button, Input, Label } from './ui';

// Set / replace / clear the user's own Anthropic API key. The key is encrypted
// server-side and never rendered back here — we only ever show whether one is set.
export function AiKeyPanel({
  hasKey,
  usingEnvFallback,
}: {
  hasKey: boolean;
  usingEnvFallback: boolean;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<KeyActionState, FormData>(setApiKey, null);
  const [clearing, startClear] = useTransition();

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  return (
    <div className="space-y-3 rounded-[10px] border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-fg">AI · Anthropic API key</h2>
        {hasKey ? (
          <span className="text-xs text-status-offer">Your key is set</span>
        ) : usingEnvFallback ? (
          <span className="text-xs text-muted">Using the app&apos;s shared key</span>
        ) : (
          <span className="text-xs text-status-rejected">No key — scoring disabled</span>
        )}
      </div>

      <p className="text-xs text-muted">
        Fit-scoring and CV prefill run on <strong>your own</strong> Anthropic API key, stored
        encrypted and used only on the server.
        {usingEnvFallback && !hasKey
          ? ' A shared fallback key is currently active — add your own to use your own quota.'
          : ''}
      </p>

      <form action={formAction} className="flex flex-wrap items-end gap-2">
        <div className="min-w-[240px] flex-1">
          <Label htmlFor="api_key">{hasKey ? 'Replace key' : 'API key'}</Label>
          <Input
            id="api_key"
            name="api_key"
            type="password"
            autoComplete="off"
            placeholder="sk-ant-…"
          />
        </div>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? 'Saving…' : hasKey ? 'Replace' : 'Save key'}
        </Button>
        {hasKey ? (
          <Button
            type="button"
            variant="danger"
            disabled={clearing}
            onClick={() =>
              startClear(async () => {
                await clearApiKey();
                router.refresh();
              })
            }
          >
            {clearing ? 'Clearing…' : 'Clear'}
          </Button>
        ) : null}
      </form>

      {state?.error ? (
        <p className="text-xs text-status-rejected">{state.error}</p>
      ) : state?.ok ? (
        <p className="text-xs text-status-offer">Saved.</p>
      ) : null}

      <p className="text-xs text-faint">
        Get a key at console.anthropic.com → API Keys. It never leaves the server and is never
        shown again here.
      </p>
    </div>
  );
}
