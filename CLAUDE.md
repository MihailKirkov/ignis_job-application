@AGENTS.md

# Job Command Center — project guide

A personal **job-discovery inbox + application tracker**. Next.js (App Router) on
Vercel, Supabase (Postgres + Auth + RLS). Built multi-user from day one (single
owner for now) — every row is scoped by `user_id` and enforced with RLS.

## Stack / conventions

- **Next.js 16** (App Router, TypeScript strict, Turbopack). Note the v16 changes:
  - The old `middleware.ts` convention is **`proxy.ts`** (named export `proxy`,
    nodejs runtime). Ours lives at the repo root and refreshes the Supabase session.
  - `cookies()` / `headers()` are **async**. `params` / `searchParams` are Promises.
- **Tailwind v4** — design tokens live in `src/app/globals.css` under `@theme`
  (no `tailwind.config.js`). Dark "command-center" palette; one amber accent
  (`--color-accent`) reserved for the primary action + "needs action" signal.
- **Supabase auth** via `@supabase/ssr` (never the deprecated `auth-helpers`).
  Three clients in `src/lib/supabase/`: `client.ts` (browser), `server.ts`
  (RSC/actions/route handlers), `proxy.ts` (`updateSession` for the root proxy).
  Magic-link by default (`/auth/callback` PKCE), Google OAuth optional,
  `/auth/confirm` for the token_hash flow.

## Layout

```
supabase/migrations/0001_init.sql   # full schema + RLS + updated_at triggers
supabase/migrations/0002_profiles.sql # profiles table + RLS + private 'cvs' storage bucket
supabase/migrations/0003_ai_scoring.sql # jobs fit_* columns + user_secrets (encrypted API key)
supabase/migrations/0004_activity_ingestion.sql # activity_events + ingestion_runs + ingestion_run_sources (+ RLS)
src/types/database.ts               # hand-written DB types (type aliases, not interfaces)
src/lib/supabase/                   # the three clients + auth helpers
src/lib/constants.ts                # enums (statuses, channels, modes, seniority, fit verdicts, source meta, activity vocab)
src/lib/utils.ts                    # dates, salary/status formatting, cn()
src/lib/profile.ts                  # pure profile/CV helpers (sanitize, parse, validate; unit-tested)
src/lib/ai/                         # AI fit-scoring + CV prefill (pure prompt/parse/hash + server-only client)
src/lib/activity/                   # unified activity log: summary.ts/feed.ts (pure), log.ts + record-run.ts (DB glue)
src/lib/actions/                    # 'use server' mutations (applications, profile, scoring, ai-key, …) — each logs one activity event
src/lib/sources/                    # NormalizedJob shape + per-source fetchers
src/lib/discovery/                  # normalize, dedupe, filters, ingest (executeIngestion + new/updated diff) — pure + unit-tested
src/app/(app)/                      # protected surfaces: needs-action, tracker, discovery, sources, activity, profile
src/app/auth/                       # callback / confirm / signout routes
src/app/api/                        # import + cron + export route handlers
tests/                              # vitest: normalize, dedupe, filters, profile, ai-*, activity-summary, ingest diff/summarizer (+ sources)
```

Activity + ingestion logs: every mutating Server Action emits exactly one
`activity_events` row via `logActivity` (the single emission point) — a
denormalized `summary` string is stored for trivial rendering, built by the pure
`buildActivitySummary(type, meta)`. The TELEMETRY strip (/needs-action) and the
full `/activity` feed read this table. Ingestion runs (manual-all, per-source,
cron) additionally write structured `ingestion_runs` + `ingestion_run_sources`
rows and emit one `ingestion.completed` event; counts distinguish **fetched vs
new vs updated** (`persistJobs` diffs existing keys before the upsert — never
label fetched as upserted). Secrets are REDACTED from stored run messages.

Profile + CV: `profiles` is one row per user (PK `user_id`). CV text lands in
`cv_text` two ways — pasted, or extracted from a PDF uploaded to the private
`cvs` Storage bucket (RLS per-user folder) using `unpdf` (serverless PDF.js, no
native binaries). Both paths go through Server Actions in `actions/profile.ts`.

AI (fit-scoring + CV prefill): uses the **Anthropic API** via the official
`@anthropic-ai/sdk`, **server-only**, on **Claude Haiku 4.5** (`claude-haiku-4-5`
— fast/cheap, no `effort` param). `src/lib/ai` splits into a **pure core**
(`prompt.ts`, `parse.ts` (zod), `hash.ts`, `score.ts` — unit-tested via an
injected `ModelCall` seam, like `fetchImpl`) and **server-only** glue (`client.ts`
SDK wrapper, `crypto.ts` aes-256-gcm, `resolve-key.ts`). Each user stores their
**own** Anthropic key (encrypted in `user_secrets` with `APP_ENCRYPTION_KEY`);
`ANTHROPIC_API_KEY` is the owner/demo fallback. No key → scoring is disabled with
a message, never a crash. `jobs.scored_profile_hash` makes scores re-stale when
the profile changes. **Keep `src/lib/ai` server-only modules out of the test
import graph** — `server-only` throws under vitest.

## Working rules (for future changes)

- **Verify before integrating a source.** Training data may be stale — web-search
  the current endpoint + terms before touching a source fetcher. Legitimate APIs,
  public ATS endpoints, and Cowork-on-demand import only. **No headless scrapers,
  no LinkedIn/Indeed scraping, no bypassing auth/anti-bot/CAPTCHAs.**
- **Keep the pure logic tested.** `normalize`, `dedupe`, and `filters` are pure and
  must stay covered. Run `npm test` after touching them.
- **Green gate before "done":** `npm run typecheck && npm run lint && npm run build && npm test`.
- Small, scoped commits. Update this file when structure changes.

## Commands

```
npm run dev         # local dev (needs .env.local — see .env.example)
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm run build       # next build (Turbopack)
npm test            # vitest run
```
