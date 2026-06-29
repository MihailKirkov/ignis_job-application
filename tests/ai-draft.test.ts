import { describe, it, expect, vi } from 'vitest';
import { buildDraftPrompt } from '@/lib/ai/prompt';
import { parseDraftResponse } from '@/lib/ai/parse';
import { runDraft } from '@/lib/ai/score';
import type { DraftRequest, ModelCall, ModelRequest } from '@/lib/ai/types';

function cannedCall(output: string): ModelCall {
  return vi.fn(async () => output);
}

const baseReq: DraftRequest = {
  kind: 'Recruiter DM',
  template: 'Hi {contact}, I am keen on roles at {company}.',
  subject: null,
  company: 'Sioux',
  role: 'Frontend Engineer',
  stack: ['React', 'TypeScript'],
  contactName: 'Mara',
  contactRole: 'Tech Recruiter',
  sender: { name: 'Mihail', headline: 'Frontend engineer', summary: 'Builds web apps.' },
  notes: 'Keep it short.',
};

describe('buildDraftPrompt', () => {
  it('uses the Haiku model and embeds the context + base template', () => {
    const req = buildDraftPrompt(baseReq);
    expect(req.model).toBe('claude-haiku-4-5');
    const content = req.messages[0].content;
    expect(content).toContain('Sioux');
    expect(content).toContain('Frontend Engineer');
    expect(content).toContain('React, TypeScript');
    expect(content).toContain('Mara');
    expect(content).toContain('Hi {contact}, I am keen on roles at {company}.');
  });

  it('handles an empty template + missing stack gracefully', () => {
    const req = buildDraftPrompt({ kind: 'Other', template: '', stack: null });
    const content = req.messages[0].content;
    expect(content).toContain('(empty — write from the context)');
    expect(content).toContain('(none given)');
  });
});

describe('parseDraftResponse', () => {
  it('parses subject + body', () => {
    const out = parseDraftResponse(
      JSON.stringify({ subject: 'Open application', body: 'Hello there.' }),
    );
    expect(out).toEqual({ subject: 'Open application', body: 'Hello there.' });
  });

  it('coerces a blank/absent subject to null and trims', () => {
    expect(parseDraftResponse(JSON.stringify({ subject: '   ', body: '  hi  ' }))).toEqual({
      subject: null,
      body: 'hi',
    });
    expect(parseDraftResponse(JSON.stringify({ body: 'no subject' }))).toEqual({
      subject: null,
      body: 'no subject',
    });
  });

  it('tolerates a ```json fenced response', () => {
    const out = parseDraftResponse('```json\n{"subject":null,"body":"Fenced."}\n```');
    expect(out.body).toBe('Fenced.');
  });

  it('throws on malformed output (no body)', () => {
    expect(() => parseDraftResponse(JSON.stringify({ subject: 'x' }))).toThrow();
    expect(() => parseDraftResponse('garbage')).toThrow();
  });
});

describe('runDraft', () => {
  it('builds the prompt, calls the injected model, and parses the draft', async () => {
    const call = cannedCall(
      JSON.stringify({ subject: 'Hi', body: 'Personalized message.' }),
    );
    const out = await runDraft(call, baseReq);
    expect(out).toEqual({ subject: 'Hi', body: 'Personalized message.' });
    expect(call).toHaveBeenCalledTimes(1);
    const sent = (call as unknown as { mock: { calls: [ModelRequest][] } }).mock.calls[0][0];
    expect(sent.model).toBe('claude-haiku-4-5');
  });
});
