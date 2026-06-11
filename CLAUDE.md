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
src/types/database.ts               # hand-written DB types (type aliases, not interfaces)
src/lib/supabase/                   # the three clients + auth helpers
src/lib/constants.ts                # enums (statuses, channels, modes, source meta)
src/lib/utils.ts                    # dates, salary/status formatting, cn()
src/lib/actions/                    # 'use server' mutations (applications, …)
src/lib/sources/                    # NormalizedJob shape + per-source fetchers
src/lib/discovery/                  # normalize, dedupe, filters (pure + unit-tested)
src/app/(app)/                      # protected surfaces: needs-action, tracker, discovery, sources
src/app/auth/                       # callback / confirm / signout routes
src/app/api/                        # import + cron + export route handlers
tests/                              # vitest: normalize, dedupe, filters (+ sources)
```

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
