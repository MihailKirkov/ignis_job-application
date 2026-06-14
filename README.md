# Job Command Center

> Ingest jobs, score the fit with AI, and run your whole application pipeline in
> one dark, dense inbox.

A personal **job-discovery inbox + application tracker** — a "command-center"
tool (not a marketing page) for finding roles and running your pipeline. It pulls
roles from legitimate APIs and public ATS boards, ranks each one against your
profile and CV with Claude, and tracks every application from *to apply* to
*offer*. Built multi-user from day one: every row is scoped by `user_id` and
enforced with Postgres Row-Level Security.

**Stack:** Next.js 16 (App Router, TypeScript strict, Turbopack) · React 19 ·
Tailwind v4 · Supabase (Postgres + Auth + RLS) · `@supabase/ssr` ·
Anthropic Claude (Haiku 4.5) · Vercel (+ Cron) · Vitest. Free tiers only.

**▶ Live demo** — `/demo` is a no-auth, read-only tour with sample data (set
`NEXT_PUBLIC_SITE_URL` and link your Vercel domain here). The public landing page
lives at `/`.

## Screenshots & demo

The fastest way to see it is the **read-only `/demo`** (Discovery, Tracker, and
the Needs-action queue, populated and AI-scored — no sign-up). ASCII layouts of
every screen live in [`docs/wireframes.md`](docs/wireframes.md).

<details>
<summary>Embed PNGs</summary>

Capture the three views from `/demo` and drop them in `docs/screenshots/`, then:

```md
![Discovery — fit-scored inbox](docs/screenshots/discovery.png)
![Tracker — pipeline](docs/screenshots/tracker.png)
![Needs action — the hero queue](docs/screenshots/needs-action.png)
```

</details>

## Architecture

Next.js 16 App Router on Vercel, Supabase for Postgres + Auth + RLS. The root
`proxy.ts` (Next 16's renamed middleware) refreshes the `@supabase/ssr` session
and gates protected routes; the public landing, `/demo`, `/login`, and `/legal`
stay open. Each **source fetcher** (`src/lib/sources/`) reduces a provider's
payload to one `NormalizedJob` shape behind an injectable `fetchImpl`, so the
**pure discovery core** — normalize, dedupe, filter (`src/lib/discovery/`) — is
unit-tested with no network. Ingestion (manual button or `CRON_SECRET`-guarded
Vercel Cron) dedupes by `(source, external_id)` plus a fuzzy
company+title+location key. **AI fit-scoring** (`src/lib/ai/`) splits a pure,
tested core (prompt builder, zod parser, profile hash) from server-only glue
(the Claude SDK client, AES-256-GCM key encryption); each user brings their own
encrypted Anthropic key. Writes are Server Actions; everything renders in dark
command-center tokens defined in Tailwind v4's `@theme`.

---

## Features

- **Public landing + read-only demo** — a real landing page at `/`, and a
  no-auth `/demo` that renders the actual Discovery / Tracker / Needs-action
  components against bundled sample data (no DB, no real user data).
- **AI fit-scoring (Claude)** — score any job against your profile + CV for a
  0–100 fit, a verdict (strong / medium / weak), a one-line summary, and matched
  skills vs. gaps. Best-fit floats to the top; scores re-stale when your profile
  changes. Each user supplies their **own** Anthropic key (encrypted at rest).
- **Profile & CV** — one profile per user; CV text pasted or extracted from an
  uploaded PDF (`unpdf`, no native binaries) in a private per-user Storage
  bucket. Powers both filtering and AI scoring.
- **Discovery ingestion** from Adzuna (official), Arbeitnow, Remotive, RemoteOK,
  and public ATS company boards (Greenhouse, Lever, Ashby, Workable, Recruitee,
  SmartRecruiters). Everything normalized into one shape; raw payload kept as
  `jsonb`; deduped by `(source, external_id)` and a fuzzy
  company+title+location key.
- **Needs-action queue:** items due/overdue (and not Rejected/Closed), overdue
  flagged, one-click clear — plus a **first-run onboarding checklist** that
  guides a new account from empty to a scored inbox.
- Applications CRUD scoped per user: company, role, location, mode, channel,
  status pipeline, salary, link, contact, dates, next-action, notes, optional
  link back to a discovered job. Pipeline stat counts, status + search filters,
  JSON export.
- Per-job state (new / saved / dismissed / promoted). **Promote** creates a
  pre-filled application linked back via `job_id`.
- **Saveable filter presets:** keyword include/exclude, location scope
  (Eindhoven+radius / NL / remote), min salary, seniority guess, work mode,
  posted-within-N-days, source, language, min fit score.
- **Auth:** cross-device token_hash magic links by default (Google OAuth
  optional) via `@supabase/ssr`; session refresh + route protection in the root
  `proxy.ts`.
- **Scheduled ingestion** via Vercel Cron (idempotent, `CRON_SECRET`-guarded),
  and **manual/Cowork import** (`POST /api/import`, session-protected, RLS-scoped).

---

## Project layout

```
supabase/migrations/                0001 schema+RLS · 0002 profiles+CV bucket · 0003 AI scoring
src/types/database.ts               hand-written DB types
src/lib/supabase/                   browser / server / proxy / admin clients + auth
src/lib/sources/                    NormalizedJob shape + 10 source fetchers + registry
src/lib/discovery/                  normalize · dedupe · filters · ingest · import-schema (pure, tested)
src/lib/ai/                         AI fit-scoring + CV prefill: pure core + server-only glue
src/lib/demo/                       bundled fixtures for the read-only /demo
src/lib/actions/                    server actions: applications · jobs · sources · filters · profile · scoring
src/app/                            landing (/) · demo · login · legal
src/app/(app)/                      protected surfaces: needs-action · tracker · discovery · sources · profile
src/app/auth/                       callback · confirm · signout
src/app/api/                        import · cron/ingest · applications/export
tests/                              vitest suites (normalize · dedupe · filters · profile · ai · sources)
docs/                               setup · testing · database · code-structure · wireframes · cowork-import
```

## Documentation

- [`docs/setup.md`](docs/setup.md) — full setup: API keys, env, Supabase, Vercel + Cron.
- [`docs/testing.md`](docs/testing.md) — manual walkthrough + the `tests/` suite.
- [`docs/database.md`](docs/database.md) — ER diagram, tables, RLS, relationships.
- [`docs/code-structure.md`](docs/code-structure.md) — what lives where and why.
- [`docs/wireframes.md`](docs/wireframes.md) — planned design of each page (ASCII layouts).
- [`docs/cowork-import.md`](docs/cowork-import.md) — the Cowork on-demand import recipe.

---

## 1. Supabase setup

1. Create a project at [supabase.com](https://supabase.com) (free tier).
2. **Run the migration.** Either paste `supabase/migrations/0001_init.sql` into
   the dashboard SQL editor and run it, or with the CLI:
   ```bash
   supabase link --project-ref <ref>
   supabase db push     # applies supabase/migrations/*
   ```
   This creates `jobs`, `applications`, `sources`, `saved_filters`, enables RLS
   on all four, adds owner-only policies (`auth.uid() = user_id`), and the
   `updated_at` triggers.
3. **Auth → Providers:** keep **Email** enabled (magic link works out of the box).
   For Google sign-in, enable the **Google** provider and add your OAuth client.
4. **Auth → URL Configuration:** set the **Site URL** (e.g. your Vercel domain)
   and add redirect URLs:
   `http://localhost:3000/auth/callback` and
   `https://<your-app>.vercel.app/auth/callback`.
5. **API keys** (Project Settings → API): copy the **Project URL**, the
   **publishable/anon** key, and the **service-role** key (server-only).

### Recommended: cross-device magic links (token_hash)

The default the app is built around. Set **Auth → Email Templates → Magic Link**
to:

```
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=magiclink&next=/needs-action
```

The `/auth/confirm` route is already implemented — links then work across
browsers/devices. Leaving the template on Supabase's default `{{ .ConfirmationURL }}`
also works, via the PKCE `code` flow through `/auth/callback`, but those links
must be opened in the same browser. Google OAuth always uses the `code` flow.

---

## 2. Environment

Copy `.env.example` → `.env.local` and fill in:

| var                              | required | notes                                                  |
| -------------------------------- | -------- | ------------------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`       | yes      | project URL                                            |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`  | yes      | publishable/anon key (browser-safe; RLS protects data) |
| `SUPABASE_SERVICE_ROLE_KEY`      | cron     | **server-only**, bypasses RLS — only the cron needs it |
| `ADZUNA_APP_ID` / `ADZUNA_APP_KEY` | Adzuna | free from [developer.adzuna.com](https://developer.adzuna.com) |
| `CRON_SECRET`                    | cron     | long random string; guards `/api/cron/ingest`          |
| `NEXT_PUBLIC_SITE_URL`           | no       | base URL for redirects (defaults to localhost)         |

ATS public board tokens are **not** secrets — you add them per-source in the app
(Sources → Add source), stored in the `sources` table.

---

## 3. Local development

```bash
npm install
npm run dev          # http://localhost:3000
```

Quality gate (all must be green before a phase is "done"):

```bash
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm test             # vitest (139 tests: normalize, dedupe, filters, profile, ai, sources, ingest, import)
npm run build        # next build
```

First run: sign in with a magic link, go to **Sources**, add Adzuna (and any ATS
boards), then **Refresh inbox**.

---

## 4. Deploy to Vercel + Cron

1. Push the repo to GitHub and import it in Vercel.
2. **Project → Settings → Environment Variables:** add everything from
   `.env.local` **including** `SUPABASE_SERVICE_ROLE_KEY` and `CRON_SECRET`.
   Set `NEXT_PUBLIC_SITE_URL` to your production domain.
3. Add the production `/auth/callback` redirect URL in Supabase (step 1.4).
4. Deploy. `vercel.json` registers the cron:
   ```json
   { "crons": [{ "path": "/api/cron/ingest", "schedule": "0 6 * * *" }] }
   ```
   When `CRON_SECRET` is set, Vercel attaches `Authorization: Bearer $CRON_SECRET`
   to each invocation; the route rejects anything else. Trigger it manually with:
   ```bash
   curl -H "Authorization: Bearer $CRON_SECRET" https://<your-app>.vercel.app/api/cron/ingest
   ```
   Free-tier note: keep page/source counts modest so a run finishes within the
   function time limit (`maxDuration = 60`).

---

## 5. Adding a new source / company board

**A target company on an existing ATS** — no code, just config (Sources → Add):

| ATS        | config                                    | where to find the token            |
| ---------- | ----------------------------------------- | ---------------------------------- |
| Greenhouse | `{ "token": "stripe", "name": "Stripe" }` | `boards.greenhouse.io/<token>`     |
| Lever      | `{ "token": "netflix", "name": "Netflix" }` | `jobs.lever.co/<token>`          |
| Ashby      | `{ "token": "ramp", "name": "Ramp" }`     | `jobs.ashbyhq.com/<token>`         |
| Workable   | `{ "token": "acme", "name": "Acme" }`     | `apply.workable.com/<token>`       |
| Recruitee  | `{ "token": "acme", "name": "Acme" }`     | `<token>.recruitee.com`            |
| SmartRecruiters | `{ "token": "bosch", "name": "Bosch" }` | `jobs.smartrecruiters.com/<token>` |
| Adzuna     | `{ "query": "react", "where": "Eindhoven", "country": "nl", "salary_min": 50000, "max_days_old": 14, "full_time": true }` | use `"country": "gb"` for a remote/UK query |

**A brand-new provider** — add a fetcher:

1. Create `src/lib/sources/<name>.ts` exporting
   `async (config, ctx) => NormalizedJob[]` (take `ctx.fetchImpl` so it's
   testable). **Web-search the current endpoint + terms first** — training data
   may be stale.
2. Register it in `src/lib/sources/index.ts` and add the type to
   `SourceType` (`src/types/database.ts`) + `SOURCE_TYPES` / `SOURCE_META`
   (`src/lib/constants.ts`).
3. Add a test in `tests/sources/normalizers.test.ts` with a mocked fetch.
4. `npm test && npm run typecheck && npm run lint && npm run build`.

---

## Sources & boundaries

Legitimate APIs, public ATS endpoints, and **Cowork on-demand** only
(`docs/cowork-import.md`). **No headless scrapers** that bypass auth, anti-bot,
rate limits, or CAPTCHAs; **no LinkedIn/Indeed scraping.** Attribution-required
feeds (Remotive, RemoteOK) keep the original `url` + source label.

### Terms verified at build time (June 2026)

| source     | endpoint                                                       | terms                                                |
| ---------- | ------------------------------------------------------------- | ---------------------------------------------------- |
| Adzuna     | `api.adzuna.com/v1/api/jobs/{country}/search/{page}`          | Official API, free tier, rate-limited (429 backoff). |
| Arbeitnow  | `www.arbeitnow.com/api/job-board-api`                         | Free public API, no key.                             |
| Remotive   | `remotive.com/api/remote-jobs`                                | Attribution + link-back required; 24h delay; ≤2/min. |
| RemoteOK   | `remoteok.com/api`                                            | Must link back to RemoteOK as source; skip notice.   |
| Greenhouse | `boards-api.greenhouse.io/v1/boards/{token}/jobs?content=true`| Public job-board API.                                |
| Lever      | `api.lever.co/v0/postings/{token}?mode=json`                  | Public postings API.                                 |
| Ashby      | `api.ashbyhq.com/posting-api/job-board/{token}`               | Public posting API.                                  |
| Recruitee  | `{token}.recruitee.com/api/offers/`                          | Public Careers Site API, no key.                     |
| SmartRecruiters | `api.smartrecruiters.com/v1/companies/{token}/postings` | Public Posting API, no key.                          |

### Could not fully verify

- **Workable** — the public surface is fragmented; this build targets the widget
  endpoint `apply.workable.com/api/v1/widget/accounts/{token}`. It works for many
  accounts but field names vary and it isn't a stable documented contract. Treat
  it as best-effort and adjust `src/lib/sources/workable.ts` if a given account
  returns a different shape.

### Evaluated but not integrated

- **Homerun** (NL ATS) was requested, but it exposes **no public, no-auth
  job-board endpoint**: its public API (`api.homerun.co/v2`) requires a Bearer API
  key (a real secret), and the only unauthenticated option is an undocumented XML
  feed. Both break this project's source rules (public endpoints only; ATS tokens
  are public board slugs, not secrets), so **SmartRecruiters** — verified public,
  no-auth, and widely used by NL/EU employers — was added in its place.

---

## Notes

- Next 16 specifics: the old `middleware.ts` is now **`proxy.ts`**; `cookies()`
  and `params`/`searchParams` are async. See `CLAUDE.md`.
- DB types are hand-written (`src/types/database.ts`); regenerate with
  `supabase gen types typescript` if you prefer.
