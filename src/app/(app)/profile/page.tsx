import { createClient } from '@/lib/supabase/server';
import type { ProfileRow } from '@/types/database';
import { CvPanel } from '@/components/cv-panel';
import { ProfileForm } from '@/components/profile-form';

export default async function ProfilePage() {
  const supabase = await createClient();
  // One row per user; RLS scopes this to the signed-in user.
  const { data } = await supabase.from('profiles').select('*').maybeSingle();
  const profile = (data ?? null) as ProfileRow | null;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-fg">Profile</h1>
        <p className="text-sm text-muted">
          Your details, targets, and CV — the basis for matching and (soon) AI assists.
        </p>
      </header>

      <CvPanel profile={profile} />
      <ProfileForm profile={profile} />
    </div>
  );
}
