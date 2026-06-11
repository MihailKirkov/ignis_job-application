import { describe, it, expect } from 'vitest';
import { parseImportPayload } from '@/lib/discovery/import-schema';

describe('parseImportPayload', () => {
  it('accepts a bare array and defaults source to "import"', () => {
    const { jobs, errors } = parseImportPayload([{ title: 'Engineer', company: 'Acme' }]);
    expect(errors).toEqual([]);
    expect(jobs).toHaveLength(1);
    expect(jobs[0].source).toBe('import');
    expect(jobs[0].external_id).toMatch(/^import_/);
  });

  it('accepts the { jobs: [...] } envelope', () => {
    const { jobs } = parseImportPayload({ jobs: [{ title: 'Dev' }] });
    expect(jobs).toHaveLength(1);
  });

  it('derives a stable external_id from content', () => {
    const a = parseImportPayload([{ title: 'Dev', company: 'Acme', url: 'u' }]).jobs[0];
    const b = parseImportPayload([{ title: 'Dev', company: 'Acme', url: 'u' }]).jobs[0];
    expect(a.external_id).toBe(b.external_id);
  });

  it('preserves an explicit external_id and source', () => {
    const { jobs } = parseImportPayload([
      { title: 'Dev', source: 'lever', external_id: 'L-1' },
    ]);
    expect(jobs[0]).toMatchObject({ source: 'lever', external_id: 'L-1' });
  });

  it('coerces numbers, validates mode, normalizes date', () => {
    const { jobs } = parseImportPayload([
      {
        title: 'Dev',
        salary_min: '50000',
        salary_max: 70000,
        mode: 'Hybrid',
        posted_at: 1700000000,
      },
    ]);
    expect(jobs[0]).toMatchObject({ salary_min: 50000, salary_max: 70000, mode: 'Hybrid' });
    expect(jobs[0].posted_at).toBe('2023-11-14T22:13:20.000Z');
  });

  it('drops an invalid mode to null', () => {
    const { jobs } = parseImportPayload([{ title: 'Dev', mode: 'Lunar' }]);
    expect(jobs[0].mode).toBeNull();
  });

  it('reports items missing a title and non-objects', () => {
    const { jobs, errors } = parseImportPayload([{ company: 'Acme' }, 42, { title: 'Ok' }]);
    expect(jobs).toHaveLength(1);
    expect(errors).toHaveLength(2);
  });

  it('rejects a non-list body', () => {
    const { jobs, errors } = parseImportPayload({ foo: 'bar' });
    expect(jobs).toEqual([]);
    expect(errors[0]).toMatch(/array of jobs/);
  });
});
