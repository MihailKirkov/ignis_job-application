import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { ACTIVITY_CATEGORY_COLOR, MISSION, TERMINAL_STATUSES } from '@/lib/constants';
import { computeVitals } from '@/lib/pipeline';
import { formatDateTime, isOverdue, todayISO } from '@/lib/utils';
import { activityHref } from '@/lib/activity/feed';
import type {
  ActivityEventRow,
  ApplicationRow,
  ApplicationStatus,
  ProfileRow,
  ScoreVerdict,
} from '@/types/database';
import { CommandBridge } from '@/components/needs-action-view';
import type { FitMap } from '@/components/app-card';
import type { LogEntry } from '@/components/hud';
import { NewApplicationButton } from '@/components/application-dialog';
import { OnboardingChecklist, type OnboardingStep } from '@/components/onboarding-checklist';

export default async function NeedsActionPage() {
  const supabase = await createClient();
  const today = todayISO();

  const notTerminal = `(${TERMINAL_STATUSES.map((s) => `"${s}"`).join(',')})`;
  const [
    { data },
    { data: profileRow },
    { data: statusRows },
    { data: activityRows },
    { count: sourceCount },
    { count: jobCount },
    { count: scoredCount },
  ] = await Promise.all([
    supabase
      .from('applications')
      .select('*')
      .lte('next_action_date', today)
      .not('status', 'in', notTerminal)
      .order('next_action_date', { ascending: true }),
    supabase.from('profiles').select('full_name, skills, cv_text').maybeSingle(),
    supabase.from('applications').select('status'),
    supabase
      .from('activity_events')
      .select('category, summary, meta, created_at')
      .order('created_at', { ascending: false })
      .limit(10),
    supabase.from('sources').select('id', { count: 'exact', head: true }),
    supabase.from('jobs').select('id', { count: 'exact', head: true }),
    supabase
      .from('jobs')
      .select('id', { count: 'exact', head: true })
      .not('fit_score', 'is', null),
  ]);

  const profile = profileRow as Pick<ProfileRow, 'full_name' | 'skills' | 'cv_text'> | null;
  const steps: OnboardingStep[] = [
    {
      label: 'Set up your profile & CV',
      hint: 'Your details and CV power matching and AI fit-scoring.',
      href: '/profile',
      done: Boolean(profile?.full_name || profile?.skills?.length || profile?.cv_text),
    },
    {
      label: 'Add a job source',
      hint: 'Connect Adzuna or a company ATS board to ingest roles.',
      href: '/sources',
      done: (sourceCount ?? 0) > 0,
    },
    {
      label: 'Refresh your inbox',
      hint: 'Pull the latest jobs into Discovery.',
      href: '/discovery',
      done: (jobCount ?? 0) > 0,
    },
    {
      label: 'Score jobs against your profile',
      hint: 'Let Claude rank your inbox by fit.',
      href: '/discovery',
      done: (scoredCount ?? 0) > 0,
    },
  ];
  const onboardingComplete = steps.every((s) => s.done);

  const rows = (data ?? []) as ApplicationRow[];
  const overdue = rows.filter((r) => isOverdue(r.next_action_date));
  const dueToday = rows.filter((r) => !isOverdue(r.next_action_date));

  const vitals = computeVitals((statusRows ?? []).map((r) => r.status as ApplicationStatus));

  // Fit scores for the alert cards (only the due rows that came from a job).
  const jobIds = rows.map((r) => r.job_id).filter((id): id is string => Boolean(id));
  const fitMap: FitMap = {};
  if (jobIds.length > 0) {
    const { data: jobFit } = await supabase
      .from('jobs')
      .select('id, fit_score, fit_verdict')
      .in('id', jobIds)
      .not('fit_score', 'is', null);
    for (const j of (jobFit ?? []) as {
      id: string;
      fit_score: number;
      fit_verdict: ScoreVerdict | null;
    }[]) {
      fitMap[j.id] = { score: j.fit_score, verdict: j.fit_verdict };
    }
  }

  // Telemetry: the unified activity feed (latest ~10), each line linking to its
  // entity (ingestion events deep-link to the run on /activity).
  const events = (activityRows ?? []) as Pick<
    ActivityEventRow,
    'category' | 'summary' | 'meta' | 'created_at'
  >[];
  const telemetry: LogEntry[] = events.map((e) => ({
    time: formatDateTime(e.created_at),
    colorToken: ACTIVITY_CATEGORY_COLOR[e.category] ?? 'system',
    text: (
      <Link href={activityHref(e)} className="transition-colors hover:text-fg">
        {e.summary}
      </Link>
    ),
  }));

  return (
    <div className="space-y-4">
      {onboardingComplete ? null : <OnboardingChecklist steps={steps} />}
      <CommandBridge
        mission={MISSION}
        vitals={vitals}
        overdue={overdue}
        dueToday={dueToday}
        telemetry={telemetry}
        fitMap={fitMap}
        actions={<NewApplicationButton />}
      />
    </div>
  );
}
