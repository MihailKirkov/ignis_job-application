'use client';

import { HudError } from '@/components/hud-error';

export default function NeedsActionError({
  error,
  reset,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  reset?: () => void;
  unstable_retry?: () => void;
}) {
  return (
    <HudError
      segment="NEEDS ACTION"
      title="Couldn't load the command bridge"
      error={error}
      retry={unstable_retry ?? reset}
    />
  );
}
