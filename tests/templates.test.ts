import { describe, it, expect } from 'vitest';
import {
  buildTemplatePayload,
  extractVars,
  fillTemplate,
  normalizeTemplateKind,
  validateTemplate,
} from '@/lib/templates';

describe('fillTemplate', () => {
  it('substitutes known tokens with provided values', () => {
    expect(
      fillTemplate('Hi {contact} at {company} — interested in {role}.', {
        contact: 'Mara',
        company: 'Sioux',
        role: 'Frontend Engineer',
      }),
    ).toBe('Hi Mara at Sioux — interested in Frontend Engineer.');
  });

  it('is case-insensitive and tolerates inner whitespace', () => {
    expect(fillTemplate('{COMPANY} / { company }', { company: 'Acme' })).toBe('Acme / Acme');
  });

  it('leaves a token intact when its value is missing or empty', () => {
    expect(fillTemplate('Hi {contact} at {company}', { company: 'Acme' })).toBe(
      'Hi {contact} at Acme',
    );
    expect(fillTemplate('Hi {contact}', { contact: '' })).toBe('Hi {contact}');
    expect(fillTemplate('Hi {contact}', { contact: null })).toBe('Hi {contact}');
  });

  it('leaves unknown tokens intact', () => {
    expect(fillTemplate('Ref {ticket}', { company: 'Acme' })).toBe('Ref {ticket}');
  });

  it('is idempotent over already-filled text', () => {
    const once = fillTemplate('{company}', { company: 'Acme' });
    expect(fillTemplate(once, { company: 'Acme' })).toBe('Acme');
  });

  it('returns empty string for null/empty input', () => {
    expect(fillTemplate(null, { company: 'Acme' })).toBe('');
    expect(fillTemplate('', { company: 'Acme' })).toBe('');
  });
});

describe('extractVars', () => {
  it('returns distinct lower-cased keys in first-seen order', () => {
    expect(extractVars('{company} needs {Role}; ping {company} re {stack}')).toEqual([
      'company',
      'role',
      'stack',
    ]);
  });

  it('returns [] when there are no tokens', () => {
    expect(extractVars('plain text')).toEqual([]);
    expect(extractVars(null)).toEqual([]);
  });
});

describe('normalizeTemplateKind', () => {
  it('passes a known kind through', () => {
    expect(normalizeTemplateKind('follow_up')).toBe('follow_up');
  });
  it('falls back to "other" for unknown/blank/non-string', () => {
    expect(normalizeTemplateKind('nope')).toBe('other');
    expect(normalizeTemplateKind('')).toBe('other');
    expect(normalizeTemplateKind(null)).toBe('other');
  });
});

describe('buildTemplatePayload', () => {
  it('trims, coerces the kind, and defaults the body to empty string', () => {
    expect(
      buildTemplatePayload({ name: '  DM  ', kind: 'recruiter_dm', subject: ' Hi ', body: ' yo ' }),
    ).toEqual({ name: 'DM', kind: 'recruiter_dm', subject: 'Hi', body: 'yo' });
  });

  it('null subject and missing body collapse correctly', () => {
    const p = buildTemplatePayload({ name: 'X', body: '   ' });
    expect(p.subject).toBeNull();
    expect(p.body).toBe('');
    expect(p.kind).toBe('other');
  });
});

describe('validateTemplate', () => {
  it('requires a name', () => {
    expect(validateTemplate(buildTemplatePayload({ body: 'hi' }))).toMatch(/name/i);
  });
  it('requires a body', () => {
    expect(validateTemplate(buildTemplatePayload({ name: 'X' }))).toMatch(/body/i);
  });
  it('passes a complete template', () => {
    expect(validateTemplate(buildTemplatePayload({ name: 'X', body: 'hi {company}' }))).toBeNull();
  });
});
