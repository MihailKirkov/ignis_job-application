import { describe, it, expect } from 'vitest';
import { AI_MODEL, buildPrefillPrompt, buildScorePrompt } from '@/lib/ai/prompt';
import type { ScoringJob, ScoringProfile } from '@/lib/ai/types';

const profile: ScoringProfile = {
  headline: 'Frontend Engineer',
  seniority: 'medior',
  skills: ['React', 'TypeScript'],
  target_roles: ['Frontend Engineer'],
  target_locations: ['Eindhoven'],
  target_salary_min: 60000,
  work_modes: ['Hybrid'],
  languages: ['English'],
  summary: 'Builds web apps.',
  cv_text: 'x'.repeat(20000),
};

const job: ScoringJob = {
  title: 'Senior React Engineer',
  company: 'ASML',
  location: 'Eindhoven, NL',
  mode: 'Hybrid',
  salary_min: 65000,
  salary_max: 80000,
  currency: 'EUR',
  description: 'We use React and TypeScript.',
};

describe('buildScorePrompt', () => {
  it('targets the fast Haiku model and a bounded max_tokens', () => {
    const req = buildScorePrompt(profile, job);
    expect(req.model).toBe(AI_MODEL);
    expect(AI_MODEL).toBe('claude-haiku-4-5');
    expect(req.max_tokens).toBeGreaterThan(0);
    expect(req.messages).toHaveLength(1);
    expect(req.messages[0].role).toBe('user');
  });

  it('asks for strict JSON with the agreed shape', () => {
    const req = buildScorePrompt(profile, job);
    expect(req.system).toMatch(/STRICT JSON/i);
    expect(req.system).toContain('"score"');
    expect(req.system).toContain('"verdict"');
    expect(req.system).toContain('matched_skills');
    expect(req.system).toContain('gaps');
  });

  it('includes the profile and job content', () => {
    const content = buildScorePrompt(profile, job).messages[0].content;
    expect(content).toContain('Frontend Engineer');
    expect(content).toContain('React');
    expect(content).toContain('Senior React Engineer');
    expect(content).toContain('ASML');
  });

  it('clamps long CV text so the prompt stays bounded', () => {
    const content = buildScorePrompt(profile, job).messages[0].content;
    // 20k chars of CV must be truncated well below 20k in the rendered prompt.
    expect(content.length).toBeLessThan(15000);
  });

  it('renders empty/optional fields without crashing', () => {
    const req = buildScorePrompt({}, { title: 'Engineer' });
    expect(req.messages[0].content).toContain('Engineer');
    expect(req.messages[0].content).toContain('(none given)');
  });
});

describe('buildPrefillPrompt', () => {
  it('asks for the four profile fields as strict JSON', () => {
    const req = buildPrefillPrompt('Jane Doe — Senior Engineer at ASML');
    expect(req.model).toBe(AI_MODEL);
    expect(req.system).toMatch(/STRICT JSON/i);
    expect(req.system).toContain('skills');
    expect(req.system).toContain('seniority');
    expect(req.system).toContain('target_roles');
    expect(req.messages[0].content).toContain('Jane Doe');
  });
});
