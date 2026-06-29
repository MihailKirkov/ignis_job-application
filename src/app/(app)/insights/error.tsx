'use client';

import { HudError } from '@/components/hud-error';

export default function InsightsError({
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
      segment="INSIGHTS"
      title="Couldn't load attribution"
      error={error}
      retry={unstable_retry ?? reset}
    />
  );
}
