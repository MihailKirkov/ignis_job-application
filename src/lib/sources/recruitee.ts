import type { FetchContext, NormalizedJob } from './types';
import { guessMode, stripHtml, toIsoDate } from '@/lib/discovery/normalize';

// Recruitee public Careers Site API (no auth — popular with NL/EU employers).
// GET https://{token}.recruitee.com/api/offers/  ->  { offers: [...] }
// Docs: https://docs.recruitee.com/reference/intro-to-careers-site-api
// `token` is the careers-site subdomain, e.g. "acme" for acme.recruitee.com.

interface RecruiteeLocation {
  city?: string | null;
  country?: string | null;
  full_address?: string | null;
}

interface RecruiteeSalary {
  min?: string | number | null;
  max?: string | number | null;
  currency?: string | null;
  period?: string | null;
}

interface RecruiteeOffer {
  id?: number;
  title?: string;
  slug?: string;
  description?: string;
  requirements?: string;
  status?: string;
  careers_url?: string;
  careers_apply_url?: string;
  created_at?: string;
  published_at?: string;
  remote?: boolean;
  hybrid?: boolean;
  on_site?: boolean;
  // The current API returns a `locations` array; older payloads expose flat
  // city/country fields. Handle both.
  city?: string | null;
  country?: string | null;
  locations?: RecruiteeLocation[];
  salary?: RecruiteeSalary | null;
}

function formatLocation(offer: RecruiteeOffer): string | null {
  const flat = [offer.city, offer.country].filter(Boolean).join(', ');
  if (flat) return flat;
  const first = offer.locations?.[0];
  if (first) {
    const parts = [first.city, first.country].filter(Boolean);
    if (parts.length) return parts.join(', ');
    if (first.full_address) return first.full_address;
  }
  return null;
}

// Recruitee salary can be hourly/monthly/yearly; only surface figures that look
// like real money (≥1000) so we don't show an hourly rate as a salary band.
function parseAmount(v: string | number | null | undefined): number | null {
  if (v == null) return null;
  const n = typeof v === 'number' ? v : parseFloat(v.replace(/[^\d.]/g, ''));
  return Number.isFinite(n) && n >= 1000 ? Math.round(n) : null;
}

export async function fetchRecruitee(
  config: Record<string, unknown>,
  ctx: FetchContext = {},
): Promise<NormalizedJob[]> {
  const token = (config as { token?: string }).token?.trim();
  if (!token) throw new Error('Recruitee source needs a careers-site subdomain in config.token.');
  const companyName = (config as { name?: string }).name ?? token;
  const doFetch = ctx.fetchImpl ?? fetch;

  const res = await doFetch(
    `https://${encodeURIComponent(token)}.recruitee.com/api/offers/`,
    { headers: { Accept: 'application/json' } },
  );
  if (!res.ok) throw new Error(`Recruitee error ${res.status} for company "${token}"`);

  const json = (await res.json()) as { offers?: RecruiteeOffer[] };
  const out: NormalizedJob[] = [];
  for (const o of json.offers ?? []) {
    if (o.id == null || !o.title) continue;
    if (o.status && o.status !== 'published') continue;
    const location = formatLocation(o);
    const description = stripHtml(o.description);
    const sMin = parseAmount(o.salary?.min);
    const sMax = parseAmount(o.salary?.max);
    out.push({
      source: 'recruitee',
      external_id: String(o.id),
      title: o.title,
      company: companyName,
      location,
      mode: o.remote
        ? 'Remote'
        : o.hybrid
          ? 'Hybrid'
          : o.on_site
            ? 'On-site'
            : guessMode(location, o.title, description),
      salary_min: sMin,
      salary_max: sMax,
      currency: sMin || sMax ? (o.salary?.currency ?? null) : null,
      url: o.careers_url ?? o.careers_apply_url ?? null,
      description,
      posted_at: toIsoDate(o.published_at ?? o.created_at ?? null),
      raw: o as Record<string, unknown>,
    });
  }
  return out;
}
