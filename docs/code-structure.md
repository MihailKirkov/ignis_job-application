# Code structure

What lives where, and why. Read this before adding a feature so new code lands in
the layer it belongs to.

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

Four ways to talk to Supabase, picked by **where you are**:

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

One file per provider, all reducing to the same `NormalizedJob` shape:

```
types.ts        NormalizedJob shape, JobSource/FetchContext interfaces
adzuna.ts arbeitnow.ts remotive.ts remoteok.ts    feed APIs
greenhouse.ts lever.ts ashby.ts workable.ts        public ATS company boards
index.ts        registry: SourceType -> fetcher, + serverFetchContext() (reads env)
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
| `ingest.ts`        | the orchestrator: `runFetchers` (per-source isolation + dedupe), `toJobRows`, `persistJobs` (the idempotent upsert). |

`ingest.ts` is the one file here that *touches* a Supabase client — but only via a
passed-in argument (`persistJobs(supabase, …)`), so it stays testable and the caller
(action or cron) owns the client.

### `src/lib/actions/` — Server Actions (the write path for the UI)

`'use server'` mutations called directly from Client Components. One file per
aggregate:

- `applications.ts` — CRUD, `clearNextAction`, `setStatus`. Form actions return
  `{ ok, error }` for `useActionState`; imperative ones (delete/clear) are called
  via `useTransition`.
- `profile.ts` — `saveProfile` (upsert the 1:1 profile + pasted CV text),
  `uploadCv` (store the PDF in the private `cvs` bucket + extract its text with
  `unpdf`), `removeCvFile`. Pure parsing/validation lives in `src/lib/profile.ts`.
- `jobs.ts` — `setJobState`, `promoteJob` (creates the linked application), and
  `runUserIngestion` (the manual "Refresh inbox", RLS-scoped to the user).
- `sources.ts` — create/toggle/delete sources (parses the config JSON).
- `filters.ts` — save/delete presets.

Each action calls `requireUser()`, mutates via the RLS-scoped server client, then
`revalidatePath()` so the affected Server Components re-render with fresh data.

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
layout.tsx            root layout: fonts (Inter + JetBrains Mono), globals.css
globals.css           Tailwind v4 @theme design tokens (the dark palette + amber accent)
page.tsx              "/" -> redirect to /needs-action or /login

login/                magic-link + Google sign-in (client)
auth/
  callback/route.ts   OAuth + PKCE magic-link code exchange
  confirm/route.ts    token_hash magic-link flow (optional template)
  signout/route.ts    POST sign-out
  auth-code-error/    invalid-link page
legal/                public sources & attribution page

(app)/                ROUTE GROUP for everything behind auth (no URL segment)
  layout.tsx          requireUser() + the sidebar/mobile shell + needs-action badge
  needs-action/       the hero queue
  tracker/            applications pipeline
  discovery/          the inbox (tabs, filters, presets)
  sources/            ingestion config
  profile/            profile + CV (form + PDF upload/extract)

api/
  import/route.ts             session-protected normalized-job upsert
  cron/ingest/route.ts        CRON_SECRET-guarded, service-role, per-user ingest
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

## `src/components` — UI

Split by who renders them:

- **Server-safe primitives:** `ui.tsx` (Card/Button/Badge/Input/Select/Stat/…),
  `status-badge.tsx`, `application-card.tsx`, `job-card.tsx`, `discovery-tabs.tsx`.
  No hooks — they render on the server and embed client widgets for interactivity.
- **Client widgets (`'use client'`):** the interactive bits — `modal.tsx`,
  `application-dialog.tsx` (create/edit form), `application-actions.tsx`
  (delete/clear), `tracker-toolbar.tsx` (search/status), `job-state-controls.tsx`
  (save/dismiss/promote), `filter-panel.tsx`, `preset-bar.tsx`,
  `discovery-actions.tsx` (refresh + paste-import), `add-source-form.tsx`,
  `source-controls.tsx`, `profile-form.tsx` (the profile editor),
  `cv-panel.tsx` (CV upload/replace), `app-shell.tsx` (nav).

Pattern: a server component (e.g. `application-card.tsx`) renders display markup and
drops in small client buttons (`EditApplicationButton`, `DeleteApplicationButton`)
that call Server Actions. This keeps most of the tree server-rendered and ships the
minimum client JS.

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
enabled sources by user → `runFetchers` + `persistJobs` per user → JSON summary.

**Importing (Cowork / paste):**
`POST /api/import` (verify session) → `parseImportPayload` → `persistJobs` (RLS) →
job appears under Discovery → New.

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
| Restyle the palette/tokens                   | `src/app/globals.css` (`@theme`)                           |

---

## Testing & the green gate

Pure logic in `src/lib/discovery`, `src/lib/sources`, and `src/lib/profile` is
unit-tested in `tests/` (see [`testing.md`](./testing.md)). Components, actions,
and RLS are covered by the manual walkthrough plus `typecheck` + `build`. Before
"done":

```bash
npm run typecheck && npm run lint && npm test && npm run build
```
