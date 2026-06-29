'use client';

import { HudError } from '@/components/hud-error';

export default function ContactsError({
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
      segment="CONTACTS"
      title="Couldn't load the network"
      error={error}
      retry={unstable_retry ?? reset}
    />
  );
}
