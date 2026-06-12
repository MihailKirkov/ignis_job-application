import { createClient } from '@/lib/supabase/server';
import type { ProfileRow } from '@/types/database';
import { hasOwnAnthropicKey } from '@/lib/ai/resolve-key';
import { CvPanel } from '@/components/cv-panel';
import { ProfileForm } from '@/components/profile-form';
import { AiKeyPanel } from '@/components/ai-key-panel';

export default async function ProfilePage() {
  const supabase = await createClient();
  // One row per user; RLS scopes this to the signed-in user.
  const [{ data }, hasOwnKey] = await Promise.all([
    supabase.from('profiles').select('*').maybeSingle(),
    hasOwnAnthropicKey(supabase),
  ]);
  const profile = (data ?? null) as ProfileRow | null;
  const envFallback = Boolean(process.env.ANTHROPIC_API_KEY);
  const aiEnabled = hasOwnKey || envFallback;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-fg">Profile</h1>
        <p className="text-sm text-muted">
          Your details, targets, and CV — the basis for matching and AI fit-scoring.
        </p>
      </header>

      <AiKeyPanel hasKey={hasOwnKey} usingEnvFallback={envFallback} />
      <CvPanel profile={profile} />
      <ProfileForm profile={profile} aiEnabled={aiEnabled} />
    </div>
  );
}
