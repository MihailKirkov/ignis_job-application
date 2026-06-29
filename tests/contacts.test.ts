import { describe, it, expect } from 'vitest';
import {
  buildCompanyPayload,
  buildContactPayload,
  cleanText,
  contactCompanyName,
  isValidEmail,
  normalizeChannel,
  normalizeEmail,
  normalizeUrl,
  validateCompany,
  validateContact,
  EMAIL_MAX_LENGTH,
  URL_MAX_LENGTH,
} from '@/lib/contacts';

describe('cleanText', () => {
  it('trims, drops empty -> null, clamps to max', () => {
    expect(cleanText('  hi  ')).toBe('hi');
    expect(cleanText('   ')).toBeNull();
    expect(cleanText(null)).toBeNull();
    expect(cleanText(undefined)).toBeNull();
    expect(cleanText('abcdef', 3)).toBe('abc');
  });
});

describe('normalizeEmail', () => {
  it('trims + lowercases, drops blank', () => {
    expect(normalizeEmail('  Jane.Doe@Example.COM ')).toBe('jane.doe@example.com');
    expect(normalizeEmail('')).toBeNull();
    expect(normalizeEmail(null)).toBeNull();
  });
  it('keeps the (possibly invalid) value for validation to catch, clamped', () => {
    // not dropped here — validateContact reports the typo
    expect(normalizeEmail('not-an-email')).toBe('not-an-email');
    const long = `${'a'.repeat(EMAIL_MAX_LENGTH + 50)}@x.io`;
    expect(normalizeEmail(long)!.length).toBeLessThanOrEqual(EMAIL_MAX_LENGTH);
  });
});

describe('isValidEmail', () => {
  it('accepts well-formed addresses and rejects junk', () => {
    expect(isValidEmail('a@b.co')).toBe(true);
    expect(isValidEmail('first.last@sub.domain.com')).toBe(true);
    expect(isValidEmail('no-at')).toBe(false);
    expect(isValidEmail('no@domain')).toBe(false);
    expect(isValidEmail('a b@c.com')).toBe(false);
  });
});

describe('normalizeUrl', () => {
  it('adds https:// when missing and requires a dotted host', () => {
    expect(normalizeUrl('linkedin.com/in/jane')).toBe('https://linkedin.com/in/jane');
    expect(normalizeUrl('https://acme.io')).toBe('https://acme.io');
    expect(normalizeUrl('http://x.dev/path')).toBe('http://x.dev/path');
  });
  it('returns null for blank or hostless input', () => {
    expect(normalizeUrl('')).toBeNull();
    expect(normalizeUrl(null)).toBeNull();
    expect(normalizeUrl('localhost')).toBeNull();
    expect(normalizeUrl('just words')).toBeNull();
  });
  it('clamps very long urls', () => {
    const long = `https://acme.io/${'a'.repeat(URL_MAX_LENGTH + 100)}`;
    expect(normalizeUrl(long)!.length).toBeLessThanOrEqual(URL_MAX_LENGTH);
  });
});

describe('normalizeChannel', () => {
  it('keeps canonical channels, nulls anything else', () => {
    expect(normalizeChannel('Detachering')).toBe('Detachering');
    expect(normalizeChannel('Referral')).toBe('Referral');
    expect(normalizeChannel('detachering')).toBeNull(); // case-sensitive vocab
    expect(normalizeChannel('Carrier pigeon')).toBeNull();
    expect(normalizeChannel(null)).toBeNull();
  });
});

describe('buildCompanyPayload + validateCompany', () => {
  it('normalizes fields', () => {
    const p = buildCompanyPayload({
      name: '  Sioux  ',
      website: 'sioux.eu',
      location: ' Eindhoven ',
      ats_type: 'greenhouse',
      notes: '  detachering partner  ',
    });
    expect(p).toEqual({
      name: 'Sioux',
      website: 'https://sioux.eu',
      location: 'Eindhoven',
      ats_type: 'greenhouse',
      notes: 'detachering partner',
    });
    expect(validateCompany(p)).toBeNull();
  });
  it('requires a name', () => {
    const p = buildCompanyPayload({ name: '   ' });
    expect(validateCompany(p)).toMatch(/name is required/i);
  });
});

describe('buildContactPayload + validateContact', () => {
  it('normalizes all fields', () => {
    const p = buildContactPayload({
      name: '  Jane Doe ',
      role: 'Recruiter',
      email: ' Jane@Sioux.EU ',
      linkedin_url: 'linkedin.com/in/jane',
      channel: 'LinkedIn',
      notes: 'met at meetup',
      last_contacted_at: '2026-06-01',
      next_follow_up_at: '2026-07-01',
    });
    expect(p).toEqual({
      name: 'Jane Doe',
      role: 'Recruiter',
      email: 'jane@sioux.eu',
      linkedin_url: 'https://linkedin.com/in/jane',
      channel: 'LinkedIn',
      notes: 'met at meetup',
      last_contacted_at: '2026-06-01',
      next_follow_up_at: '2026-07-01',
    });
    expect(validateContact(p)).toBeNull();
  });
  it('requires a name', () => {
    expect(validateContact(buildContactPayload({ name: '' }))).toMatch(/name is required/i);
  });
  it('rejects a malformed email', () => {
    const p = buildContactPayload({ name: 'X', email: 'broken@nope' });
    expect(validateContact(p)).toMatch(/email looks invalid/i);
  });
});

describe('contactCompanyName', () => {
  it('extracts and cleans the free-text company name', () => {
    expect(contactCompanyName({ name: 'X', company: '  Sioux ' })).toBe('Sioux');
    expect(contactCompanyName({ name: 'X' })).toBeNull();
    expect(contactCompanyName({ name: 'X', company: '  ' })).toBeNull();
  });
});
