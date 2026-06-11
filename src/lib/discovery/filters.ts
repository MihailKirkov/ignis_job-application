import type { NormalizedJob } from '@/lib/sources/types';
import type { WorkMode } from '@/types/database';
import { guessMode, guessSeniority, type Seniority } from './normalize';

export type LocationScope = 'any' | 'eindhoven' | 'nl' | 'remote';

export interface FilterCriteria {
  // Keyword / stack include + exclude (matched against title+company+location+description).
  includeKeywords?: string[];
  includeMatch?: 'any' | 'all'; // default 'any'
  excludeKeywords?: string[];

  locationScope?: LocationScope;
  locationText?: string; // free-text location contains

  salaryMin?: number;

  seniority?: Seniority[]; // guessed from title
  mode?: WorkMode[];
  postedWithinDays?: number;
  sources?: string[];
  language?: 'en' | 'nl'; // naive guess
}

// Brainport-region towns treated as "around Eindhoven" (we have no geocoder, so
// radius is approximated by this town list).
const BRAINPORT_TOWNS = [
  'eindhoven',
  'veldhoven',
  'best',
  'son',
  'breugel',
  'nuenen',
  'geldrop',
  'mierlo',
  'helmond',
  'waalre',
  'valkenswaard',
  'oirschot',
  'tilburg',
  'den bosch',
  "'s-hertogenbosch",
  'shertogenbosch',
  'eersel',
  'high tech campus',
  'brainport',
];

const NL_HINTS = [
  'netherlands',
  'nederland',
  'holland',
  'amsterdam',
  'rotterdam',
  'utrecht',
  'the hague',
  'den haag',
  'eindhoven',
  'groningen',
  'nijmegen',
  'breda',
  'tilburg',
  'arnhem',
  'haarlem',
  'leiden',
  'delft',
  'maastricht',
  ', nl',
];

// A few Dutch stopwords; their presence flags a Dutch posting.
const DUTCH_WORDS = [
  ' de ',
  ' het ',
  ' een ',
  ' en ',
  ' van ',
  ' wij ',
  ' jij ',
  ' jouw ',
  ' werken ',
  ' ervaring ',
  ' gezocht ',
  ' vacature ',
];

function searchableText(job: NormalizedJob): string {
  return [job.title, job.company, job.location, job.description]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function guessLanguage(job: NormalizedJob): 'en' | 'nl' {
  const text = ` ${searchableText(job)} `;
  const hits = DUTCH_WORDS.reduce((n, w) => n + (text.includes(w) ? 1 : 0), 0);
  return hits >= 2 ? 'nl' : 'en';
}

function matchesLocationScope(job: NormalizedJob, scope: LocationScope): boolean {
  if (scope === 'any') return true;
  const loc = (job.location ?? '').toLowerCase();
  const text = searchableText(job);
  const mode = job.mode ?? guessMode(job.location, job.title, job.description);

  if (scope === 'remote') {
    return mode === 'Remote' || /\bremote\b/.test(text);
  }
  if (scope === 'eindhoven') {
    return BRAINPORT_TOWNS.some((t) => loc.includes(t));
  }
  if (scope === 'nl') {
    return NL_HINTS.some((h) => loc.includes(h)) || mode === 'Remote';
  }
  return true;
}

// Pure predicate — a job passes if it satisfies every active criterion.
export function matchesFilter(
  job: NormalizedJob,
  criteria: FilterCriteria,
  now: Date = new Date(),
): boolean {
  const text = searchableText(job);

  if (criteria.includeKeywords && criteria.includeKeywords.length > 0) {
    const terms = criteria.includeKeywords.map((k) => k.toLowerCase().trim()).filter(Boolean);
    if (terms.length > 0) {
      const test =
        criteria.includeMatch === 'all'
          ? terms.every((t) => text.includes(t))
          : terms.some((t) => text.includes(t));
      if (!test) return false;
    }
  }

  if (criteria.excludeKeywords && criteria.excludeKeywords.length > 0) {
    const terms = criteria.excludeKeywords.map((k) => k.toLowerCase().trim()).filter(Boolean);
    if (terms.some((t) => text.includes(t))) return false;
  }

  if (criteria.locationText && criteria.locationText.trim()) {
    if (!(job.location ?? '').toLowerCase().includes(criteria.locationText.toLowerCase().trim()))
      return false;
  }

  if (criteria.locationScope && !matchesLocationScope(job, criteria.locationScope))
    return false;

  if (typeof criteria.salaryMin === 'number') {
    const top = job.salary_max ?? job.salary_min;
    // Jobs with an unknown salary are kept (don't hide promising unknowns);
    // only reject when we know the salary is below the floor.
    if (top != null && top < criteria.salaryMin) return false;
  }

  if (criteria.seniority && criteria.seniority.length > 0) {
    const s = guessSeniority(job.title);
    if (!criteria.seniority.includes(s)) return false;
  }

  if (criteria.mode && criteria.mode.length > 0) {
    const m = job.mode ?? guessMode(job.location, job.title, job.description);
    if (!m || !criteria.mode.includes(m)) return false;
  }

  if (typeof criteria.postedWithinDays === 'number') {
    if (!job.posted_at) return false;
    const posted = new Date(job.posted_at).getTime();
    if (Number.isNaN(posted)) return false;
    const ageDays = (now.getTime() - posted) / 86_400_000;
    if (ageDays > criteria.postedWithinDays) return false;
  }

  if (criteria.sources && criteria.sources.length > 0) {
    if (!criteria.sources.includes(job.source)) return false;
  }

  if (criteria.language) {
    if (guessLanguage(job) !== criteria.language) return false;
  }

  return true;
}

export function filterJobs(
  jobs: NormalizedJob[],
  criteria: FilterCriteria,
  now: Date = new Date(),
): NormalizedJob[] {
  return jobs.filter((j) => matchesFilter(j, criteria, now));
}
