import { describe, it, expect, vi } from 'vitest';
import { runPrefill, runScore } from '@/lib/ai/score';
import type { ModelCall, ModelRequest } from '@/lib/ai/types';

// A canned model-call impl — the same injection seam source fetchers use for
// fetchImpl. No network is touched.
function cannedCall(output: string): ModelCall {
  return vi.fn(async () => output);
}

describe('runScore', () => {
  it('builds the prompt, calls the injected model, and parses the result', async () => {
    const call = cannedCall(
      JSON.stringify({
        score: 76,
        verdict: 'medium',
        matched_skills: ['React'],
        gaps: ['Go'],
        summary: 'Partial overlap.',
      }),
    );
    const result = await runScore(call, { skills: ['React'] }, { title: 'React Engineer' });

    expect(result).toEqual({
      score: 76,
      verdict: 'medium',
      matched_skills: ['React'],
      gaps: ['Go'],
      summary: 'Partial overlap.',
    });
    expect(call).toHaveBeenCalledTimes(1);
    const req = (call as unknown as { mock: { calls: [ModelRequest][] } }).mock.calls[0][0];
    expect(req.model).toBe('claude-haiku-4-5');
  });

  it('propagates a parse error on malformed model output', async () => {
    await expect(
      runScore(cannedCall('garbage'), {}, { title: 'Engineer' }),
    ).rejects.toThrow();
  });
});

describe('runPrefill', () => {
  it('returns structured prefill fields from canned output', async () => {
    const call = cannedCall(
      JSON.stringify({
        skills: ['React', 'TypeScript'],
        seniority: 'senior',
        summary: 'A senior frontend engineer.',
        target_roles: ['Frontend Engineer'],
      }),
    );
    const out = await runPrefill(call, 'CV text here');
    expect(out.skills).toEqual(['React', 'TypeScript']);
    expect(out.seniority).toBe('senior');
    expect(out.target_roles).toEqual(['Frontend Engineer']);
  });
});
