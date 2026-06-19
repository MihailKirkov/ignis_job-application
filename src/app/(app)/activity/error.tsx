'use client';

import { HudError } from '@/components/hud-error';

export default function ActivityError({
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
      segment="ACTIVITY"
      title="Couldn't load the event log"
      error={error}
      retry={unstable_retry ?? reset}
    />
  );
}
