import type {
  ActivityCategory,
  ActivityType,
  ApplicationStatus,
  Channel,
  JobState,
  OutreachStatus,
  ScoreVerdict,
  ScoringRunStatus,
  ScoringTrigger,
  Seniority,
  SourceType,
  TemplateKind,
  WorkMode,
} from '@/types/database';

// Mission target for the command-bridge countdown — the date the job search is
// working toward. The primary clock counts down to the funding-runway end; the
// milestone is a later, static reference point. Adjust as plans change.
export const MISSION = {
  label: 'RUNWAY END',
  targetDate: '2026-07-31',
  milestone: { label: 'EINDHOVEN MOVE', date: '2026-09-01' },
} as const;

export const APPLICATION_STATUSES: ApplicationStatus[] = [
  'To apply',
  'Applied',
  'Screening',
  'Interview',
  'Offer',
  'Rejected',
  'Closed',
];

// Pipeline stages that still need attention (drive the "Needs action" queue and
// the "active pipeline" stat). Rejected/Closed are terminal.
export const TERMINAL_STATUSES: ApplicationStatus[] = ['Rejected', 'Closed'];

export const WORK_MODES: WorkMode[] = ['On-site', 'Hybrid', 'Remote'];

// Seniority ladder for the profile (low -> high). `null` means unspecified.
export const SENIORITY_LEVELS: Seniority[] = [
  'intern',
  'junior',
  'medior',
  'senior',
  'lead',
  'principal',
];

export const CHANNELS: Channel[] = [
  'Detachering',
  'Brainport portal',
  'LinkedIn',
  'Recruiter',
  'Direct',
  'Referral',
  'Other',
];

export const JOB_STATES: JobState[] = ['new', 'saved', 'dismissed', 'promoted'];

// Outreach (the touch log) -----------------------------------------------------

export const OUTREACH_STATUSES: OutreachStatus[] = ['Sent', 'Replied', 'No reply', 'Bounced'];

// A bump (follow-up reminder) is moot once the thread is resolved either way.
export const OUTREACH_BUMP_RESOLVED: OutreachStatus[] = ['Replied', 'Bounced'];

export const OUTREACH_STATUS_COLOR: Record<OutreachStatus, string> = {
  Sent: 'status-applied', // cyan — in flight
  Replied: 'status-offer', // green — got a response
  'No reply': 'status-grey',
  Bounced: 'status-rejected', // red
};

// Message templates (reusable outreach boilerplate) -----------------------------

export const TEMPLATE_KINDS: TemplateKind[] = [
  'detachering_dm',
  'open_app_email',
  'follow_up',
  'recruiter_dm',
  'other',
];

export const TEMPLATE_KIND_LABEL: Record<TemplateKind, string> = {
  detachering_dm: 'Detachering DM',
  open_app_email: 'Open-application email',
  follow_up: 'Follow-up',
  recruiter_dm: 'Recruiter DM',
  other: 'Other',
};

// AI fit verdicts (best -> worst) and their badge colour tokens.
export const FIT_VERDICTS: ScoreVerdict[] = ['strong', 'medium', 'weak'];

export const FIT_VERDICT_COLOR: Record<ScoreVerdict, string> = {
  strong: 'status-offer', // green
  medium: 'status-interview', // amber
  weak: 'status-rejected', // red
};

// AI scoring runs --------------------------------------------------------------

export const SCORING_TRIGGERS: ScoringTrigger[] = ['manual', 'cron'];
export const SCORING_RUN_STATUSES: ScoringRunStatus[] = [
  'queued',
  'running',
  'done',
  'error',
  'cancelled',
];

// Cost guards: hard caps on how many jobs a single run will score.
export const SCORING_MANUAL_CAP = 100; // per manual "Score new jobs" run
export const SCORING_CRON_CAP = 60; // per daily cron run (bounded for time/cost)

// Activity log -----------------------------------------------------------------

export const ACTIVITY_CATEGORIES: ActivityCategory[] = [
  'application',
  'job',
  'profile',
  'source',
  'ingestion',
  'company',
  'contact',
  'outreach',
];

// The full append-only event vocabulary (category derives from the prefix).
export const ACTIVITY_TYPES: ActivityType[] = [
  'application.created',
  'application.status_changed',
  'application.deleted',
  'job.promoted',
  'job.saved',
  'job.dismissed',
  'profile.updated',
  'source.added',
  'source.removed',
  'source.toggled',
  'ingestion.completed',
  'company.created',
  'company.updated',
  'company.deleted',
  'contact.created',
  'contact.updated',
  'contact.deleted',
  'outreach.logged',
  'outreach.status_changed',
];

// Category → colour token (drives the telemetry LED + /activity dots) and a
// short uppercase glyph used as the feed icon.
export const ACTIVITY_CATEGORY_COLOR: Record<ActivityCategory, string> = {
  application: 'status-applied',
  job: 'system',
  profile: 'status-interview',
  source: 'status-screening',
  ingestion: 'status-offer',
  company: 'highlight',
  contact: 'system',
  outreach: 'status-applied',
};

export const ACTIVITY_CATEGORY_ICON: Record<ActivityCategory, string> = {
  application: 'APP',
  job: 'JOB',
  profile: 'PRF',
  source: 'SRC',
  ingestion: 'ING',
  company: 'CMP',
  contact: 'CON',
  outreach: 'OUT',
};

export const SOURCE_TYPES: SourceType[] = [
  'adzuna',
  'arbeitnow',
  'remotive',
  'remoteok',
  'greenhouse',
  'lever',
  'ashby',
  'workable',
  'recruitee',
  'smartrecruiters',
];

// Tailwind token name per status (maps to --color-status-* in globals.css).
export const STATUS_COLOR: Record<ApplicationStatus, string> = {
  'To apply': 'status-grey',
  Applied: 'status-applied',
  Screening: 'status-screening',
  Interview: 'status-interview',
  Offer: 'status-offer',
  Rejected: 'status-rejected',
  Closed: 'status-grey',
};

// Human-friendly description of what each source needs configured.
export const SOURCE_META: Record<
  SourceType,
  { label: string; needsToken: boolean; configHint: string; apiNote: string }
> = {
  adzuna: {
    label: 'Adzuna',
    needsToken: false,
    configHint: 'query, where, salary_min, max_days_old, country (nl/gb), full_time',
    apiNote: 'Official API. Requires ADZUNA_APP_ID / ADZUNA_APP_KEY env vars.',
  },
  arbeitnow: {
    label: 'Arbeitnow',
    needsToken: false,
    configHint: 'visa_sponsorship (optional), remote (optional)',
    apiNote: 'Free public job-board API, no key.',
  },
  remotive: {
    label: 'Remotive',
    needsToken: false,
    configHint: 'search, category, limit',
    apiNote: 'Free API. Attribution required; data delayed 24h; ≤2 req/min.',
  },
  remoteok: {
    label: 'RemoteOK',
    needsToken: false,
    configHint: 'tags (optional, comma-separated)',
    apiNote: 'Free API. Must link back to RemoteOK as the source.',
  },
  greenhouse: {
    label: 'Greenhouse (company board)',
    needsToken: true,
    configHint: 'token = the board token, e.g. "stripe"',
    apiNote: 'Public ATS board API: boards-api.greenhouse.io',
  },
  lever: {
    label: 'Lever (company board)',
    needsToken: true,
    configHint: 'token = the company slug, e.g. "netflix"',
    apiNote: 'Public ATS board API: api.lever.co',
  },
  ashby: {
    label: 'Ashby (company board)',
    needsToken: true,
    configHint: 'token = the job-board name',
    apiNote: 'Public ATS board API: api.ashbyhq.com',
  },
  workable: {
    label: 'Workable (company board)',
    needsToken: true,
    configHint: 'token = the account subdomain',
    apiNote: 'Public careers API (endpoint shape varies — see README).',
  },
  recruitee: {
    label: 'Recruitee (company board)',
    needsToken: true,
    configHint: 'token = the careers-site subdomain, e.g. "acme" for acme.recruitee.com',
    apiNote: 'Public Careers Site API: {token}.recruitee.com/api/offers (no key).',
  },
  smartrecruiters: {
    label: 'SmartRecruiters (company board)',
    needsToken: true,
    configHint: 'token = the public company identifier, e.g. "bosch"',
    apiNote: 'Public Posting API: api.smartrecruiters.com/v1/companies/{token}/postings (no key).',
  },
};
