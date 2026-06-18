import { describe, it, expect } from 'vitest';
import { diffJobs, keyOf, runFetchers, summarizeRun, toJobRows } from '@/lib/discovery/ingest';
import type { NormalizedJob } from '@/lib/sources/types';
import type { SourceType } from '@/types/database';

function job(source: string, externalId: string): NormalizedJob {
  return {
    source,
    external_id: externalId,
    title: 'Engineer',
    company: 'Acme',
    location: 'NL',
    mode: null,
    salary_min: null,
    salary_max: null,
    currency: null,
    url: null,
    description: null,
    posted_at: null,
    raw: {},
  };
}

function source(type: SourceType, config: Record<string, unknown> = {}) {
  return { id: `src-${type}`, type, config };
}

describe('runFetchers', () => {
  it('isolates a failing source and still returns the others', async () => {
    // arbeitnow ok, adzuna fails (no keys) -> reported as error, not thrown.
    const okFetch = (async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        data: [{ slug: 's1', title: 'Dev', company_name: 'Acme', location: 'NL', remote: true, url: 'u', created_at: 1700000000 }],
      }),
    })) as unknown as typeof fetch;

    const { jobs, results } = await runFetchers(
      [source('arbeitnow'), source('adzuna')],
      { fetchImpl: okFetch },
    );

    expect(jobs).toHaveLength(1);
    const adzuna = results.find((r) => r.type === 'adzuna');
    const arbeitnow = results.find((r) => r.type === 'arbeitnow');
    expect(arbeitnow?.count).toBe(1);
    expect(adzuna?.error).toMatch(/ADZUNA/);
  });

  it('dedupes across sources in a single run', async () => {
    // Two sources return the same role; expect a single deduped job.
    const fetchImpl = (async (url: string) => {
      const isLever = url.includes('lever');
      const body = isLever
        ? [{ id: 'L1', text: 'Senior Engineer', categories: { location: 'Eindhoven' }, hostedUrl: 'h' }]
        : {
            data: [
              { slug: 'A1', title: 'Senior Engineer (m/f/d)', company_name: 'acme', location: 'Eindhoven, NL', remote: false, url: 'u', created_at: 1700000000 },
            ],
          };
      return { ok: true, status: 200, json: async () => body };
    }) as unknown as typeof fetch;

    const { jobs } = await runFetchers(
      [source('lever', { token: 'acme', name: 'acme' }), source('arbeitnow')],
      { fetchImpl },
    );
    expect(jobs).toHaveLength(1);
    expect(jobs[0].source).toBe('lever'); // ATS preferred over aggregator
  });
});

describe('toJobRows', () => {
  it('omits state/ingested_at and attaches user_id + fuzzy_key', () => {
    const rows = toJobRows('user-1', [
      {
        source: 'adzuna',
        external_id: '1',
        title: 'Engineer',
        company: 'Acme',
        location: 'Eindhoven',
        mode: null,
        salary_min: null,
        salary_max: null,
        currency: null,
        url: null,
        description: null,
        posted_at: null,
        raw: {},
      },
    ]);
    expect(rows[0]).toHaveProperty('user_id', 'user-1');
    expect(rows[0]).toHaveProperty('fuzzy_key');
    expect(rows[0]).not.toHaveProperty('state');
    expect(rows[0]).not.toHaveProperty('ingested_at');
  });
});

describe('diffJobs', () => {
  it('counts new vs already-present rows by natural key', () => {
    const jobs = [job('lever', '1'), job('lever', '2'), job('adzuna', '9')];
    const existing = new Set([keyOf('lever', '1')]);
    expect(diffJobs(jobs, existing)).toEqual({ new: 2, updated: 1 });
  });

  it('treats an empty inbox as all-new', () => {
    const jobs = [job('lever', '1'), job('lever', '2')];
    expect(diffJobs(jobs, new Set())).toEqual({ new: 2, updated: 0 });
  });

  it('distinguishes the same external_id across sources', () => {
    const jobs = [job('lever', '1'), job('adzuna', '1')];
    const existing = new Set([keyOf('lever', '1')]);
    expect(diffJobs(jobs, existing)).toEqual({ new: 1, updated: 1 });
  });
});

describe('summarizeRun', () => {
  const src = (
    status: 'ok' | 'error' | 'skipped',
    fetched: number,
    nw: number,
    updated: number,
  ) => ({ status, fetched, new: nw, updated });

  it('rolls per-source counts up to a run total', () => {
    const out = summarizeRun([src('ok', 200, 10, 190), src('ok', 57, 8, 49)]);
    expect(out).toEqual({ status: 'ok', sourcesRun: 2, fetched: 257, new: 18, updated: 239 });
  });

  it('is "partial" when some sources errored', () => {
    expect(summarizeRun([src('ok', 10, 10, 0), src('error', 0, 0, 0)]).status).toBe('partial');
  });

  it('is "error" when every source errored', () => {
    expect(summarizeRun([src('error', 0, 0, 0), src('error', 0, 0, 0)]).status).toBe('error');
  });

  it('is "ok" when a source ran clean but found nothing', () => {
    expect(summarizeRun([src('ok', 0, 0, 0)]).status).toBe('ok');
  });
});
