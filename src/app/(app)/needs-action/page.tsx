import { createClient } from '@/lib/supabase/server';
import { MISSION, SOURCE_META, TERMINAL_STATUSES } from '@/lib/constants';
import { computeVitals } from '@/lib/pipeline';
import { formatDateTime, isOverdue, statusColorToken, todayISO } from '@/lib/utils';
import type { ApplicationRow, ApplicationStatus, ProfileRow, ScoreVerdict } from '@/types/database';
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
    { data: recentApps },
    { data: recentSources },
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
      .from('applications')
      .select('company, status, updated_at')
      .order('updated_at', { ascending: false })
      .limit(6),
    supabase
      .from('sources')
      .select('type, last_run_at')
      .not('last_run_at', 'is', null)
      .order('last_run_at', { ascending: false })
      .limit(5),
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

  // Telemetry: recent ingestion runs + recent application status changes.
  const sourceEvents = ((recentSources ?? []) as { type: string; last_run_at: string }[]).map(
    (s) => ({
      ts: new Date(s.last_run_at).getTime(),
      time: formatDateTime(s.last_run_at),
      colorToken: 'status-applied',
      text: (
        <>
          Ingestion run ·{' '}
          <span className="text-fg">
            {SOURCE_META[s.type as keyof typeof SOURCE_META]?.label ?? s.type}
          </span>
        </>
      ),
    }),
  );
  const appEvents = (
    (recentApps ?? []) as Pick<ApplicationRow, 'company' | 'status' | 'updated_at'>[]
  ).map((a) => ({
    ts: new Date(a.updated_at).getTime(),
    time: formatDateTime(a.updated_at),
    colorToken: statusColorToken(a.status),
    text: (
      <>
        <span className="text-fg">{a.company}</span> → {a.status}
      </>
    ),
  }));
  const telemetry: LogEntry[] = [...sourceEvents, ...appEvents]
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 8)
    .map(({ time, text, colorToken }) => ({ time, text, colorToken }));

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
