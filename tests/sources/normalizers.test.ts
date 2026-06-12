import { describe, it, expect } from 'vitest';
import { fetchAdzuna } from '@/lib/sources/adzuna';
import { fetchArbeitnow } from '@/lib/sources/arbeitnow';
import { fetchRemotive } from '@/lib/sources/remotive';
import { fetchRemoteOk } from '@/lib/sources/remoteok';
import { fetchGreenhouse } from '@/lib/sources/greenhouse';
import { fetchLever } from '@/lib/sources/lever';
import { fetchAshby } from '@/lib/sources/ashby';
import { fetchWorkable } from '@/lib/sources/workable';
import { fetchRecruitee } from '@/lib/sources/recruitee';
import { fetchSmartRecruiters } from '@/lib/sources/smartrecruiters';

// Minimal fetch stub. Returns the given JSON body; records the URL it was called with.
function stub(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  const calls: string[] = [];
  const impl = (async (url: string) => {
    calls.push(url);
    return {
      ok: init.ok ?? true,
      status: init.status ?? 200,
      json: async () => body,
    };
  }) as unknown as typeof fetch;
  return { impl, calls };
}

describe('adzuna', () => {
  const body = {
    results: [
      {
        id: 123,
        title: 'Senior <strong>React</strong> Engineer',
        company: { display_name: 'ASML' },
        location: { display_name: 'Eindhoven, Noord-Brabant' },
        salary_min: 60000,
        salary_max: 80000,
        created: '2026-06-01T00:00:00Z',
        redirect_url: 'https://adzuna/job/123',
        description: '<p>Build things</p>',
      },
    ],
  };

  it('normalizes and strips HTML from the title', async () => {
    const { impl, calls } = stub(body);
    const jobs = await fetchAdzuna(
      { query: 'react', where: 'Eindhoven', country: 'nl' },
      { adzunaAppId: 'id', adzunaAppKey: 'key', fetchImpl: impl },
    );
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      source: 'adzuna',
      external_id: '123',
      title: 'Senior React Engineer',
      company: 'ASML',
      salary_min: 60000,
      salary_max: 80000,
      currency: 'EUR',
      url: 'https://adzuna/job/123',
    });
    expect(jobs[0].posted_at).toBe('2026-06-01T00:00:00.000Z');
    expect(calls[0]).toContain('/jobs/nl/search/1');
    expect(calls[0]).toContain('what=react');
  });

  it('uses GBP for the gb country', async () => {
    const { impl } = stub(body);
    const jobs = await fetchAdzuna({ country: 'gb' }, { adzunaAppId: 'a', adzunaAppKey: 'b', fetchImpl: impl });
    expect(jobs[0].currency).toBe('GBP');
  });

  it('throws without API keys', async () => {
    await expect(fetchAdzuna({}, {})).rejects.toThrow(/ADZUNA_APP_ID/);
  });

  it('returns [] on 429 rate limit', async () => {
    const { impl } = stub({}, { ok: false, status: 429 });
    const jobs = await fetchAdzuna({}, { adzunaAppId: 'a', adzunaAppKey: 'b', fetchImpl: impl });
    expect(jobs).toEqual([]);
  });
});

describe('arbeitnow', () => {
  const body = {
    data: [
      { slug: 'a-1', title: 'Backend Dev', company_name: 'Acme', location: 'Berlin', remote: true, url: 'u', created_at: 1700000000 },
      { slug: 'a-2', title: 'Onsite Dev', company_name: 'Beta', location: 'Munich', remote: false, url: 'u2', created_at: 1700000000 },
    ],
  };
  it('maps fields and remote flag', async () => {
    const { impl } = stub(body);
    const jobs = await fetchArbeitnow({}, { fetchImpl: impl });
    expect(jobs).toHaveLength(2);
    expect(jobs[0].mode).toBe('Remote');
    expect(jobs[0].external_id).toBe('a-1');
  });
  it('filters to remote when config.remote is set', async () => {
    const { impl } = stub(body);
    const jobs = await fetchArbeitnow({ remote: true }, { fetchImpl: impl });
    expect(jobs.map((j) => j.external_id)).toEqual(['a-1']);
  });
});

describe('remotive', () => {
  it('parses the salary string and forces Remote mode', async () => {
    const body = {
      jobs: [
        {
          id: 55,
          title: 'Platform Engineer',
          company_name: 'Remote Co',
          candidate_required_location: 'Europe',
          salary: '€60,000 - €80,000',
          url: 'https://remotive/55',
          description: '<p>hi</p>',
          publication_date: '2026-05-20T00:00:00',
        },
      ],
    };
    const { impl } = stub(body);
    const jobs = await fetchRemotive({ search: 'go' }, { fetchImpl: impl });
    expect(jobs[0]).toMatchObject({
      source: 'remotive',
      external_id: '55',
      mode: 'Remote',
      salary_min: 60000,
      salary_max: 80000,
      currency: 'EUR',
    });
  });
});

describe('remoteok', () => {
  const body = [
    { legal: 'Use of this data...' },
    {
      id: 99,
      position: 'Rust Engineer',
      company: 'Ferris',
      location: 'Worldwide',
      url: 'https://remoteok/99',
      epoch: 1700000000,
      tags: ['rust', 'backend'],
      salary_min: 90000,
      salary_max: 120000,
    },
  ];
  it('skips the legal notice and sets USD', async () => {
    const { impl } = stub(body);
    const jobs = await fetchRemoteOk({}, { fetchImpl: impl });
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({ external_id: '99', currency: 'USD', mode: 'Remote' });
  });
  it('filters by tags', async () => {
    const { impl } = stub(body);
    expect(await fetchRemoteOk({ tags: 'python' }, { fetchImpl: impl })).toHaveLength(0);
    expect(await fetchRemoteOk({ tags: 'rust' }, { fetchImpl: impl })).toHaveLength(1);
  });
});

describe('greenhouse', () => {
  it('decodes entity-encoded content and labels the company', async () => {
    const body = {
      jobs: [
        {
          id: 7,
          title: 'Data Engineer',
          updated_at: '2026-06-02T10:00:00Z',
          absolute_url: 'https://boards/acme/7',
          location: { name: 'Amsterdam' },
          content: '&lt;p&gt;Join &amp; build&lt;/p&gt;',
        },
      ],
    };
    const { impl } = stub(body);
    const jobs = await fetchGreenhouse({ token: 'acme', name: 'Acme' }, { fetchImpl: impl });
    expect(jobs[0].company).toBe('Acme');
    expect(jobs[0].description).toBe('Join & build');
    expect(jobs[0].external_id).toBe('7');
  });
  it('throws without a token', async () => {
    await expect(fetchGreenhouse({}, {})).rejects.toThrow(/token/);
  });
});

describe('lever', () => {
  it('maps workplaceType to mode and text to title', async () => {
    const body = [
      {
        id: 'lev-1',
        text: 'Frontend Engineer',
        hostedUrl: 'https://jobs.lever.co/acme/lev-1',
        workplaceType: 'hybrid',
        createdAt: 1700000000000,
        categories: { location: 'Eindhoven' },
        descriptionPlain: 'Do frontend',
      },
    ];
    const { impl } = stub(body);
    const jobs = await fetchLever({ token: 'acme' }, { fetchImpl: impl });
    expect(jobs[0]).toMatchObject({ external_id: 'lev-1', title: 'Frontend Engineer', mode: 'Hybrid' });
  });
});

describe('ashby', () => {
  it('honours isRemote and parses compensation summary', async () => {
    const body = {
      jobs: [
        {
          id: 'ash-1',
          title: 'Security Engineer',
          location: 'Remote - EU',
          isRemote: true,
          descriptionPlain: 'Secure things',
          jobUrl: 'https://jobs.ashbyhq.com/acme/ash-1',
          publishedAt: '2026-06-03T00:00:00Z',
          compensationTierSummary: '€70,000 - €90,000',
        },
      ],
    };
    const { impl } = stub(body);
    const jobs = await fetchAshby({ token: 'acme' }, { fetchImpl: impl });
    expect(jobs[0]).toMatchObject({ external_id: 'ash-1', mode: 'Remote', salary_min: 70000, salary_max: 90000 });
  });
});

describe('workable', () => {
  it('uses shortcode, formats location, honours telecommuting and published state', async () => {
    const body = {
      jobs: [
        {
          id: 1,
          shortcode: 'ABC123',
          title: 'QA Engineer',
          state: 'published',
          telecommuting: true,
          url: 'https://apply.workable.com/acme/j/ABC123',
          published_on: '2026-06-04',
          location: { city: 'Eindhoven', country: 'Netherlands' },
          description: '<p>Test</p>',
        },
        { id: 2, shortcode: 'DRAFT1', title: 'Hidden', state: 'draft' },
      ],
    };
    const { impl } = stub(body);
    const jobs = await fetchWorkable({ token: 'acme', name: 'Acme' }, { fetchImpl: impl });
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      external_id: 'ABC123',
      company: 'Acme',
      mode: 'Remote',
      location: 'Eindhoven, Netherlands',
    });
  });
});

describe('recruitee', () => {
  const body = {
    offers: [
      {
        id: 4242,
        title: 'Backend Engineer',
        slug: 'backend-engineer',
        status: 'published',
        careers_url: 'https://acme.recruitee.com/o/backend-engineer',
        description: '<p>Build &amp; ship Go services</p>',
        published_at: '2026-06-05T09:00:00Z',
        hybrid: true,
        locations: [{ city: 'Eindhoven', country: 'Netherlands' }],
        salary: { min: '60000', max: '80000', currency: 'EUR', period: 'year' },
      },
      { id: 99, title: 'Draft role', status: 'draft' },
    ],
  };

  it('normalizes, honours hybrid, parses salary and skips drafts', async () => {
    const { impl, calls } = stub(body);
    const jobs = await fetchRecruitee({ token: 'acme', name: 'Acme' }, { fetchImpl: impl });
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      source: 'recruitee',
      external_id: '4242',
      title: 'Backend Engineer',
      company: 'Acme',
      location: 'Eindhoven, Netherlands',
      mode: 'Hybrid',
      salary_min: 60000,
      salary_max: 80000,
      currency: 'EUR',
      url: 'https://acme.recruitee.com/o/backend-engineer',
    });
    expect(jobs[0].description).toBe('Build & ship Go services');
    expect(calls[0]).toBe('https://acme.recruitee.com/api/offers/');
  });

  it('drops sub-1000 (hourly) salary figures', async () => {
    const { impl } = stub({
      offers: [
        {
          id: 1,
          title: 'Contractor',
          status: 'published',
          salary: { min: '40', max: '60', currency: 'EUR', period: 'hour' },
        },
      ],
    });
    const jobs = await fetchRecruitee({ token: 'acme' }, { fetchImpl: impl });
    expect(jobs[0]).toMatchObject({ salary_min: null, salary_max: null, currency: null });
  });

  it('throws without a token', async () => {
    await expect(fetchRecruitee({}, {})).rejects.toThrow(/subdomain/);
  });
});

describe('smartrecruiters', () => {
  const body = {
    offset: 0,
    limit: 100,
    totalFound: 1,
    content: [
      {
        id: 744000131436848,
        uuid: 'a8a3b1a8-d3d2-4470-aa87-c5b6227eae12',
        name: 'Senior Security Engineer',
        refNumber: 'REF2010Z',
        releasedDate: '2026-06-10T12:07:26.341Z',
        company: { identifier: 'acme', name: 'Acme Inc' },
        location: { city: 'Amsterdam', region: 'North Holland', country: 'nl', remote: false },
      },
    ],
  };

  it('maps content[], builds the public posting URL and prefers config name', async () => {
    const { impl, calls } = stub(body);
    const jobs = await fetchSmartRecruiters({ token: 'acme', name: 'Acme' }, { fetchImpl: impl });
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      source: 'smartrecruiters',
      external_id: '744000131436848',
      title: 'Senior Security Engineer',
      company: 'Acme',
      location: 'Amsterdam, North Holland',
      url: 'https://jobs.smartrecruiters.com/acme/744000131436848',
    });
    expect(jobs[0].posted_at).toBe('2026-06-10T12:07:26.341Z');
    expect(calls[0]).toContain('/v1/companies/acme/postings');
  });

  it('forces Remote mode and strips the REMOTE region token from the location', async () => {
    const { impl } = stub({
      content: [
        {
          id: 1,
          name: 'Remote Dev',
          location: { city: 'Poland', region: 'REMOTE', country: 'pl', remote: true },
        },
      ],
    });
    const jobs = await fetchSmartRecruiters({ token: 'acme' }, { fetchImpl: impl });
    expect(jobs[0]).toMatchObject({ mode: 'Remote', location: 'Poland', company: 'acme' });
  });

  it('throws without a token', async () => {
    await expect(fetchSmartRecruiters({}, {})).rejects.toThrow(/company identifier/);
  });
});
