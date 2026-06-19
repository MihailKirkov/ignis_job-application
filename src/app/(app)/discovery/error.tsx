'use client';

import { HudError } from '@/components/hud-error';

export default function DiscoveryError({
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
      segment="DISCOVERY"
      title="Couldn't load the inbox"
      error={error}
      retry={unstable_retry ?? reset}
    />
  );
}
