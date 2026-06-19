import { describe, it, expect, vi } from 'vitest';
import { AI_MODEL, BATCH_SCORE_CAP, buildBatchScorePrompt } from '@/lib/ai/prompt';
import { parseBatchScoreResponse } from '@/lib/ai/parse';
import { runBatchScore } from '@/lib/ai/score';
import { chunkLimit, settleChunk } from '@/lib/ai/progress';
import type { BatchScoringJob, ModelCall, ModelRequest, ScoringProfile } from '@/lib/ai/types';

const profile: ScoringProfile = {
  headline: 'Frontend Engineer',
  skills: ['React', 'TypeScript'],
  cv_text: 'x'.repeat(20000),
};

function job(id: string, title: string): BatchScoringJob {
  return { id, title, company: 'ASML', location: 'Eindhoven' };
}

const jobs = [job('a', 'React Engineer'), job('b', 'Go Engineer'), job('c', 'Data Engineer')];

function entry(id: string, score = 70, verdict = 'medium') {
  return {
    job_id: id,
    score,
    verdict,
    matched_skills: ['React'],
    gaps: ['Go'],
    summary: 'Some overlap.',
  };
}

describe('buildBatchScorePrompt', () => {
  it('targets Haiku, scales max_tokens with job count, and caches the system prefix', () => {
    const req = buildBatchScorePrompt(profile, jobs);
    expect(req.model).toBe(AI_MODEL);
    expect(req.cacheSystem).toBe(true);
    expect(req.max_tokens).toBeGreaterThan(buildBatchScorePrompt(profile, jobs.slice(0, 1)).max_tokens);
  });

  it('puts the profile in the cached system block and the jobs (with ids) in the message', () => {
    const req = buildBatchScorePrompt(profile, jobs);
    expect(req.system).toMatch(/STRICT JSON/i);
    expect(req.system).toContain('"job_id"');
    expect(req.system).toContain('Frontend Engineer'); // profile is in the cached prefix
    const content = req.messages[0].content;
    expect(content).toContain('job_id=a');
    expect(content).toContain('job_id=b');
    expect(content).toContain('React Engineer');
  });

  it('caps the batch at BATCH_SCORE_CAP jobs', () => {
    const many = Array.from({ length: BATCH_SCORE_CAP + 5 }, (_, i) => job(`j${i}`, `Role ${i}`));
    const content = buildBatchScorePrompt(profile, many).messages[0].content;
    expect(content).toContain(`job_id=j${BATCH_SCORE_CAP - 1}`);
    expect(content).not.toContain(`job_id=j${BATCH_SCORE_CAP}`);
  });
});

describe('parseBatchScoreResponse', () => {
  const ids = ['a', 'b', 'c'];

  it('maps a full array back by job_id', () => {
    const text = JSON.stringify([entry('a', 90, 'strong'), entry('b', 40, 'weak'), entry('c')]);
    const map = parseBatchScoreResponse(text, ids);
    expect(map.size).toBe(3);
    expect(map.get('a')?.score).toBe(90);
    expect(map.get('a')?.verdict).toBe('strong');
    expect(map.get('b')?.verdict).toBe('weak');
  });

  it('tolerates partial output — missing entries are simply absent', () => {
    const text = JSON.stringify([entry('a'), entry('c')]);
    const map = parseBatchScoreResponse(text, ids);
    expect(map.size).toBe(2);
    expect(map.has('a')).toBe(true);
    expect(map.has('b')).toBe(false);
    expect(map.has('c')).toBe(true);
  });

  it('ignores entries for ids that were not requested', () => {
    const text = JSON.stringify([entry('a'), entry('zzz')]);
    const map = parseBatchScoreResponse(text, ids);
    expect(map.size).toBe(1);
    expect(map.has('zzz')).toBe(false);
  });

  it('skips a malformed entry but keeps the valid ones', () => {
    const text = JSON.stringify([entry('a'), { job_id: 'b', score: 'oops' }, entry('c')]);
    const map = parseBatchScoreResponse(text, ids);
    expect(map.size).toBe(2);
    expect(map.has('b')).toBe(false);
  });

  it('keeps the first of a duplicated id', () => {
    const text = JSON.stringify([entry('a', 90, 'strong'), entry('a', 10, 'weak')]);
    const map = parseBatchScoreResponse(text, ids);
    expect(map.get('a')?.score).toBe(90);
  });

  it('parses an array wrapped in a ```json fence', () => {
    const text = 'Here you go:\n```json\n' + JSON.stringify([entry('a')]) + '\n```';
    expect(parseBatchScoreResponse(text, ids).has('a')).toBe(true);
  });

  it('returns an empty map (no throw) on a fully malformed response', () => {
    expect(parseBatchScoreResponse('not json at all', ids).size).toBe(0);
    expect(parseBatchScoreResponse('{ "score": 5 }', ids).size).toBe(0);
  });

  it('clamps scores into 0..100', () => {
    const text = JSON.stringify([entry('a', 250)]);
    expect(parseBatchScoreResponse(text, ['a']).get('a')?.score).toBe(100);
  });
});

describe('runBatchScore', () => {
  it('builds the batch prompt, calls the model, and maps results', async () => {
    const call: ModelCall = vi.fn(async () => JSON.stringify([entry('a'), entry('b'), entry('c')]));
    const map = await runBatchScore(call, profile, jobs);
    expect(map.size).toBe(3);
    const req = (call as unknown as { mock: { calls: [ModelRequest][] } }).mock.calls[0][0];
    expect(req.cacheSystem).toBe(true);
  });

  it('short-circuits an empty chunk without calling the model', async () => {
    const call: ModelCall = vi.fn(async () => '[]');
    const map = await runBatchScore(call, profile, []);
    expect(map.size).toBe(0);
    expect(call).not.toHaveBeenCalled();
  });
});

describe('chunk progress accounting', () => {
  it('chunkLimit bounds the next fetch by remaining budget and chunk size', () => {
    expect(chunkLimit(100, 0, 0, 8)).toBe(8);
    expect(chunkLimit(100, 94, 2, 8)).toBe(4); // only 4 of the 100 left
    expect(chunkLimit(100, 60, 40, 8)).toBe(0); // budget exhausted
    expect(chunkLimit(5, 0, 0, 8)).toBe(5); // fewer than a full chunk
  });

  it('settleChunk folds successes + misses and detects budget exhaustion', () => {
    const t = settleChunk({
      total: 20,
      completedBefore: 0,
      failedBefore: 0,
      scoredCount: 7,
      fetchedCount: 8,
      limit: 8,
    });
    expect(t).toEqual({ completed: 7, failed: 1, remaining: 12, done: false });
  });

  it('settleChunk marks done when a short read means no jobs remain', () => {
    const t = settleChunk({
      total: 100,
      completedBefore: 10,
      failedBefore: 0,
      scoredCount: 3,
      fetchedCount: 3,
      limit: 8,
    });
    expect(t.done).toBe(true);
    expect(t.completed).toBe(13);
  });

  it('settleChunk marks done when the budget is reached exactly', () => {
    const t = settleChunk({
      total: 16,
      completedBefore: 8,
      failedBefore: 0,
      scoredCount: 8,
      fetchedCount: 8,
      limit: 8,
    });
    expect(t.done).toBe(true);
    expect(t.remaining).toBe(0);
  });
});
