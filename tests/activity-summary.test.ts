import { describe, it, expect } from 'vitest';
import { buildActivitySummary, categoryFromType } from '@/lib/activity/summary';

describe('categoryFromType', () => {
  it('derives the category from the type prefix', () => {
    expect(categoryFromType('application.status_changed')).toBe('application');
    expect(categoryFromType('job.promoted')).toBe('job');
    expect(categoryFromType('profile.updated')).toBe('profile');
    expect(categoryFromType('source.toggled')).toBe('source');
    expect(categoryFromType('ingestion.completed')).toBe('ingestion');
    expect(categoryFromType('company.created')).toBe('company');
    expect(categoryFromType('contact.updated')).toBe('contact');
    expect(categoryFromType('outreach.logged')).toBe('outreach');
  });
});

describe('buildActivitySummary', () => {
  it('summarizes a status change with from/to', () => {
    expect(
      buildActivitySummary('application.status_changed', {
        from: 'Applied',
        to: 'Interview',
        company: 'ASML',
      }),
    ).toBe('ASML: Applied → Interview');
  });

  it('handles a status change without a prior status', () => {
    expect(
      buildActivitySummary('application.status_changed', { to: 'Offer', company: 'NXP' }),
    ).toBe('NXP → Offer');
  });

  it('summarizes a created application', () => {
    expect(
      buildActivitySummary('application.created', { company: 'Booking', role: 'Frontend Eng' }),
    ).toBe('Added Frontend Eng at Booking');
  });

  it('summarizes a promoted job', () => {
    expect(
      buildActivitySummary('job.promoted', { company: 'Stripe', role: 'Backend Eng', job_id: 'x' }),
    ).toBe('Promoted Backend Eng at Stripe to the pipeline');
  });

  it('lists changed fields for a profile update', () => {
    expect(buildActivitySummary('profile.updated', { changed: ['skills', 'cv'] })).toBe(
      'Updated profile (skills, cv)',
    );
    expect(buildActivitySummary('profile.updated', {})).toBe('Updated profile');
  });

  it('summarizes source add/toggle with a label', () => {
    expect(buildActivitySummary('source.added', { label: 'Greenhouse' })).toBe(
      'Added Greenhouse source',
    );
    expect(buildActivitySummary('source.toggled', { label: 'Lever', enabled: false })).toBe(
      'Disabled Lever source',
    );
  });

  it('shows fetched + new counts for an ingestion run', () => {
    expect(
      buildActivitySummary('ingestion.completed', { status: 'ok', fetched: 257, new: 18 }),
    ).toBe('Ingestion ok · 257 fetched · 18 new');
  });

  it('summarizes company events by name', () => {
    expect(buildActivitySummary('company.created', { name: 'Sioux' })).toBe('Added company Sioux');
    expect(buildActivitySummary('company.updated', { name: 'Sioux' })).toBe(
      'Updated company Sioux',
    );
    expect(buildActivitySummary('company.deleted', { name: 'Sioux' })).toBe('Removed company Sioux');
  });

  it('summarizes contact events by name + company', () => {
    expect(
      buildActivitySummary('contact.created', { name: 'Jane Doe', company: 'Sioux' }),
    ).toBe('Added contact Jane Doe at Sioux');
    expect(buildActivitySummary('contact.deleted', { name: 'Jane Doe' })).toBe(
      'Removed contact Jane Doe',
    );
  });

  it('summarizes outreach logged + status change', () => {
    expect(
      buildActivitySummary('outreach.logged', { channel: 'LinkedIn', company: 'Sioux' }),
    ).toBe('Logged LinkedIn at Sioux');
    expect(buildActivitySummary('outreach.logged', {})).toBe('Logged outreach');
    expect(
      buildActivitySummary('outreach.status_changed', {
        from: 'Sent',
        to: 'Replied',
        company: 'Sioux',
      }),
    ).toBe('Sioux: Sent → Replied');
  });

  it('never throws on missing meta', () => {
    expect(buildActivitySummary('application.created')).toContain('Added');
    expect(buildActivitySummary('ingestion.completed')).toBe(
      'Ingestion completed · 0 fetched · 0 new',
    );
  });
});
