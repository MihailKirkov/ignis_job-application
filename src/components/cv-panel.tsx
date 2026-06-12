'use client';

import { useActionState, useEffect, useRef, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  removeCvFile,
  uploadCv,
  type ProfileActionState,
} from '@/lib/actions/profile';
import type { ProfileRow } from '@/types/database';
import { Button } from './ui';

function CvSource({ profile }: { profile: ProfileRow | null }) {
  if (profile?.cv_file_path) {
    const name = profile.cv_file_path.split('/').pop() ?? 'cv.pdf';
    return (
      <p className="text-sm text-fg">
        <span className="font-medium">Uploaded PDF</span>{' '}
        <span className="font-mono text-xs text-muted">({name})</span>
        {profile.cv_text ? (
          <span className="text-muted"> · {profile.cv_text.length} chars extracted</span>
        ) : (
          <span className="text-status-rejected"> · no text extracted</span>
        )}
      </p>
    );
  }
  if (profile?.cv_text) {
    return (
      <p className="text-sm text-fg">
        <span className="font-medium">Pasted text</span>{' '}
        <span className="text-muted">· {profile.cv_text.length} chars</span>
      </p>
    );
  }
  return <p className="text-sm text-muted">No CV yet.</p>;
}

export function CvPanel({ profile }: { profile: ProfileRow | null }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [removing, startRemove] = useTransition();
  const [state, formAction, pending] = useActionState<ProfileActionState, FormData>(
    uploadCv,
    null,
  );

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      router.refresh();
    }
  }, [state, router]);

  const hasFile = Boolean(profile?.cv_file_path);

  return (
    <div className="space-y-3 rounded-[10px] border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-fg">CV</h2>
        <CvSource profile={profile} />
      </div>

      <form ref={formRef} action={formAction} className="flex flex-wrap items-center gap-2">
        <input
          type="file"
          name="file"
          accept="application/pdf,.pdf"
          className="max-w-full text-sm text-muted file:mr-3 file:cursor-pointer file:rounded-md file:border file:border-border file:bg-bg file:px-3 file:py-2 file:text-sm file:text-fg hover:file:bg-surface-2"
        />
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? 'Uploading…' : hasFile ? 'Replace CV' : 'Upload PDF'}
        </Button>
        {hasFile ? (
          <Button
            type="button"
            variant="danger"
            disabled={removing}
            onClick={() =>
              startRemove(async () => {
                await removeCvFile();
                router.refresh();
              })
            }
          >
            {removing ? 'Removing…' : 'Remove file'}
          </Button>
        ) : null}
      </form>

      {state?.error ? (
        <p className="text-xs text-status-rejected">{state.error}</p>
      ) : (
        <p className="text-xs text-faint">
          PDF only, max 10 MB. Stored privately; text is extracted into the CV field below.
        </p>
      )}
    </div>
  );
}
