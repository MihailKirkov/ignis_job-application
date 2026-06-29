# AI fit-scoring

How a discovered job gets a 0–100 fit score against your profile + CV, end to end.
The same machinery also powers **CV → profile prefill** and **message drafting**
(personalizing an outreach template — `buildDraftPrompt`/`parseDraftResponse`/
`runDraft`, driven by `draftMessage`; see [code-structure](./code-structure.md) and
the templates note in [logging.md](./logging.md)). Everything here uses the
**Anthropic API** via the official `@anthropic-ai/sdk`, **server-only**, on **Claude
Haiku 4.5** (`claude-haiku-4-5` — fast and cheap; we score many jobs).

Related: [`database.md`](./database.md) (the `jobs.fit_*` columns, `scoring_runs`,
`user_secrets`), [`code-structure.md`](./code-structure.md#srclibai--ai-fit-scoring--cv-prefill)
(the file layout), [`setup.md`](./setup.md) (`ANTHROPIC_API_KEY` /
`APP_ENCRYPTION_KEY`).

---

## The split: a pure core + server-only glue

Like the source layer injects `fetchImpl`, the AI layer injects the **model call**
(`ModelCall`) so the deterministic logic is unit-tested with canned output and no
network. The dividing line matters: **`server-only` modules must stay out of the
test import graph** (`server-only` throws under Vitest).

| File | Side | Responsibility |
| ---- | ---- | -------------- |
| `src/lib/ai/types.ts` | pure | `ModelRequest`/`ModelCall` (the injectable seam), `ScoringProfile`/`ScoringJob`/`BatchScoringJob`, `ScoreResult`, `JobFitColumns`, `ScoredJobUpdate`, `ScoringChunkResult`, `CvPrefill`. |
| `src/lib/ai/prompt.ts` | pure | `buildScorePrompt`, `buildBatchScorePrompt`, `buildPrefillPrompt`; the `AI_MODEL` and `BATCH_SCORE_CAP` constants. |
| `src/lib/ai/parse.ts` | pure | `parseScoreResponse`, `parseBatchScoreResponse`, `parsePrefillResponse` — zod-validate + coerce/clamp. |
| `src/lib/ai/hash.ts` | pure | `scoredProfileHash` — stable, order/case-insensitive hash of the scoring-relevant profile fields. |
| `src/lib/ai/progress.ts` | pure | `chunkLimit` / `settleChunk` — chunk-progress accounting (how many to fetch next, when a run is done). |
| `src/lib/ai/score.ts` | pure | `runScore` / `runBatchScore` / `runPrefill` orchestrators (build → injected `call` → parse) + DB-row adapters (`profileToScoring`, `jobToScoring`, `jobToBatchScoring`, `fitColumns`). |
| `src/lib/ai/client.ts` | **server-only** | `anthropicCall(key)` — wraps the SDK into a `ModelCall` (and marks the cacheable system block). |
| `src/lib/ai/crypto.ts` | **server-only** | `encryptSecret`/`decryptSecret` — aes-256-gcm, key derived from `APP_ENCRYPTION_KEY`. |
| `src/lib/ai/resolve-key.ts` | **server-only** | resolve the user's key (decrypt) → env fallback → null; `hasOwnAnthropicKey` / `hasAnthropicKey`. |
| `src/lib/ai/scoring-run.ts` | **server-only** | the DB+SDK plumbing for async runs: `createScoringRun`, `processChunk`, `runScoringToCompletion`. |

The pure modules are tested in `tests/ai-prompt.test.ts`, `ai-parse.test.ts`,
`ai-hash.test.ts`, `ai-score.test.ts`, `ai-batch.test.ts` via a fake `ModelCall`.

---

## The model call seam

`ModelRequest` is a plain payload (`model`, `max_tokens`, `system`, `messages`, and
an optional `cacheSystem` flag). `ModelCall = (req) => Promise<string>` returns the
assistant text. `anthropicCall(apiKey)` (in `client.ts`) is the only thing that
touches the SDK:

```ts
system: req.cacheSystem
  ? [{ type: 'text', text: req.system, cache_control: { type: 'ephemeral' } }]
  : req.system
```

That `cache_control: ephemeral` is **prompt caching** — see below.

---

## The prompts (`prompt.ts`)

All three builders are deterministic (no timestamps/ids), so output is testable and
prompt caching stays effective. `AI_MODEL = 'claude-haiku-4-5'` (Haiku does **not**
support the `effort` param, so we never send it). The CV is clamped to 6 000 chars
in scoring (12 000 in prefill) for cost/latency.

- **`buildScorePrompt(profile, job)`** — single job. System prompt defines the 0–100
  bands (80–100 strong / 50–79 medium / 0–49 weak) and demands **strict JSON**:
  `{ score, verdict, matched_skills, gaps, summary }`.
- **`buildBatchScorePrompt(profile, jobs)`** — up to `BATCH_SCORE_CAP` (**8**) jobs
  in **one** request. The **stable** prefix (instructions + candidate profile/CV)
  goes in the `system` block with `cacheSystem: true`; the **volatile** job list
  goes in the user message after it. Each job is rendered with `job_id=<id>` and the
  model returns a JSON **array**, one object per job echoing its `job_id`.
  `max_tokens` scales with the chunk size (`512 + n*400`, capped 8192).
- **`buildPrefillPrompt(cvText)`** — extracts `{ skills, seniority, summary,
  target_roles }` from the CV for the profile form.

### Prompt caching

The batch prompt marks the system prefix ephemeral so it's **reused across the
chunks of one run** instead of re-billing the profile/CV context every chunk. Haiku's
minimum cacheable prefix is ~4 096 tokens — below that it's a **no-op** (still
correct, just not cached). This is why the static profile lives in `system` and only
the small job list varies per call.

---

## Parsing (`parse.ts`)

Models sometimes wrap JSON in prose or ```` ```json ```` fences, so the parsers
extract the first balanced object/array before `JSON.parse`, then **zod**-validate
and coerce:

- `parseScoreResponse` — throws on a malformed single response; clamps `score` to
  0–100 (rounded), de-dupes/trims `matched_skills`/`gaps` (≤12 items, ≤60 chars),
  caps `summary` at 600 chars.
- `parseBatchScoreResponse(text, requestedIds)` — **never throws**. Returns a `Map`
  keyed by `job_id`. A fully malformed response → empty map (caller marks every job
  failed); invalid entries are skipped; entries for ids that weren't requested are
  ignored; a duplicate id keeps the first. This is what stops one bad chunk from
  sinking a whole run.
- `parsePrefillResponse` — validates the prefill shape; coerces `seniority` to the
  known ladder or null.

---

## The fit columns

A `ScoreResult` becomes the `jobs` fit columns via `fitColumns(result, profileHash)`
(in `score.ts`), shared by the single-job action, the batch chunk processor, and the
cron so they all write the same shape:

| Column | From |
| ------ | ---- |
| `fit_score` (0–100) | `result.score` |
| `fit_verdict` (`strong`/`medium`/`weak`) | `result.verdict` |
| `fit_summary` | `result.summary` |
| `fit_breakdown` (`{ matched_skills, gaps }`) | the two arrays |
| `scored_at` | now |
| `scored_profile_hash` | the profile hash at scoring time |

### Staleness via `scored_profile_hash` (`hash.ts`)

`scoredProfileHash(profile)` is a stable sha-256 (first 32 hex chars) of the
**scoring-relevant** profile fields — normalized (whitespace-collapsed, lowercased)
and list fields **sorted + de-duped**, so reordering a skill list doesn't change the
hash. When you edit your profile the hash changes, which makes every existing score
**stale**: a job "needs scoring for the current profile" iff its
`scored_profile_hash` is null **or** ≠ the current hash. Runs only ever touch the
"needy" set, so they always terminate.

---

## The per-user encrypted key

Each user stores **their own** Anthropic key, encrypted at rest. `crypto.ts` does
aes-256-gcm with a key derived (`sha-256`) from `APP_ENCRYPTION_KEY`; ciphertext is
`"iv.tag.data"` (base64). It lands in `user_secrets.anthropic_api_key` (1:1 table,
RLS-owned) via `setApiKey` in `actions/ai-key.ts` — the plaintext is never returned,
logged, or sent to the client.

`resolveAnthropicKey(supabase, userId)` (server-only) resolves at call time:

1. the user's own key (decrypted), else
2. the owner/demo `ANTHROPIC_API_KEY` env fallback, else
3. **null** → the caller disables scoring with a clear message (`NO_KEY_MESSAGE`),
   **never** a crash.

If the stored ciphertext can't be decrypted (e.g. `APP_ENCRYPTION_KEY` was rotated)
it silently falls through to the env key. `hasAnthropicKey` powers the UI's
"scoring available?" check without decrypting anything.

---

## Single-job scoring (`actions/scoring.ts`)

Two server actions back the per-card buttons:

- **`scoreJob(jobId, { force })`** — score one job, revalidate `/discovery`. Skips if
  already scored for the current hash (unless `force`).
- **`scoreOneJob(jobId, { force })`** — same, but **returns** the fit columns so the
  Discovery client can fill that card's badge in place without a refetch. This is how
  scoring streams **per job** in the inbox.

Both resolve the key, load the profile + job, build → call → parse, and write
`fitColumns`. Errors are mapped to friendly messages by `scoringErrorMessage`
(401 → invalid key, 429 → rate-limited).

`prefillFromCv()` runs `buildPrefillPrompt` over the saved `cv_text` and returns the
extracted fields for the profile form to pre-fill — it does **not** write the profile
(the user reviews + saves).

---

## Async, resumable batch runs

The inbox can hold hundreds of jobs, so a manual "score everything" must not block a
request. Runs are DB-tracked in `scoring_runs` (status `queued`/`running`/`done`/
`error`/`cancelled`, plus `total`/`completed`/`failed`) and resumable.

### Lifecycle

```
startScoring()                      → createScoringRun(): count needy New jobs (cap
  (actions/scoring.ts)                100), insert a 'running' run, return runId now
        │
        ▼  client (DiscoveryList) drives the loop
POST /api/scoring/chunk { runId }   → processChunk(): ONE batched + cached call
        │  repeat until remaining=0    scoring ≤8 jobs, write fit cols, bump counters
        ▼
done  (each response's `updated[]` fills that batch of badges; "scored X / N" shown)
```

- **`createScoringRun(supabase, userId, trigger, cap)`** (`scoring-run.ts`) resolves
  the profile + key, counts `state='new'` jobs that are needy-for-hash (capped at
  `cap`), and inserts a `running` run. `total: 0` ⇒ nothing to score (no run).
- **`processChunk(supabase, userId, runId)`** processes one chunk:
  `chunkLimit` (≤ `BATCH_SCORE_CAP`) → fetch that many needy New jobs ordered by `id`
  → one `runBatchScore` call → for each job, write `fitColumns` (or, if the model
  dropped it, stamp just the hash + `scored_at` so it leaves the needy set and the
  run can't loop on it) → `settleChunk` folds the tally and flips the run to `done`
  when the budget is exhausted or a short read means nothing remains. Returns a
  `ScoringChunkResult` (`completed`, `failed`, `remaining`, `updated[]`, `done`).
- **`cancelScoring(runId)`** sets `status='cancelled'`; the next chunk sees a
  non-`running` status and bails. Already-scored jobs persist.
- On load, the Discovery client offers **Resume** for an unfinished run.

Caps live in `src/lib/constants.ts`: `SCORING_MANUAL_CAP = 100`,
`SCORING_CRON_CAP = 60`, `BATCH_SCORE_CAP = 8` (in `prompt.ts`). The chunk route
(`/api/scoring/chunk`) is RLS-scoped (it uses the session client) with
`maxDuration = 60`.

---

## Cron auto-scoring

`runScoringToCompletion(supabase, userId, trigger, cap, deadlineMs)` drives a run to
completion **server-side** — the path the daily cron uses. After
[ingestion](./logging.md) completes, `/api/cron/ingest` loops each user and scores
their newly-ingested / still-unscored jobs in bounded chunks, **wall-clock-bounded**
(`SCORING_DEADLINE_MS = 50 000`, under the function's `maxDuration = 60`). Leftover
needy jobs roll into the next day's run. With the admin client there's no session, so
it can't read a per-user key — auto-scoring only happens for users whose key resolves
(their own, or the env fallback). No key → silently skipped.

The net effect: by the time you open the inbox each morning, it's mostly pre-scored,
and the manual path rarely has a backlog.

---

## Inbox ranking

`loadJobsPage` (`actions/discovery.ts`) orders the **New** tab **best-fit-first**:
`fit_score desc nulls last`, then `posted_at desc`, then `ingested_at desc` (the
other state tabs are simply most-recent). This is backed by the
`jobs (user_id, fit_score desc nulls last)` index. Unscored jobs sort last, so a
fresh inbox still reads newest-first until scores land. The verdict drives the badge
colour (`FIT_VERDICT_COLOR` in `constants.ts`: strong→green, medium→amber,
weak→red).
