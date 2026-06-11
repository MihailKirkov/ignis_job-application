import { describe, it, expect } from 'vitest';
import {
  fuzzyKey,
  guessSeniority,
  guessMode,
  parseSalary,
  slugifyLoose,
  toIsoDate,
} from '@/lib/discovery/normalize';

describe('slugifyLoose', () => {
  it('lowercases, strips accents and punctuation', () => {
    expect(slugifyLoose('Señor Developer (m/f)')).toBe('senor developer m f');
    expect(slugifyLoose('  ASML  N.V. ')).toBe('asml n v');
  });
});

describe('fuzzyKey', () => {
  it('produces the same key for the same role despite noise', () => {
    const a = fuzzyKey('ASML', 'Senior Software Engineer (m/f/d)', 'Eindhoven, NL');
    const b = fuzzyKey('asml', 'Senior Software Engineer', 'Eindhoven');
    expect(a).toBe(b);
  });

  it('separates different companies / titles / cities', () => {
    const a = fuzzyKey('ASML', 'Backend Engineer', 'Eindhoven');
    const b = fuzzyKey('Philips', 'Backend Engineer', 'Eindhoven');
    const c = fuzzyKey('ASML', 'Frontend Engineer', 'Eindhoven');
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
  });

  it('uses only the first location token (city)', () => {
    expect(fuzzyKey('Acme', 'Dev', 'Eindhoven, Noord-Brabant, NL')).toBe(
      fuzzyKey('Acme', 'Dev', 'Eindhoven'),
    );
  });
});

describe('guessSeniority', () => {
  it.each([
    ['Senior Backend Engineer', 'senior'],
    ['Sr. Data Scientist', 'senior'],
    ['Junior Developer', 'junior'],
    ['Entry-level Analyst', 'junior'],
    ['Lead Platform Engineer', 'lead'],
    ['Head of Engineering', 'lead'],
    ['Principal Architect', 'principal'],
    ['Software Engineering Intern', 'intern'],
    ['Werkstudent Marketing', 'intern'],
    ['Mid-level Developer', 'medior'],
    ['Software Engineer', null],
  ])('%s -> %s', (title, expected) => {
    expect(guessSeniority(title)).toBe(expected);
  });
});

describe('guessMode', () => {
  it('detects hybrid before remote', () => {
    expect(guessMode('Hybrid remote role')).toBe('Hybrid');
  });
  it('detects remote', () => {
    expect(guessMode('Fully remote, work from home')).toBe('Remote');
  });
  it('detects on-site', () => {
    expect(guessMode('On-site in Eindhoven')).toBe('On-site');
  });
  it('returns null when unknown', () => {
    expect(guessMode('Eindhoven')).toBeNull();
    expect(guessMode(null, undefined)).toBeNull();
  });
});

describe('parseSalary', () => {
  it('parses a EUR range with thousands separators', () => {
    expect(parseSalary('€55,000 - €70,000')).toEqual({
      min: 55000,
      max: 70000,
      currency: 'EUR',
    });
  });
  it('expands k-notation', () => {
    expect(parseSalary('$120k')).toEqual({ min: 120000, max: null, currency: 'USD' });
    expect(parseSalary('40k–55k EUR')).toEqual({ min: 40000, max: 55000, currency: 'EUR' });
  });
  it('ignores sub-1000 noise and empty input', () => {
    expect(parseSalary('Competitive')).toEqual({ min: null, max: null, currency: null });
    expect(parseSalary('')).toEqual({ min: null, max: null, currency: null });
    expect(parseSalary(null)).toEqual({ min: null, max: null, currency: null });
  });
  it('detects GBP via code', () => {
    expect(parseSalary('60000 to 80000 GBP').currency).toBe('GBP');
  });
});

describe('toIsoDate', () => {
  it('handles epoch seconds (RemoteOK style)', () => {
    expect(toIsoDate(1700000000)).toBe('2023-11-14T22:13:20.000Z');
  });
  it('handles epoch as numeric string', () => {
    expect(toIsoDate('1700000000')).toBe('2023-11-14T22:13:20.000Z');
  });
  it('handles ISO strings', () => {
    expect(toIsoDate('2024-03-01T00:00:00Z')).toBe('2024-03-01T00:00:00.000Z');
  });
  it('returns null on garbage / empty', () => {
    expect(toIsoDate('not a date')).toBeNull();
    expect(toIsoDate(null)).toBeNull();
    expect(toIsoDate('')).toBeNull();
  });
});
