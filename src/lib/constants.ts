import type {
  ApplicationStatus,
  Channel,
  JobState,
  Seniority,
  SourceType,
  WorkMode,
} from '@/types/database';

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

export const SOURCE_TYPES: SourceType[] = [
  'adzuna',
  'arbeitnow',
  'remotive',
  'remoteok',
  'greenhouse',
  'lever',
  'ashby',
  'workable',
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
};
