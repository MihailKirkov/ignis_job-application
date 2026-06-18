'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/supabase/auth';
import { logActivity } from '@/lib/activity/log';
import {
  buildProfilePayload,
  sanitizeCvText,
  validateProfile,
} from '@/lib/profile';

export type ProfileActionState = { ok: boolean; error?: string } | null;

const CV_BUCKET = 'cvs';
const MAX_PDF_BYTES = 10 * 1024 * 1024; // 10 MB

function revalidate() {
  revalidatePath('/profile');
  revalidatePath('/activity');
}

// Which scalar/array fields actually changed, so the feed can say
// "Updated profile (skills, summary)". Compared by value (JSON for arrays).
function changedFields(
  prev: Record<string, unknown> | null,
  next: Record<string, unknown>,
): string[] {
  const changed: string[] = [];
  for (const key of Object.keys(next)) {
    const a = prev ? prev[key] : undefined;
    const b = next[key];
    if (JSON.stringify(a ?? null) !== JSON.stringify(b ?? null)) changed.push(key);
  }
  return changed;
}

function str(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  return typeof v === 'string' ? v : null;
}

// Upsert the profile from the main form. Manages every scalar/array field plus
// the pasted CV text; deliberately omits cv_file_path so an uploaded PDF's path
// survives an unrelated edit.
export async function saveProfile(
  _prev: ProfileActionState,
  fd: FormData,
): Promise<ProfileActionState> {
  const user = await requireUser();

  const payload = buildProfilePayload({
    full_name: str(fd, 'full_name'),
    headline: str(fd, 'headline'),
    location: str(fd, 'location'),
    summary: str(fd, 'summary'),
    seniority: str(fd, 'seniority'),
    skills: str(fd, 'skills'),
    target_roles: str(fd, 'target_roles'),
    target_locations: str(fd, 'target_locations'),
    target_salary_min: str(fd, 'target_salary_min'),
    work_modes: fd.getAll('work_modes').map((v) => String(v)),
    languages: str(fd, 'languages'),
    links: str(fd, 'links'),
  });

  const error = validateProfile(payload);
  if (error) return { ok: false, error };

  const cvText = sanitizeCvText(str(fd, 'cv_text'));
  const nextCv = cvText === '' ? null : cvText;

  const supabase = await createClient();

  // Diff against the prior row to report which fields changed in the feed.
  const fieldKeys = Object.keys(payload);
  const { data: prior } = await supabase
    .from('profiles')
    .select([...fieldKeys, 'cv_text'].join(', '))
    .maybeSingle();
  const priorRow = (prior ?? null) as Record<string, unknown> | null;

  const { error: dbError } = await supabase.from('profiles').upsert(
    {
      user_id: user.id,
      ...payload,
      cv_text: nextCv,
    },
    { onConflict: 'user_id' },
  );
  if (dbError) return { ok: false, error: dbError.message };

  const changed = changedFields(priorRow, { ...payload });
  if (JSON.stringify((priorRow?.cv_text as string) ?? null) !== JSON.stringify(nextCv)) {
    changed.push('cv');
  }
  if (changed.length > 0) {
    await logActivity(supabase, user.id, {
      type: 'profile.updated',
      entityType: 'profile',
      entityId: user.id,
      meta: { changed },
    });
  }

  revalidate();
  return { ok: true };
}

// Upload a CV PDF to the private bucket, extract its text server-side, and store
// both the path and the extracted text on the profile. Replaces any prior file
// (fixed per-user path + upsert).
export async function uploadCv(
  _prev: ProfileActionState,
  fd: FormData,
): Promise<ProfileActionState> {
  const user = await requireUser();

  const file = fd.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: 'Choose a PDF file to upload.' };
  }
  const isPdf =
    file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  if (!isPdf) return { ok: false, error: 'Only PDF files are supported.' };
  if (file.size > MAX_PDF_BYTES) {
    return { ok: false, error: 'PDF is too large (max 10 MB).' };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  // Extract text with unpdf's serverless PDF.js build (no native binaries, runs
  // on Vercel's Node runtime). Imported lazily so it stays out of other bundles.
  let cvText = '';
  try {
    const { extractText, getDocumentProxy } = await import('unpdf');
    const pdf = await getDocumentProxy(bytes);
    const { text } = await extractText(pdf, { mergePages: true });
    cvText = sanitizeCvText(text);
  } catch {
    return { ok: false, error: 'Could not read text from that PDF.' };
  }

  const supabase = await createClient();
  const path = `${user.id}/cv.pdf`;
  const { error: upError } = await supabase.storage
    .from(CV_BUCKET)
    .upload(path, bytes, { contentType: 'application/pdf', upsert: true });
  if (upError) return { ok: false, error: upError.message };

  const { error: dbError } = await supabase.from('profiles').upsert(
    {
      user_id: user.id,
      cv_text: cvText === '' ? null : cvText,
      cv_file_path: path,
    },
    { onConflict: 'user_id' },
  );
  if (dbError) return { ok: false, error: dbError.message };

  await logActivity(supabase, user.id, {
    type: 'profile.updated',
    entityType: 'profile',
    entityId: user.id,
    meta: { changed: ['cv'] },
  });
  revalidate();
  return { ok: true };
}

// Remove the uploaded CV file + its stored path (keeps any pasted cv_text).
export async function removeCvFile(): Promise<void> {
  const user = await requireUser();
  const supabase = await createClient();
  const path = `${user.id}/cv.pdf`;
  await supabase.storage.from(CV_BUCKET).remove([path]);
  await supabase.from('profiles').update({ cv_file_path: null }).eq('user_id', user.id);
  await logActivity(supabase, user.id, {
    type: 'profile.updated',
    entityType: 'profile',
    entityId: user.id,
    meta: { changed: ['cv'] },
  });
  revalidate();
}
