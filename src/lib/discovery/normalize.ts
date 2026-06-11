import type { WorkMode } from '@/types/database';

// ---------------------------------------------------------------------------
// String helpers
// ---------------------------------------------------------------------------

export function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

// Strip HTML tags + decode a handful of common entities. Sources like Adzuna
// wrap matched terms in <strong>, and ATS descriptions are full HTML.
export function stripHtml(input: string | null | undefined): string | null {
  if (!input) return null;
  const text = input
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return text === '' ? null : text;
}

// Lowercase, strip accents, drop punctuation, collapse whitespace.
export function slugifyLoose(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

// Noise commonly bolted onto job titles that shouldn't affect dedupe identity.
const TITLE_NOISE =
  /\b(m\/?f\/?d|m\/?w\/?d|h\/?f|all genders?|fulltime|full[ -]?time|part[ -]?time|remote|hybrid|on[ -]?site|onsite|permanent|contract|freelance|intern(ship)?)\b/gi;

// Build the fuzzy identity key from company + title + location. Two postings
// that produce the same key are treated as the same role for dedupe purposes.
export function fuzzyKey(
  company: string | null | undefined,
  title: string | null | undefined,
  location: string | null | undefined,
): string {
  const c = slugifyLoose(company ?? '');
  const t = slugifyLoose((title ?? '').replace(TITLE_NOISE, ' '));
  // Only the first location token (city) matters; "Eindhoven, NL" ~= "Eindhoven".
  const l = slugifyLoose((location ?? '').split(/[,/|]/)[0] ?? '');
  return [c, t, l].join('|');
}

// ---------------------------------------------------------------------------
// Seniority guess
// ---------------------------------------------------------------------------

export type Seniority =
  | 'intern'
  | 'junior'
  | 'medior'
  | 'senior'
  | 'lead'
  | 'principal'
  | null;

export function guessSeniority(title: string | null | undefined): Seniority {
  const t = (title ?? '').toLowerCase();
  if (/\b(intern|internship|werkstudent|working student|trainee|graduate)\b/.test(t))
    return 'intern';
  if (/\b(principal|staff|architect)\b/.test(t)) return 'principal';
  if (/\b(lead|head of|manager|director|vp)\b/.test(t)) return 'lead';
  if (/\b(senior|sr\.?|sr|expert|experienced)\b/.test(t)) return 'senior';
  if (/\b(junior|jr\.?|jr|entry[ -]?level|associate)\b/.test(t)) return 'junior';
  if (/\b(medior|mid[ -]?level|mid)\b/.test(t)) return 'medior';
  return null;
}

// ---------------------------------------------------------------------------
// Work-mode guess
// ---------------------------------------------------------------------------

export function guessMode(
  ...parts: Array<string | null | undefined>
): WorkMode | null {
  const text = parts.filter(Boolean).join(' ').toLowerCase();
  if (!text) return null;
  if (/\bhybrid\b/.test(text)) return 'Hybrid';
  if (/\b(remote|work from home|wfh|anywhere|telecommute)\b/.test(text))
    return 'Remote';
  if (/\b(on[ -]?site|onsite|in[ -]?office|office[ -]?based)\b/.test(text))
    return 'On-site';
  return null;
}

// ---------------------------------------------------------------------------
// Salary parsing — best-effort, returns numbers in major currency units.
// ---------------------------------------------------------------------------

const CURRENCY_SYMBOLS: Record<string, string> = {
  '€': 'EUR',
  $: 'USD',
  '£': 'GBP',
};

export interface ParsedSalary {
  min: number | null;
  max: number | null;
  currency: string | null;
}

// Expands "60k" → 60000, "1.2k" → 1200.
function expandK(numText: string): number {
  const hasK = /k$/i.test(numText);
  const n = parseFloat(numText.replace(/[,\sk]/gi, (m) => (m === ',' ? '' : '')));
  const base = parseFloat(numText.replace(/[, ]/g, '').replace(/k$/i, ''));
  if (Number.isNaN(base)) return NaN;
  return hasK ? base * 1000 : n || base;
}

// Parses free-text salary like "€55,000 - €70,000", "$120k", "40k–55k EUR".
export function parseSalary(input: string | null | undefined): ParsedSalary {
  const empty: ParsedSalary = { min: null, max: null, currency: null };
  if (!input) return empty;
  const text = input.trim();
  if (!text) return empty;

  let currency: string | null = null;
  for (const [sym, code] of Object.entries(CURRENCY_SYMBOLS)) {
    if (text.includes(sym)) currency = code;
  }
  const codeMatch = text.match(/\b(EUR|USD|GBP)\b/i);
  if (codeMatch) currency = codeMatch[1].toUpperCase();

  // Grab number-ish tokens (with optional k suffix), ignoring "401k"-style noise
  // by requiring them to look like money (3+ digits, or a k suffix).
  const tokens = text.match(/\d[\d.,]*\s*k?/gi) ?? [];
  const nums = tokens
    .map((t) => expandK(t.replace(/\s+/g, '')))
    .filter((n) => !Number.isNaN(n) && n >= 1000);

  if (nums.length === 0) return { min: null, max: null, currency };
  if (nums.length === 1) return { min: nums[0], max: null, currency };
  const sorted = [...nums].sort((a, b) => a - b);
  return { min: sorted[0], max: sorted[sorted.length - 1], currency };
}

// ---------------------------------------------------------------------------
// Date parsing → ISO string (or null)
// ---------------------------------------------------------------------------

export function toIsoDate(
  input: string | number | Date | null | undefined,
): string | null {
  if (input === null || input === undefined || input === '') return null;
  // Unix epoch seconds (RemoteOK style) vs ms.
  if (typeof input === 'number') {
    const ms = input < 1e12 ? input * 1000 : input;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  if (typeof input === 'string' && /^\d+$/.test(input)) {
    return toIsoDate(Number(input));
  }
  const d = new Date(input);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
