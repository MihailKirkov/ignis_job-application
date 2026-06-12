'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { saveProfile, type ProfileActionState } from '@/lib/actions/profile';
import { SENIORITY_LEVELS, WORK_MODES } from '@/lib/constants';
import { serializeLinks, serializeList } from '@/lib/profile';
import type { ProfileRow } from '@/types/database';
import { Button, Input, Label, Select, Textarea } from './ui';

function Field({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>;
}

export function ProfileForm({ profile }: { profile: ProfileRow | null }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<ProfileActionState, FormData>(
    saveProfile,
    null,
  );

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  const modes = new Set(profile?.work_modes ?? []);

  return (
    <form action={formAction} className="space-y-5">
      {/* Identity ------------------------------------------------------------ */}
      <fieldset className="space-y-3">
        <legend className="text-xs font-semibold uppercase tracking-wide text-faint">
          Identity
        </legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field>
            <Label htmlFor="full_name">Full name</Label>
            <Input id="full_name" name="full_name" defaultValue={profile?.full_name ?? ''} />
          </Field>
          <Field>
            <Label htmlFor="headline">Headline</Label>
            <Input
              id="headline"
              name="headline"
              placeholder="Frontend Engineer · React/TS"
              defaultValue={profile?.headline ?? ''}
            />
          </Field>
          <Field>
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              name="location"
              placeholder="Eindhoven, NL"
              defaultValue={profile?.location ?? ''}
            />
          </Field>
          <Field>
            <Label htmlFor="seniority">Seniority</Label>
            <Select id="seniority" name="seniority" defaultValue={profile?.seniority ?? ''}>
              <option value="">—</option>
              {SENIORITY_LEVELS.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field>
          <Label htmlFor="summary">Summary</Label>
          <Textarea
            id="summary"
            name="summary"
            placeholder="A short professional summary."
            defaultValue={profile?.summary ?? ''}
          />
        </Field>
      </fieldset>

      {/* Skills & targets ---------------------------------------------------- */}
      <fieldset className="space-y-3">
        <legend className="text-xs font-semibold uppercase tracking-wide text-faint">
          Skills &amp; targets
        </legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field>
            <Label htmlFor="skills">Skills</Label>
            <Textarea
              id="skills"
              name="skills"
              placeholder="React, TypeScript, Node…"
              defaultValue={serializeList(profile?.skills)}
            />
            <p className="mt-1 text-xs text-faint">Comma- or newline-separated.</p>
          </Field>
          <Field>
            <Label htmlFor="languages">Languages</Label>
            <Textarea
              id="languages"
              name="languages"
              placeholder="English, Dutch"
              defaultValue={serializeList(profile?.languages)}
            />
            <p className="mt-1 text-xs text-faint">Comma- or newline-separated.</p>
          </Field>
          <Field>
            <Label htmlFor="target_roles">Target roles</Label>
            <Textarea
              id="target_roles"
              name="target_roles"
              placeholder="Frontend Engineer, Fullstack"
              defaultValue={serializeList(profile?.target_roles)}
            />
          </Field>
          <Field>
            <Label htmlFor="target_locations">Target locations</Label>
            <Textarea
              id="target_locations"
              name="target_locations"
              placeholder="Eindhoven, Remote (EU)"
              defaultValue={serializeList(profile?.target_locations)}
            />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field>
            <Label htmlFor="target_salary_min">Target salary floor (yearly)</Label>
            <Input
              id="target_salary_min"
              name="target_salary_min"
              inputMode="numeric"
              placeholder="60000"
              defaultValue={profile?.target_salary_min ?? ''}
            />
          </Field>
          <Field>
            <Label>Work modes</Label>
            <div className="flex flex-wrap gap-3 pt-1.5">
              {WORK_MODES.map((m) => (
                <label key={m} className="flex items-center gap-1.5 text-sm text-fg">
                  <input
                    type="checkbox"
                    name="work_modes"
                    value={m}
                    defaultChecked={modes.has(m)}
                    className="accent-accent"
                  />
                  {m}
                </label>
              ))}
            </div>
          </Field>
        </div>
      </fieldset>

      {/* Links --------------------------------------------------------------- */}
      <fieldset className="space-y-3">
        <legend className="text-xs font-semibold uppercase tracking-wide text-faint">
          Links
        </legend>
        <Field>
          <Label htmlFor="links">Links</Label>
          <Textarea
            id="links"
            name="links"
            placeholder={'GitHub | https://github.com/you\nLinkedIn | https://linkedin.com/in/you'}
            defaultValue={serializeLinks(profile?.links)}
            className="font-mono text-xs"
          />
          <p className="mt-1 text-xs text-faint">
            One per line as <code>Label | https://url</code>.
          </p>
        </Field>
      </fieldset>

      {/* CV text ------------------------------------------------------------- */}
      <fieldset className="space-y-3">
        <legend className="text-xs font-semibold uppercase tracking-wide text-faint">
          CV text
        </legend>
        <Field>
          <Label htmlFor="cv_text">Paste CV text</Label>
          <Textarea
            id="cv_text"
            name="cv_text"
            placeholder="Paste your CV here, or upload a PDF above to extract it automatically."
            defaultValue={profile?.cv_text ?? ''}
            className="min-h-[160px] font-mono text-xs"
          />
          <p className="mt-1 text-xs text-faint">
            Uploading a PDF fills this in; you can edit it here too.
          </p>
        </Field>
      </fieldset>

      {state?.error ? (
        <p className="text-xs text-status-rejected">{state.error}</p>
      ) : state?.ok ? (
        <p className="text-xs text-status-offer">Saved.</p>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? 'Saving…' : 'Save profile'}
        </Button>
      </div>
    </form>
  );
}
