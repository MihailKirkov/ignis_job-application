import type { JobRow, WorkMode } from '@/types/database';
import type { NormalizedJob } from '@/lib/sources/types';
import type { FilterCriteria, LocationScope } from './filters';
import type { Seniority } from './normalize';

// Adapt a stored job row to the NormalizedJob shape the filter predicate expects.
export function jobRowToNormalized(r: JobRow): NormalizedJob {
  return {
    source: r.source,
    external_id: r.external_id,
    title: r.title,
    company: r.company,
    location: r.location,
    mode: r.mode as WorkMode | null,
    salary_min: r.salary_min,
    salary_max: r.salary_max,
    currency: r.currency,
    url: r.url,
    description: r.description,
    posted_at: r.posted_at,
    raw: r.raw,
  };
}

// Bidirectional mapping between FilterCriteria and URL search params, so the
// discovery inbox is fully shareable/bookmarkable and saved presets are just
// stored criteria. Pure + unit-tested.

const SCOPES: LocationScope[] = ['any', 'eindhoven', 'nl', 'remote'];
const MODES: WorkMode[] = ['On-site', 'Hybrid', 'Remote'];
const SENIORITIES: Exclude<Seniority, null>[] = [
  'intern',
  'junior',
  'medior',
  'senior',
  'lead',
  'principal',
];

function splitList(v: string | null | undefined): string[] {
  return (v ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

type Getter = { get(key: string): string | null };

export function criteriaFromParams(params: Getter): FilterCriteria {
  const criteria: FilterCriteria = {};

  const inc = splitList(params.get('inc'));
  if (inc.length) criteria.includeKeywords = inc;
  if (params.get('incMatch') === 'all') criteria.includeMatch = 'all';

  const exc = splitList(params.get('exc'));
  if (exc.length) criteria.excludeKeywords = exc;

  const loc = params.get('loc');
  if (loc && SCOPES.includes(loc as LocationScope) && loc !== 'any') {
    criteria.locationScope = loc as LocationScope;
  }
  const locText = params.get('locText');
  if (locText) criteria.locationText = locText;

  const salaryMin = Number(params.get('salaryMin'));
  if (Number.isFinite(salaryMin) && salaryMin > 0) criteria.salaryMin = salaryMin;

  const sen = splitList(params.get('sen')).filter((s) =>
    (SENIORITIES as string[]).includes(s),
  ) as Seniority[];
  if (sen.length) criteria.seniority = sen;

  const mode = splitList(params.get('mode')).filter((m) =>
    (MODES as string[]).includes(m),
  ) as WorkMode[];
  if (mode.length) criteria.mode = mode;

  const days = Number(params.get('days'));
  if (Number.isFinite(days) && days > 0) criteria.postedWithinDays = days;

  const src = splitList(params.get('src'));
  if (src.length) criteria.sources = src;

  const lang = params.get('lang');
  if (lang === 'en' || lang === 'nl') criteria.language = lang;

  return criteria;
}

// Serialize criteria into a flat record (for building URLs / storing presets).
export function criteriaToParams(criteria: FilterCriteria): Record<string, string> {
  const out: Record<string, string> = {};
  if (criteria.includeKeywords?.length) out.inc = criteria.includeKeywords.join(',');
  if (criteria.includeMatch === 'all') out.incMatch = 'all';
  if (criteria.excludeKeywords?.length) out.exc = criteria.excludeKeywords.join(',');
  if (criteria.locationScope && criteria.locationScope !== 'any')
    out.loc = criteria.locationScope;
  if (criteria.locationText) out.locText = criteria.locationText;
  if (typeof criteria.salaryMin === 'number') out.salaryMin = String(criteria.salaryMin);
  if (criteria.seniority?.length) out.sen = criteria.seniority.filter(Boolean).join(',');
  if (criteria.mode?.length) out.mode = criteria.mode.join(',');
  if (typeof criteria.postedWithinDays === 'number') out.days = String(criteria.postedWithinDays);
  if (criteria.sources?.length) out.src = criteria.sources.join(',');
  if (criteria.language) out.lang = criteria.language;
  return out;
}

export function isCriteriaEmpty(criteria: FilterCriteria): boolean {
  return Object.keys(criteriaToParams(criteria)).length === 0;
}
