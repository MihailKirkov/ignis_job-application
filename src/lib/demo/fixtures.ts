// Bundled, fictional fixture data for the public read-only /demo route.
// NOTHING here touches the database or a real user — it's a static snapshot used
// only to render the real Discovery / Tracker / Needs-action components so a
// recruiter can see the app without signing up.

import type {
  ActivityCategory,
  ApplicationRow,
  JobRow,
  JobState,
  ProfileRow,
  ScoreVerdict,
} from '@/types/database';

const DEMO_USER = 'demo-user';
const NOW = '2026-06-12T08:00:00.000Z';

// Fixed "today" so the Needs-action grouping (overdue / due today) stays stable
// no matter when the demo is viewed.
export const DEMO_TODAY = '2026-06-12';

// --------------------------------------------------------------------------- jobs
function job(
  partial: Partial<JobRow> & Pick<JobRow, 'id' | 'source' | 'title'>,
): JobRow {
  return {
    user_id: DEMO_USER,
    external_id: partial.id,
    company: null,
    location: null,
    mode: null,
    salary_min: null,
    salary_max: null,
    currency: null,
    url: null,
    description: null,
    posted_at: null,
    raw: {},
    fuzzy_key: null,
    state: 'new',
    fit_score: null,
    fit_verdict: null,
    fit_summary: null,
    fit_breakdown: {},
    scored_at: null,
    scored_profile_hash: null,
    ingested_at: NOW,
    created_at: NOW,
    updated_at: NOW,
    ...partial,
  };
}

function scored(
  fit_score: number,
  fit_verdict: ScoreVerdict,
  fit_summary: string,
  matched_skills: string[],
  gaps: string[],
): Partial<JobRow> {
  return {
    fit_score,
    fit_verdict,
    fit_summary,
    fit_breakdown: { matched_skills, gaps },
    scored_at: NOW,
  };
}

export const DEMO_JOBS: JobRow[] = [
  job({
    id: 'demo-job-1',
    source: 'adzuna',
    title: 'Senior Frontend Engineer',
    company: 'ASML',
    location: 'Eindhoven',
    mode: 'Hybrid',
    salary_min: 70000,
    salary_max: 90000,
    currency: 'EUR',
    url: 'https://www.example.com/jobs/asml-senior-frontend',
    description:
      'Build the operator-facing tooling that runs next-gen lithography machines. React, TypeScript and a strong design-system culture; you will own complex data-dense UIs end to end.',
    posted_at: '2026-06-11T00:00:00.000Z',
    ...scored(
      92,
      'strong',
      'Excellent match: senior React/TypeScript role in Eindhoven with a hybrid setup and a salary band above your target. Data-dense UI work lines up directly with your experience.',
      ['React', 'TypeScript', 'Next.js', 'Design systems'],
      ['C++ tooling exposure'],
    ),
  }),
  job({
    id: 'demo-job-2',
    source: 'recruitee',
    title: 'Full-stack Engineer (React / Node)',
    company: 'Philips',
    location: 'Eindhoven, Netherlands',
    mode: 'Hybrid',
    salary_min: 65000,
    salary_max: 82000,
    currency: 'EUR',
    url: 'https://www.example.com/jobs/philips-fullstack',
    description:
      'Join a HealthTech squad shipping patient-monitoring dashboards. React on the front, Node/GraphQL services on the back, with a heavy emphasis on testing and accessibility.',
    posted_at: '2026-06-10T00:00:00.000Z',
    ...scored(
      84,
      'strong',
      'Strong fit — your full-stack React/Node and GraphQL experience maps cleanly. Hybrid in Eindhoven and within range; healthcare domain is new but adjacent.',
      ['React', 'Node', 'GraphQL', 'Testing'],
      ['Healthcare domain'],
    ),
  }),
  job({
    id: 'demo-job-3',
    source: 'smartrecruiters',
    title: 'Frontend Engineer',
    company: 'Booking.com',
    location: 'Amsterdam, North Holland',
    mode: 'Hybrid',
    salary_min: 68000,
    salary_max: 85000,
    currency: 'EUR',
    url: 'https://www.example.com/jobs/booking-frontend',
    description:
      'Work on high-traffic search and checkout experiences at massive scale. Experimentation culture, performance budgets, and a React + TypeScript stack.',
    posted_at: '2026-06-09T00:00:00.000Z',
    ...scored(
      76,
      'medium',
      'Good fit on the stack and seniority, but Amsterdam is a longer commute than your Eindhoven preference and the role leans more frontend-only than full-stack.',
      ['React', 'TypeScript', 'Performance'],
      ['Amsterdam location', 'Travel domain'],
    ),
  }),
  job({
    id: 'demo-job-4',
    source: 'remotive',
    title: 'Frontend Engineer (Remote, EU)',
    company: 'GitLab',
    location: 'Remote — EU',
    mode: 'Remote',
    salary_min: 72000,
    salary_max: 95000,
    currency: 'EUR',
    url: 'https://www.example.com/jobs/gitlab-frontend',
    description:
      'Fully-remote, async-first frontend role on the CI/CD product. Vue and TypeScript; strong written-communication expectations and a public handbook culture.',
    posted_at: '2026-06-08T00:00:00.000Z',
    ...scored(
      71,
      'medium',
      'Remote-EU and well-paid, matching your remote preference. The primary framework is Vue rather than React, so expect a short ramp despite transferable TypeScript skills.',
      ['TypeScript', 'Remote', 'CI/CD'],
      ['Vue (vs React)'],
    ),
  }),
  job({
    id: 'demo-job-5',
    source: 'lever',
    title: 'Embedded C++ Engineer',
    company: 'NXP Semiconductors',
    location: 'Eindhoven',
    mode: 'On-site',
    salary_min: 60000,
    salary_max: 78000,
    currency: 'EUR',
    url: 'https://www.example.com/jobs/nxp-embedded',
    description:
      'Low-level firmware for automotive microcontrollers. C/C++, RTOS, and hardware bring-up; deep embedded experience required.',
    posted_at: '2026-06-07T00:00:00.000Z',
    ...scored(
      34,
      'weak',
      'Weak fit: this is a low-level embedded C/C++ role with no web component. Despite the convenient Eindhoven location, it sits well outside your frontend profile.',
      [],
      ['C++', 'RTOS', 'Embedded firmware'],
    ),
  }),
  job({
    id: 'demo-job-6',
    source: 'greenhouse',
    title: 'Senior React Engineer',
    company: 'Adyen',
    location: 'Amsterdam',
    mode: 'On-site',
    salary_min: 75000,
    salary_max: 95000,
    currency: 'EUR',
    url: 'https://www.example.com/jobs/adyen-react',
    description:
      'Build merchant-facing dashboards for a global payments platform. React, TypeScript, and a strong engineering bar; on-site in Amsterdam.',
    posted_at: '2026-06-06T00:00:00.000Z',
    state: 'saved',
    ...scored(
      79,
      'strong',
      'Strong on stack and pay. On-site in Amsterdam is the main trade-off against your hybrid/Eindhoven preference; saved for a closer look.',
      ['React', 'TypeScript', 'Payments'],
      ['On-site Amsterdam'],
    ),
  }),
  job({
    id: 'demo-job-7',
    source: 'ashby',
    title: 'Senior Product Engineer',
    company: 'Framer',
    location: 'Remote — EU',
    mode: 'Remote',
    salary_min: 80000,
    salary_max: 110000,
    currency: 'EUR',
    url: 'https://www.example.com/jobs/framer-product',
    description:
      'Own end-to-end product features on a design-tool used by millions. React, TypeScript, canvas rendering and a very high craft bar.',
    posted_at: '2026-06-11T00:00:00.000Z',
    ...scored(
      88,
      'strong',
      'Remote-EU, top of your salary range, and a React/TypeScript craft culture that matches your design-systems strength. Canvas rendering is a fun stretch.',
      ['React', 'TypeScript', 'Design systems'],
      ['Canvas/WebGL'],
    ),
  }),
  job({
    id: 'demo-job-8',
    source: 'workable',
    title: 'Frontend Engineer — Maps',
    company: 'TomTom',
    location: 'Amsterdam',
    mode: 'Hybrid',
    salary_min: 62000,
    salary_max: 80000,
    currency: 'EUR',
    url: 'https://www.example.com/jobs/tomtom-maps',
    description:
      'Build the web SDK and demos for the Maps platform. TypeScript, WebGL, and a strong API-design focus.',
    posted_at: '2026-06-10T00:00:00.000Z',
    ...scored(
      69,
      'medium',
      'Solid TypeScript role within range; WebGL/maps is a domain stretch and Amsterdam is a longer commute than your Eindhoven preference.',
      ['TypeScript', 'API design'],
      ['WebGL', 'Amsterdam location'],
    ),
  }),
  job({
    id: 'demo-job-9',
    source: 'adzuna',
    title: 'React Developer',
    company: 'Backbase',
    location: 'Amsterdam',
    mode: 'Hybrid',
    salary_min: 58000,
    salary_max: 72000,
    currency: 'EUR',
    url: 'https://www.example.com/jobs/backbase-react',
    description:
      'Engineering the web banking platform used by tier-1 banks. React, TypeScript and a component-library mindset.',
    posted_at: '2026-06-09T00:00:00.000Z',
    ...scored(
      64,
      'medium',
      'On-stack React/TypeScript at the lower end of your range. Fintech platform work is relevant; salary band and Amsterdam are the trade-offs.',
      ['React', 'TypeScript'],
      ['Salary band', 'Amsterdam location'],
    ),
  }),
  job({
    id: 'demo-job-10',
    source: 'lever',
    title: 'Frontend Engineer (Vue)',
    company: 'Mollie',
    location: 'Remote — NL',
    mode: 'Remote',
    salary_min: 70000,
    salary_max: 95000,
    currency: 'EUR',
    url: 'https://www.example.com/jobs/mollie-frontend',
    description:
      'Build the merchant dashboard for a leading EU payments provider. Vue 3, TypeScript, and a strong product-engineering culture; remote within the Netherlands.',
    posted_at: '2026-06-05T00:00:00.000Z',
    state: 'promoted',
    ...scored(
      81,
      'strong',
      'Remote-NL and top of your range with a strong product culture. Vue rather than React is the main ramp; promoted to the pipeline — now at offer stage.',
      ['TypeScript', 'Remote', 'Payments'],
      ['Vue (vs React)'],
    ),
  }),
  job({
    id: 'demo-job-11',
    source: 'workable',
    title: 'WordPress Developer',
    company: 'A Local Agency',
    location: 'Eindhoven',
    mode: 'On-site',
    salary_min: 38000,
    salary_max: 50000,
    currency: 'EUR',
    url: 'https://www.example.com/jobs/agency-wordpress',
    description:
      'Maintain client WordPress sites and build PHP/jQuery themes for a regional marketing agency. On-site, with occasional design work.',
    posted_at: '2026-06-04T00:00:00.000Z',
    state: 'dismissed',
    ...scored(
      22,
      'weak',
      'Weak fit: a PHP/WordPress maintenance role well below your seniority and salary target, with no modern React/TypeScript work. Dismissed.',
      [],
      ['WordPress/PHP', 'Salary band', 'Below seniority'],
    ),
  }),
];

// Per-tab counts for the Discovery view — derived from the fixtures so every tab's
// count matches the cards it actually shows (mirrors what the real query computes).
export const DEMO_JOB_COUNTS: Record<JobState, number> = {
  new: DEMO_JOBS.filter((j) => j.state === 'new').length,
  saved: DEMO_JOBS.filter((j) => j.state === 'saved').length,
  dismissed: DEMO_JOBS.filter((j) => j.state === 'dismissed').length,
  promoted: DEMO_JOBS.filter((j) => j.state === 'promoted').length,
};

// Recent ingestion runs — feeds the command-bridge telemetry log.
export const DEMO_SOURCES: { type: string; last_run_at: string }[] = [
  { type: 'adzuna', last_run_at: '2026-06-12T07:40:00.000Z' },
  { type: 'greenhouse', last_run_at: '2026-06-12T07:10:00.000Z' },
  { type: 'remotive', last_run_at: '2026-06-11T22:05:00.000Z' },
  { type: 'lever', last_run_at: '2026-06-11T18:30:00.000Z' },
];

// Unified activity feed — mirrors `activity_events`, rendered by the same
// TELEMETRY strip as the real Needs-action page (category → color, newest first).
export const DEMO_ACTIVITY: {
  category: ActivityCategory;
  summary: string;
  created_at: string;
}[] = [
  {
    category: 'ingestion',
    summary: 'Ingestion run · 4 sources — 14 fetched · 11 new · 3 updated',
    created_at: '2026-06-12T07:40:00.000Z',
  },
  {
    category: 'job',
    summary: 'Scored 8 jobs against your profile',
    created_at: '2026-06-12T07:06:00.000Z',
  },
  {
    category: 'application',
    summary: 'Philips · Full-stack Engineer → Screening',
    created_at: '2026-06-12T06:30:00.000Z',
  },
  {
    category: 'application',
    summary: 'Bol.com · Senior Frontend Engineer → Interview',
    created_at: '2026-06-11T17:00:00.000Z',
  },
  {
    category: 'application',
    summary: 'ASML · Senior Frontend Engineer → Interview',
    created_at: '2026-06-11T15:20:00.000Z',
  },
  {
    category: 'application',
    summary: 'Mollie · Frontend Engineer → Offer',
    created_at: '2026-06-11T11:45:00.000Z',
  },
  {
    category: 'profile',
    summary: 'Updated profile — skills & CV',
    created_at: '2026-06-11T09:50:00.000Z',
  },
  {
    category: 'source',
    summary: 'Added source · Greenhouse — Adyen',
    created_at: '2026-06-11T09:30:00.000Z',
  },
];

// --------------------------------------------------------------------------- applications
function application(
  partial: Partial<ApplicationRow> &
    Pick<ApplicationRow, 'id' | 'company' | 'role' | 'status'>,
): ApplicationRow {
  return {
    user_id: DEMO_USER,
    job_id: null,
    company_id: null,
    location: null,
    mode: null,
    channel: null,
    salary: null,
    link: null,
    contact: null,
    date_applied: null,
    next_action: null,
    next_action_date: null,
    notes: null,
    created_at: NOW,
    updated_at: NOW,
    ...partial,
  };
}

export const DEMO_APPLICATIONS: ApplicationRow[] = [
  application({
    id: 'demo-app-1',
    job_id: 'demo-job-1',
    company: 'ASML',
    role: 'Senior Frontend Engineer',
    location: 'Eindhoven',
    mode: 'Hybrid',
    channel: 'Recruiter',
    status: 'Interview',
    salary: '€75–90k',
    link: 'https://www.example.com/jobs/asml-senior-frontend',
    date_applied: '2026-06-02',
    next_action: 'Prep the system-design round',
    next_action_date: '2026-06-10', // overdue
    updated_at: '2026-06-11T15:20:00.000Z',
  }),
  application({
    id: 'demo-app-2',
    job_id: 'demo-job-3',
    company: 'Booking.com',
    role: 'Frontend Engineer',
    location: 'Amsterdam',
    mode: 'Hybrid',
    channel: 'Direct',
    status: 'Applied',
    salary: '€68–85k',
    date_applied: '2026-06-04',
    next_action: 'Follow up with the hiring manager',
    next_action_date: '2026-06-09', // overdue
    updated_at: '2026-06-09T09:00:00.000Z',
  }),
  application({
    id: 'demo-app-3',
    job_id: 'demo-job-2',
    company: 'Philips',
    role: 'Full-stack Engineer (React / Node)',
    location: 'Eindhoven',
    mode: 'Hybrid',
    channel: 'Referral',
    status: 'Screening',
    salary: '€65–82k',
    date_applied: '2026-06-06',
    next_action: 'Reply to recruiter with availability',
    next_action_date: '2026-06-12', // due today
    updated_at: '2026-06-12T06:30:00.000Z',
  }),
  application({
    id: 'demo-app-4',
    company: 'Mollie',
    role: 'Frontend Engineer',
    location: 'Remote — NL',
    mode: 'Remote',
    channel: 'LinkedIn',
    status: 'Offer',
    salary: '€95k',
    date_applied: '2026-05-20',
    next_action: 'Review the offer letter',
    next_action_date: '2026-06-16', // upcoming
    updated_at: '2026-06-11T11:45:00.000Z',
  }),
  application({
    id: 'demo-app-5',
    job_id: 'demo-job-4',
    company: 'GitLab',
    role: 'Frontend Engineer (Remote, EU)',
    location: 'Remote — EU',
    mode: 'Remote',
    channel: 'Direct',
    status: 'To apply',
    salary: '€72–95k',
    updated_at: '2026-06-08T12:00:00.000Z',
  }),
  application({
    id: 'demo-app-6',
    job_id: 'demo-job-6',
    company: 'Adyen',
    role: 'Senior React Engineer',
    location: 'Amsterdam',
    mode: 'On-site',
    channel: 'Recruiter',
    status: 'Rejected',
    date_applied: '2026-05-12',
    notes: 'Wanted on-site 5 days/week.',
    updated_at: '2026-06-05T16:00:00.000Z',
  }),
  application({
    id: 'demo-app-7',
    job_id: 'demo-job-8',
    company: 'TomTom',
    role: 'Frontend Engineer — Maps',
    location: 'Amsterdam',
    mode: 'Hybrid',
    channel: 'LinkedIn',
    status: 'Screening',
    salary: '€62–80k',
    date_applied: '2026-06-03',
    next_action: 'Send code sample to recruiter',
    next_action_date: '2026-06-11', // overdue
    updated_at: '2026-06-10T14:10:00.000Z',
  }),
  application({
    id: 'demo-app-8',
    job_id: 'demo-job-9',
    company: 'Backbase',
    role: 'React Developer',
    location: 'Amsterdam',
    mode: 'Hybrid',
    channel: 'Brainport portal',
    status: 'Applied',
    salary: '€58–72k',
    date_applied: '2026-06-07',
    next_action: 'Expect recruiter screen',
    next_action_date: '2026-06-18', // upcoming
    updated_at: '2026-06-07T10:30:00.000Z',
  }),
  application({
    id: 'demo-app-9',
    company: 'Bol.com',
    role: 'Senior Frontend Engineer',
    location: 'Utrecht',
    mode: 'Hybrid',
    channel: 'Recruiter',
    status: 'Interview',
    salary: '€70–88k',
    date_applied: '2026-05-28',
    next_action: 'On-site loop — confirm logistics',
    next_action_date: '2026-06-12', // due today
    updated_at: '2026-06-11T17:00:00.000Z',
  }),
  application({
    id: 'demo-app-10',
    company: 'Picnic',
    role: 'Frontend Engineer',
    location: 'Amsterdam',
    mode: 'On-site',
    channel: 'Direct',
    status: 'To apply',
    salary: '€60–78k',
    updated_at: '2026-06-12T05:00:00.000Z',
  }),
  application({
    id: 'demo-app-11',
    job_id: 'demo-job-5',
    company: 'NXP Semiconductors',
    role: 'Embedded C++ Engineer',
    location: 'Eindhoven',
    mode: 'On-site',
    channel: 'Detachering',
    status: 'Rejected',
    date_applied: '2026-05-08',
    notes: 'Not a frontend role — withdrew after the screen.',
    updated_at: '2026-05-30T13:00:00.000Z',
  }),
  application({
    id: 'demo-app-12',
    company: 'Coolblue',
    role: 'Frontend Engineer',
    location: 'Rotterdam',
    mode: 'Hybrid',
    channel: 'Direct',
    status: 'Closed',
    date_applied: '2026-05-15',
    notes: 'Role was put on hold by the company.',
    updated_at: '2026-06-01T08:00:00.000Z',
  }),
];

// --------------------------------------------------------------------------- profile
export const DEMO_PROFILE: ProfileRow = {
  user_id: DEMO_USER,
  full_name: 'Alex de Vries',
  headline: 'Senior Frontend Engineer',
  location: 'Eindhoven, NL',
  summary:
    'Frontend-leaning full-stack engineer with 7 years building data-dense React/TypeScript products. Looking for senior IC roles in the Brainport region or remote-EU.',
  seniority: 'senior',
  skills: ['React', 'TypeScript', 'Next.js', 'Node', 'GraphQL', 'Tailwind', 'Testing'],
  target_roles: ['Frontend Engineer', 'Full-stack Engineer'],
  target_locations: ['Eindhoven', 'Remote (NL)'],
  target_salary_min: 70000,
  work_modes: ['Hybrid', 'Remote'],
  languages: ['English', 'Dutch'],
  links: [],
  cv_text: null,
  cv_file_path: null,
  created_at: NOW,
  updated_at: NOW,
};
