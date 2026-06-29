import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import {
  ACTIVITY_CATEGORY_COLOR,
  MISSION,
  OUTREACH_BUMP_RESOLVED,
  TERMINAL_STATUSES,
} from '@/lib/constants';
import { computeVitals } from '@/lib/pipeline';
import { formatDateTime, isOverdue, todayISO } from '@/lib/utils';
import { activityHref } from '@/lib/activity/feed';
import type {
  ActivityEventRow,
  ApplicationRow,
  ApplicationStatus,
  CompanyRow,
  ContactRow,
  OutreachRow,
  ProfileRow,
  ScoreVerdict,
} from '@/types/database';
import { CommandBridge } from '@/components/needs-action-view';
import type { AlertItem } from '@/components/alert-cards';
import type { FitMap } from '@/components/app-card';
import type { LogEntry } from '@/components/hud';
import { NewApplicationButton } from '@/components/application-dialog';
import { OnboardingChecklist, type OnboardingStep } from '@/components/onboarding-checklist';

export default async function NeedsActionPage() {
  const supabase = await createClient();
  const today = todayISO();

  const notTerminal = `(${TERMINAL_STATUSES.map((s) => `"${s}"`).join(',')})`;
  const bumpResolved = `(${OUTREACH_BUMP_RESOLVED.map((s) => `"${s}"`).join(',')})`;
  const [
    { data },
    { data: dueContactRows },
    { data: dueOutreachRows },
    { data: companyRows },
    { data: contactNameRows },
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
    supabase
      .from('contacts')
      .select('*')
      .lte('next_follow_up_at', today)
      .order('next_follow_up_at', { ascending: true }),
    supabase
      .from('outreach')
      .select('*')
      .lte('next_bump_at', today)
      .not('status', 'in', bumpResolved)
      .order('next_bump_at', { ascending: true }),
    supabase.from('companies').select('id, name'),
    supabase.from('contacts').select('id, name'),
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
  const dueContacts = (dueContactRows ?? []) as ContactRow[];
  const dueOutreach = (dueOutreachRows ?? []) as OutreachRow[];

  const vitals = computeVitals((statusRows ?? []).map((r) => r.status as ApplicationStatus));

  // id → name lookups for the contact/outreach alert cards.
  const companyName: Record<string, string> = {};
  for (const c of (companyRows ?? []) as Pick<CompanyRow, 'id' | 'name'>[]) {
    companyName[c.id] = c.name;
  }
  const contactName: Record<string, string> = {};
  for (const c of (contactNameRows ?? []) as Pick<ContactRow, 'id' | 'name'>[]) {
    contactName[c.id] = c.name;
  }

  // Fit scores for the application alert cards (only the due rows from a job).
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

  // Merge the three due-or-overdue sources into one queue, each tagged with its
  // due date so we can split overdue vs due-today and sort oldest-first.
  const dated: { date: string; item: AlertItem }[] = [
    ...rows
      .filter((r) => r.next_action_date)
      .map((r) => ({
        date: r.next_action_date as string,
        item: {
          kind: 'application' as const,
          key: `app-${r.id}`,
          row: r,
          fit: r.job_id ? fitMap[r.job_id] : undefined,
        },
      })),
    ...dueContacts
      .filter((c) => c.next_follow_up_at)
      .map((c) => ({
        date: c.next_follow_up_at as string,
        item: {
          kind: 'contact' as const,
          key: `contact-${c.id}`,
          row: c,
          companyName: c.company_id ? companyName[c.company_id] : undefined,
        },
      })),
    ...dueOutreach
      .filter((o) => o.next_bump_at)
      .map((o) => ({
        date: o.next_bump_at as string,
        item: {
          kind: 'outreach' as const,
          key: `outreach-${o.id}`,
          row: o,
          companyName: o.company_id ? companyName[o.company_id] : undefined,
          contactName: o.contact_id ? contactName[o.contact_id] : undefined,
        },
      })),
  ];
  const byDate = (a: { date: string }, b: { date: string }) => a.date.localeCompare(b.date);
  const overdue = dated.filter((x) => isOverdue(x.date)).sort(byDate).map((x) => x.item);
  const dueToday = dated.filter((x) => !isOverdue(x.date)).sort(byDate).map((x) => x.item);

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
        actions={<NewApplicationButton />}
      />
    </div>
  );
}
