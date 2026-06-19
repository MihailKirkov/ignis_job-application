'use client';

import { HudError } from '@/components/hud-error';

export default function SourcesError({
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
      segment="SOURCES"
      title="Couldn't load sources"
      error={error}
      retry={unstable_retry ?? reset}
    />
  );
}
