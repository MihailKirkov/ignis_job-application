'use client';

import { HudError } from '@/components/hud-error';

export default function TrackerError({
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
      segment="TRACKER"
      title="Couldn't load the pipeline"
      error={error}
      retry={unstable_retry ?? reset}
    />
  );
}
