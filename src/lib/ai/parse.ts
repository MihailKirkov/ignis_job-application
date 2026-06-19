// Pure response parsers — zod-validate + coerce the model's JSON, throw on
// malformed output. No SDK, no network.

import { z } from 'zod';
import { SENIORITY_LEVELS } from '@/lib/constants';
import type { Seniority } from '@/types/database';
import type { CvPrefill, ScoreResult } from './types';

// Models occasionally wrap JSON in prose or ```json fences despite instructions.
// Pull out the first balanced-looking object before parsing.
function extractJsonObject(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) {
    throw new Error('No JSON object found in model response.');
  }
  return body.slice(start, end + 1);
}

function parseJson(text: string): unknown {
  let raw: string;
  try {
    raw = extractJsonObject(text);
  } catch {
    throw new Error('Model response did not contain JSON.');
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error('Model response was not valid JSON.');
  }
}

// Pull out the first balanced-looking ARRAY (for batch responses). Returns null
// rather than throwing — batch parsing tolerates a fully malformed response.
function extractJsonArray(text: string): unknown[] | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf('[');
  const end = body.lastIndexOf(']');
  if (start === -1 || end === -1 || end < start) return null;
  try {
    const parsed = JSON.parse(body.slice(start, end + 1));
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function cleanList(values: string[], maxItems = 12, maxLen = 60): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of values) {
    const item = v.trim().slice(0, maxLen).trim();
    if (!item) continue;
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
    if (out.length >= maxItems) break;
  }
  return out;
}

const ScoreSchema = z.object({
  score: z.number(),
  verdict: z.enum(['strong', 'medium', 'weak']),
  matched_skills: z.array(z.string()),
  gaps: z.array(z.string()),
  summary: z.string(),
});

export function parseScoreResponse(text: string): ScoreResult {
  const result = ScoreSchema.safeParse(parseJson(text));
  if (!result.success) {
    throw new Error(`Malformed score response: ${result.error.issues[0]?.message ?? 'invalid shape'}`);
  }
  const data = result.data;
  return {
    score: Math.max(0, Math.min(100, Math.round(data.score))),
    verdict: data.verdict,
    matched_skills: cleanList(data.matched_skills),
    gaps: cleanList(data.gaps),
    summary: data.summary.trim().slice(0, 600),
  };
}

const BatchEntrySchema = ScoreSchema.extend({ job_id: z.string() });

// Parse a batch response into a Map keyed by job_id. Robust by design: a fully
// malformed response yields an empty map (caller marks every job failed), invalid
// entries are skipped, entries for ids that weren't requested are ignored, and a
// duplicate id keeps the first. Never throws — one bad batch must not blow up.
export function parseBatchScoreResponse(
  text: string,
  requestedIds: string[],
): Map<string, ScoreResult> {
  const out = new Map<string, ScoreResult>();
  const wanted = new Set(requestedIds);
  const arr = extractJsonArray(text);
  if (!arr) return out;
  for (const item of arr) {
    const parsed = BatchEntrySchema.safeParse(item);
    if (!parsed.success) continue;
    const { job_id, ...rest } = parsed.data;
    if (!wanted.has(job_id) || out.has(job_id)) continue;
    out.set(job_id, {
      score: Math.max(0, Math.min(100, Math.round(rest.score))),
      verdict: rest.verdict,
      matched_skills: cleanList(rest.matched_skills),
      gaps: cleanList(rest.gaps),
      summary: rest.summary.trim().slice(0, 600),
    });
  }
  return out;
}

function coerceSeniority(value: string | null | undefined): Seniority | null {
  if (typeof value !== 'string') return null;
  const v = value.trim().toLowerCase();
  return (SENIORITY_LEVELS as string[]).includes(v) ? (v as Seniority) : null;
}

const PrefillSchema = z.object({
  skills: z.array(z.string()),
  seniority: z.union([z.string(), z.null()]).optional(),
  summary: z.string(),
  target_roles: z.array(z.string()),
});

export function parsePrefillResponse(text: string): CvPrefill {
  const result = PrefillSchema.safeParse(parseJson(text));
  if (!result.success) {
    throw new Error(`Malformed prefill response: ${result.error.issues[0]?.message ?? 'invalid shape'}`);
  }
  const data = result.data;
  return {
    skills: cleanList(data.skills, 30, 50),
    seniority: coerceSeniority(data.seniority ?? null),
    summary: data.summary.trim().slice(0, 2_000),
    target_roles: cleanList(data.target_roles, 12, 60),
  };
}
