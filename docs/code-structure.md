# Code structure

What lives where, and why. Read this before adding a feature so new code lands in
the layer it belongs to.

**Related:** [`database.md`](./database.md) · [`ai-scoring.md`](./ai-scoring.md) ·
[`logging.md`](./logging.md) · [`design-system.md`](./design-system.md) ·
[`setup.md`](./setup.md) · [`testing.md`](./testing.md). Index:
[`README.md`](./README.md).

---

## The one-paragraph mental model

The app has two surfaces — a **discovery inbox** and an **applications tracker** —
on top of Supabase (Postgres + Auth + RLS). The deterministic brain (normalizing
sources, deduping, filtering, validating imports) is a set of **pure functions** in
`src/lib/discovery` and `src/lib/sources`, kept free of React and the database so it
can be unit-tested without a network or a DB. Everything stateful goes through
Supabase via **three clients** chosen by context. Reads happen in **Server
Components**; writes happen in **Server Actions** (UI) or **Route Handlers** (APIs /
cron). A root **`proxy.ts`** (Next 16's renamed middleware) refreshes the session
and gates protected routes.

---

## Top-level layout

```
proxy.ts                  Next 16 proxy (was middleware): session refresh + route guard
vercel.json               Cron schedule (daily ingest)
vitest.config.ts          test runner config (node env, @/* alias)
next.config.ts            Next config
supabase/migrations/      SQL schema + RLS + triggers (the source of truth)
docs/                     these guides
tests/                    Vitest unit tests for the pure logic
src/
  app/                    routes (App Router): pages, layouts, route handlers
  components/             React UI (server-safe primitives + client widgets)
  lib/                    non-UI logic: supabase clients, actions, pure domain logic
  types/                  hand-written DB types
```

---

## `src/lib` — the logic layer (no JSX)

### `src/lib/supabase/` — clients & auth

Four clients (+ one auth helper), picked by **where you are**:

| File         | Client                       | Use from                                   |
| ------------ | ---------------------------- | ------------------------------------------ |
| `client.ts`  | `createBrowserClient`        | Client Components (browser).               |
| `server.ts`  | `createServerClient` (cookies) | Server Components, Server Actions, Route Handlers. RLS-scoped to the signed-in user. |
| `proxy.ts`   | `createServerClient` (request/response cookies) | the root `proxy.ts` only — refreshes the session each request. |
| `admin.ts`   | service-role client          | **server-only**, cron route only — bypasses RLS. Never import into client code. |
| `auth.ts`    | `getUser()` / `requireUser()`| helpers over `server.ts` for protected pages/actions. |

Why four: cookies behave differently in a Server Component vs the proxy vs a static
browser client, and the cron has no session at all. Using the wrong one is the most
common foot-gun — match the file to the context above.

### `src/lib/sources/` — fetch + normalize each provider

One file per provider (**ten**), all reducing to the same `NormalizedJob` shape:

```
types.ts        NormalizedJob shape, JobSource/FetchContext interfaces
adzuna.ts arbeitnow.ts remotive.ts remoteok.ts             feed APIs
greenhouse.ts lever.ts ashby.ts workable.ts                public ATS company boards
recruitee.ts smartrecruiters.ts                            public ATS company boards
index.ts        registry: SourceType -> fetcher (SOURCE_FETCHERS), getFetcher(),
                + serverFetchContext() (reads the Adzuna env keys)
```

**Design rule:** every fetcher takes `ctx.fetchImpl` (defaults to global `fetch`).
That single seam is what makes the source layer unit-testable with canned JSON and
no network. Fetchers throw on hard failure (missing token, non-200) — the runner
isolates that per source.

To add a provider: new file here → register in `index.ts` → extend `SourceType`
(`src/types/database.ts`) and `SOURCE_TYPES`/`SOURCE_META` (`src/lib/constants.ts`)
→ add a test. (Full steps in the README's "Adding a new source".)

### `src/lib/discovery/` — the pure brain

The deterministic core. No React, no Supabase, all unit-tested.

| File               | Responsibility                                                              |
| ------------------ | --------------------------------------------------------------------------- |
| `normalize.ts`     | string/slug helpers, `fuzzyKey`, seniority/mode guess, salary + date parse, HTML strip. |
| `dedupe.ts`        | exact `(source, external_id)` + fuzzy (`fuzzy_key`) dedupe, source trust ranking. |
| `filters.ts`       | `FilterCriteria` type + `matchesFilter` / `filterJobs` predicate.           |
| `filter-params.ts` | `FilterCriteria` ⇄ URL params (so filters are shareable + presets are param sets) + `jobRowToNormalized` adapter. |
| `import-schema.ts` | validate/normalize the `POST /api/import` payload (idempotent id derivation). |
| `ingest.ts`        | the orchestrator: `runFetchers` (per-source isolation + dedupe), `toJobRows`, the new-vs-updated `diffJobs`, `persistJobs`/`executeIngestion` (idempotent upsert), and the pure `summarizeRun` roll-up. |

`ingest.ts` is the one file here that *touches* a Supabase client — but only via a
passed-in argument (`persistJobs(supabase, …)` / `executeIngestion(supabase, …)`), so
it stays testable and the caller (action or cron) owns the client. The new-vs-updated
diff (`fetchExistingKeys` → `diffJobs`) runs **before** the upsert so a re-ingested
job is never miscounted as new — feeding the [ingestion log](./logging.md).

### `src/lib/actions/` — Server Actions (the write path for the UI)

`'use server'` mutations called directly from Client Components. One file per
aggregate:

- `applications.ts` — CRUD, `clearNextAction`, `setStatus` (the drag-and-drop board
  calls this). Form actions return `{ ok, error }` for `useActionState`; imperative
  ones (delete/clear/setStatus) are called via `useTransition`.
- `profile.ts` — `saveProfile` (upsert the 1:1 profile + pasted CV text),
  `uploadCv` (store the PDF in the private `cvs` bucket + extract its text with
  `unpdf`), `removeCvFile`. Pure parsing/validation lives in `src/lib/profile.ts`.
- `scoring.ts` — `scoreJob` / `scoreOneJob` (single-card; the latter returns the fit
  fields so the badge fills in place), `startScoring` (creates an async run, returns
  the id), `cancelScoring`, `prefillFromCv`. Resolves the user's key and calls
  `src/lib/ai`; degrades with a message (never crashes) when no key exists. Full
  pipeline in [`ai-scoring.md`](./ai-scoring.md).
- `discovery.ts` — `loadJobsPage` (DB-paginated inbox; New is best-fit-first). Backs
  the IntersectionObserver infinite scroll.
- `ai-key.ts` — `setApiKey` (encrypts + upserts into `user_secrets`), `clearApiKey`.
  The plaintext key is never returned, logged, or sent to the client.
- `jobs.ts` — `setJobState`, `promoteJob` (creates the linked application), and
  `runUserIngestion` (the manual "Refresh inbox", RLS-scoped to the user; records an
  [ingestion run](./logging.md)).
- `sources.ts` — create/toggle/delete sources (parses the config JSON).
- `filters.ts` — save/delete presets.
- `companies.ts` — company CRUD (create/update/delete), each emitting one event.
- `contacts.ts` — contact CRUD + `clearFollowUp`; on save it auto-creates-or-links a
  company by name (idempotent against the unique `lower(name)` index — see
  [logging](./logging.md) for why that link is silent). Pure parse/validation lives in
  `src/lib/contacts.ts`.
- `outreach.ts` — `logOutreach` (stamps the contact's `last_contacted_at`),
  `setOutreachStatus` (emits `outreach.status_changed`), and `clearBump`. Backs the
  touch log + the follow-up cadence surfaced on `/needs-action`.
- `templates.ts` — message-template CRUD (`saveTemplate`/`deleteTemplate`) + the
  read-only `draftMessage` (fills a template's `{variable}` slots from the
  contact/company/profile context, optionally AI-personalizes via `runDraft`,
  returns the draft without sending/logging). Pure parse/validation/substitution
  lives in `src/lib/templates.ts`. **The one exception to the rule below:** template
  mutations emit **no** event — templates are settings, not activity.

Each action calls `requireUser()`, mutates via the RLS-scoped server client, emits
**exactly one** [`activity_events`](./logging.md) row via `logActivity` (the lone
exception is `templates.ts`, above), then `revalidatePath()` so the affected Server
Components re-render with fresh data.

### `src/lib/ai/` — AI fit-scoring + CV prefill + message drafting

LLM features via the official `@anthropic-ai/sdk` on **Claude Haiku 4.5**
(`claude-haiku-4-5` — fast/cheap; no `effort` param). Split like the source layer:
a **pure, unit-tested core** and **server-only** glue, with the model call injected
exactly like source fetchers inject `fetchImpl`.

| File            | Side | Responsibility                                                                 |
| --------------- | ---- | ------------------------------------------------------------------------------ |
| `types.ts`      | pure | `ModelRequest`/`ModelCall` (the injectable seam), `ScoringProfile`/`ScoringJob`, `ScoreResult`, `CvPrefill`, `DraftRequest`/`DraftResult`. |
| `prompt.ts`     | pure | `buildScorePrompt` / `buildPrefillPrompt` / `buildDraftPrompt` — deterministic payloads asking for strict JSON; `AI_MODEL`. |
| `parse.ts`      | pure | `parseScoreResponse` / `parsePrefillResponse` / `parseDraftResponse` — zod-validate + coerce, throw on malformed. |
| `hash.ts`       | pure | `scoredProfileHash` — stable, order/case-insensitive hash of scoring-relevant profile fields. |
| `progress.ts`   | pure | `chunkLimit` / `settleChunk` — batch-run chunk accounting (how many next, when done). |
| `score.ts`      | pure | `runScore` / `runBatchScore` / `runPrefill` / `runDraft` orchestrators + DB-row adapters (`profileToScoring`, `jobToScoring`, `jobToBatchScoring`, `fitColumns`). |
| `prompt.ts` (batch) | pure | also `buildBatchScorePrompt` + `BATCH_SCORE_CAP` — scores ≤8 jobs in one cached request. |
| `client.ts`     | **server-only** | `anthropicCall(key)` — wraps the SDK into a `ModelCall` (+ marks the cacheable system block). |
| `crypto.ts`     | **server-only** | aes-256-gcm `encryptSecret`/`decryptSecret` (key from `APP_ENCRYPTION_KEY`). |
| `resolve-key.ts`| **server-only** | resolve the user's key (decrypt) → env fallback → null; `has*AnthropicKey` checks. |
| `scoring-run.ts`| **server-only** | DB+SDK plumbing for async runs: `createScoringRun`, `processChunk`, `runScoringToCompletion`. |

**Design rule:** the `server-only` modules (`client`, `crypto`, `resolve-key`,
`scoring-run`) **must stay out of the test import graph** — `server-only` throws
under vitest. The pure modules carry the logic and the tests; the actions/route
handlers wire in the SDK + DB. Async batch scoring (runs, batching, prompt caching,
the chunk loop, cron auto-scoring) is documented end-to-end in
[`ai-scoring.md`](./ai-scoring.md).

### `src/lib/activity/` — the unified activity + ingestion log

| File | Side | Responsibility |
| ---- | ---- | -------------- |
| `summary.ts` | pure | `categoryFromType` + `buildActivitySummary(type, meta)` — the stored human line. |
| `feed.ts` | pure | `activityHref(event)` — where a feed line links. |
| `log.ts` | DB glue | `logActivity` — the single emission point for `activity_events`. |
| `record-run.ts` | DB glue | `recordIngestionRun` — writes `ingestion_runs`/`_sources` (+ `redactSecrets`) and emits the bridging event. |

The two-layer model (human feed vs operational run metrics) is documented in
[`logging.md`](./logging.md).

### `src/lib/` root

- `constants.ts` — the controlled vocabularies (statuses, modes, channels, job
  states, source types) and `SOURCE_META` (labels, config hints, API notes). Import
  enums from here, don't re-declare them.
- `utils.ts` — `cn()`, date/salary/status formatting, `todayISO`, overdue/terminal
  predicates. Pure, used by both server and client code.
- `profile.ts` — pure profile/CV helpers: CV text sanitize/clamp, list & links
  parse/serialize, seniority/work-mode/salary normalization, and
  `buildProfilePayload`/`validateProfile`. No React, no DB; unit-tested in
  `tests/profile.test.ts`.
- `contacts.ts` — pure companies/contacts helpers: text/email/url/channel
  normalization, `buildCompanyPayload`/`validateCompany`,
  `buildContactPayload`/`validateContact`, `contactCompanyName`. No React, no DB;
  unit-tested in `tests/contacts.test.ts`.
- `insights.ts` — pure channel-attribution funnel: `buildChannelFunnel(applications,
  outreach)` (per-channel sent→reply→screen→interview→offer + rates),
  `funnelTotals`, `bestChannel` (the "act here" pick). No React, no DB; unit-tested
  in `tests/insights.test.ts`. Backs the `/insights` page.
- `templates.ts` — pure message-template helpers: `fillTemplate` (substitutes
  known `{company}/{role}/{contact}/{stack}/{name}` tokens, leaves unknown/empty
  ones literal), `extractVars`, `buildTemplatePayload`/`validateTemplate`. No React,
  no DB; unit-tested in `tests/templates.test.ts`. Backs `draftMessage` + the
  templates manager on /profile.
- `pipeline.ts` — shared ingestion-pipeline glue (unit-tested in
  `tests/pipeline.test.ts`).
- `og.tsx` — the shared `next/og` HUD social-card markup, used by both
  `app/opengraph-image.tsx` and `app/twitter-image.tsx`.
- `demo/fixtures.ts` — the sample data for the public `/demo` (read-only command
  bridge / tracker / discovery with the same components as the real app).

---

## `src/types/database.ts`

Hand-written mirror of the SQL schema (row types + a `Database` type for supabase-js
generics). **Uses `type` aliases, not `interface`s** on purpose — supabase-js
constrains tables to `Record<string, unknown>`, which object-literal types satisfy
and interfaces don't. Keep it in sync with the migration (or regenerate with
`supabase gen types`).

---

## `src/app` — routes (App Router)

```
layout.tsx            root layout: fonts (Inter + JetBrains Mono), globals.css,
                      metadataBase + title template + base openGraph/twitter, viewport
globals.css           Tailwind v4 @theme design tokens (see design-system.md)
page.tsx              "/" -> redirect to /needs-action or /login
demo/                 public read-only demo (command bridge / tracker / discovery)
icon.svg              brand mark; favicon.ico/apple-icon.png generated via `npm run icons`
manifest.ts robots.ts sitemap.ts          file-based metadata (robots disallows /api)
opengraph-image.tsx twitter-image.tsx     next/og 1200×630 HUD cards (share src/lib/og.tsx)

login/                magic-link + Google sign-in (client)
auth/
  callback/route.ts   OAuth + PKCE magic-link code exchange
  confirm/route.ts    token_hash magic-link flow (optional template)
  signout/route.ts    POST sign-out
  auth-code-error/    invalid-link page
legal/                public sources & attribution page

(app)/                ROUTE GROUP for everything behind auth (no URL segment)
  layout.tsx          requireUser() + the sidebar/mobile shell + needs-action badge
  needs-action/       the command-bridge hero (queue, vitals, telemetry)
  tracker/            applications pipeline (board ⇄ console, drag-and-drop)
  discovery/          the inbox (tabs, filters, presets, per-job AI scoring)
  contacts/           the people CRM (console + company filter/detail + outreach; the outreach composer pulls in message templates)
  sources/            ingestion config
  activity/           the unified activity feed (filter + streamed event log)
  insights/           channel-attribution funnel (pipeline by channel, read-only)
  profile/            profile + CV (form, PDF upload/extract, AI key, prefill) + message-templates manager
  # each segment above also ships loading.tsx (HUD skeleton) + error.tsx (HudError)

api/
  import/route.ts               session-protected normalized-job upsert
  cron/ingest/route.ts          CRON_SECRET-guarded, service-role, per-user ingest + auto-score
  scoring/chunk/route.ts        processes ONE chunk of a scoring run (session-scoped)
  applications/export/route.ts  JSON export download
```

Conventions / Next 16 specifics:

- **`(app)` route group** wraps every protected page in one layout that calls
  `requireUser()` once and renders the nav shell — pages inside assume a user.
- **Pages are Server Components** and read data directly via the server client; the
  proxy has already redirected anonymous users, so reads are safe.
- **`searchParams` and `params` are Promises** (Next 16) — `await` them. Filters and
  the tracker toolbar drive state through `searchParams`, so URLs are shareable.
- **Route Handlers** are for non-UI entry points (APIs, cron, file download);
  everything user-facing prefers Server Actions.

---

## `src/components` — UI (the HUD system)

The whole UI speaks one visual language — the **Command Center HUD**. The framing,
tokens, dials, and the rules for building new UI are documented in
[`design-system.md`](./design-system.md). Files split by who renders them:

- **The HUD kit (server-safe):** `hud-frame.tsx` (`HudFrame` — the **one** panel
  primitive; an SVG frame with chamfered, bracketed corners), `hud.tsx`
  (`SectionLabel`, `StatusLed`, `TickBar`, `StatReadout`, `RadialMeter`, `LogFeed`),
  `ui.tsx` (`Card`/`Button`/`Badge`/`Input`/`Select`/`Stat`/`EmptyState`),
  `hud-skeleton.tsx` (`Skeleton`/`SkeletonPanel` for `loading.tsx` + Suspense),
  `hud-error.tsx` (`HudError`, the shared retry-able boundary), `status-badge.tsx`,
  `job-score.tsx` (the fit badge), `hud-clock.tsx` (the `CountdownTimer`).
  (`hud-frame.tsx` and `hud-clock.tsx` are `'use client'` for their effects but carry
  no app state.)
- **Composed surfaces:** `needs-action-view.tsx` (`CommandBridge` — shared by the
  real page **and** `/demo`; its Priority Alerts queue takes a merged `AlertItem[]`
  of applications + contact follow-ups + outreach bumps, rendered via
  `alert-cards.tsx`), `tracker-board.tsx` (the @dnd-kit kanban) +
  `board-card.tsx`, `tracker-console.tsx` (dense table) + `tracker-toggle.tsx`
  (board⇄console, URL-driven), `tracker-stats.tsx`/`tracker-toolbar.tsx`,
  `app-card.tsx`, `app-shell.tsx` (`SideNav`/`MobileNav`).
- **Client widgets (`'use client'`):** `modal.tsx`, `application-dialog.tsx`
  (create/edit form), `application-actions.tsx` (delete/clear), `contacts-console.tsx`
  (the sortable people table), `contact-dialog.tsx` + `company-dialog.tsx`
  (create/edit forms), `contact-actions.tsx` (delete + clear-follow-up),
  `outreach-dialog.tsx` (log a touch) + `outreach-actions.tsx` (status select +
  clear-bump), `discovery-list.tsx`
  (owns the paginated inbox + per-job AI scoring streaming), `discovery-tabs.tsx`,
  `discovery-actions.tsx` (refresh + paste-import), `filter-panel.tsx`,
  `preset-bar.tsx`, `add-source-form.tsx`, `source-card.tsx`, `profile-form.tsx`
  (editor + "Prefill from CV"), `cv-panel.tsx` (CV upload/replace), `ai-key-panel.tsx`
  (set/clear the API key), `onboarding-checklist.tsx`.

Pattern: a server component renders display markup and drops in small client widgets
that call Server Actions — keeping most of the tree server-rendered and shipping the
minimum client JS. Panels are always framed with `HudFrame`, never raw CSS borders.

---

## How a request flows

**Reading the tracker:**
`proxy.ts` (refresh session, allow) → `(app)/layout.tsx` (`requireUser`, render shell)
→ `(app)/tracker/page.tsx` (server client query, RLS-scoped) → `ApplicationCard`s →
client action buttons.

**Editing an application:**
`EditApplicationButton` (client) → modal form → `updateApplication` Server Action
(`requireUser` → RLS update → `revalidatePath('/tracker')`) → page re-renders.

**Ingesting jobs (manual):**
Sources page → `RefreshInboxButton` → `runUserIngestion` action → `runFetchers`
(each fetcher via `fetchImpl`, isolated, deduped) → `persistJobs` upsert → revalidate.

**Ingesting jobs (scheduled):**
Vercel Cron → `GET /api/cron/ingest` (verify `CRON_SECRET`) → `admin` client → group
enabled sources by user → `executeIngestion` + `recordIngestionRun` per user →
**auto-score** newly-ingested jobs (`runScoringToCompletion`, deadline-bounded) →
JSON summary.

**Importing (Cowork / paste):**
`POST /api/import` (verify session) → `parseImportPayload` → `persistJobs` (RLS) →
job appears under Discovery → New.

**AI fit-scoring (batch run):**
`startScoring` action (`createScoringRun`: count needy jobs, insert a `running` run)
→ Discovery client POSTs `/api/scoring/chunk` repeatedly → `processChunk` (one
batched + prompt-cached call per chunk; writes `fit_*`, bumps counters) until
`remaining=0`; each response's `updated[]` fills the badges. Full detail in
[`ai-scoring.md`](./ai-scoring.md).

---

## Where do I put…?

| I want to…                                   | Put it in…                                                  |
| -------------------------------------------- | ---------------------------------------------------------- |
| Add a job source/provider                    | `src/lib/sources/<name>.ts` + register in `index.ts`       |
| Change how jobs dedupe/normalize/filter      | `src/lib/discovery/*` (and add/adjust a test)              |
| Add a user-triggered mutation                | `src/lib/actions/*` (Server Action)                        |
| Add a public/automation HTTP endpoint        | `src/app/api/**/route.ts` (Route Handler)                  |
| Add/change a page                            | `src/app/(app)/<route>/page.tsx` (Server Component)        |
| Add a reusable visual element                | `src/components/ui.tsx` (no hooks) or a new client widget  |
| Add an enum/label/source metadata            | `src/lib/constants.ts`                                     |
| Change the schema                            | new file in `supabase/migrations/` + mirror in `src/types/database.ts` |
| Restyle the palette/tokens                   | `src/app/globals.css` (`@theme`) — see [design-system.md](./design-system.md) |
| Add/adjust AI scoring prompts or parsing     | `src/lib/ai/*` (pure core; add a test) — see [ai-scoring.md](./ai-scoring.md) |
| Log a new user-meaningful action             | `logActivity` in the action + (if new) `ACTIVITY_TYPES`/`buildActivitySummary` — see [logging.md](./logging.md) |
| Add a HUD panel / dial / readout             | reuse `HudFrame` + `src/components/hud.tsx`; extend the kit if missing |

---

## Testing & the green gate

Pure logic in `src/lib/discovery`, `src/lib/sources`, `src/lib/profile`, and the
pure half of `src/lib/ai` (prompt/parse/hash/score, via a canned `ModelCall`) is
unit-tested in `tests/` (see [`testing.md`](./testing.md)). Components, actions,
and RLS are covered by the manual walkthrough plus `typecheck` + `build`. Before
"done":

```bash
npm run typecheck && npm run lint && npm test && npm run build
```
