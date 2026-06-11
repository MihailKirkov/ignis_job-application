# Testing guide

Two parts:

- **A. Manual walkthrough** — every page, what it should do, and what to try.
- **B. The automated test suite** — what's in `tests/`, how to run it, and how to
  extend it.

Prerequisite: the app is set up and running (`npm run dev`, signed in). See
[`setup.md`](./setup.md).

---

## A. Manual walkthrough

### 0. Auth & route protection

| Try this                                              | Expected                                                            |
| ----------------------------------------------------- | ------------------------------------------------------------------- |
| Visit `/tracker` (or any app page) while signed out   | Redirected to `/login?redirect=/tracker`.                           |
| Visit `/` while signed out                            | Redirected to `/login`.                                             |
| On `/login`, enter your email → **Send magic link**   | "Check <email> for a magic link" confirmation.                      |
| Open the link **in the same browser**                 | Lands on **Needs action**, now signed in.                           |
| Visit `/login` while signed in                        | Redirected to `/needs-action`.                                      |
| Sidebar → **Sign out**                                | Back to `/login`; protected pages are blocked again.                |
| (If enabled) **Continue with Google**                 | Google OAuth → back to the app signed in.                           |

### 1. Needs action (`/needs-action`) — the hero

The queue of applications whose `next_action_date` is **today or earlier** and that
are **not** Rejected/Closed.

- Starts empty: "Queue is clear ✓".
- After you create an application with a past/today next-action date (step 2), it
  appears here, split into **Overdue** (red) and **Due today**.
- The sidebar **Needs action** item shows a count badge.
- Click **✓ Clear** on an item → its next-action is cleared and it leaves the queue
  immediately.

### 2. Tracker (`/tracker`) — your pipeline

- **+ New application** (amber, the primary action) → modal form. Company and Role
  are required; everything else optional. Save → the card appears in the list.
- The **stat row** updates: Total, Active (non-terminal), and a count per status.
- **Edit** on a card → same form pre-filled; change the status (e.g. To apply →
  Applied) and save → the status badge color changes (Applied=blue, Screening=
  violet, Interview=amber, Offer=green, Rejected=red, To-apply/Closed=grey).
- **Search** box (debounced) filters by company/role/location/notes; the **status**
  dropdown filters by stage. Both reflect in the URL (`?q=…&status=…`) — reload to
  confirm they persist.
- **Sort order:** items with a next-action date come first (soonest first), then by
  most recent date-applied. Add a couple of applications with different dates to see
  it.
- **Delete** → confirm dialog → row removed.
- **Export JSON** → downloads `applications-YYYY-MM-DD.json` with all your rows.

Things worth verifying:

- Create an application with a **next action** + a **past** next-action-date → it
  shows an amber/overdue strip on the card **and** appears in Needs action.
- Overdue dates render in red with "· overdue".

### 3. Sources (`/sources`) — configure ingestion

- **+ Add source** → choose a type. The form shows an example config and the field
  hints for that type, plus an API note. Edit the JSON and **Add source**.
  - Adzuna example: `{ "query": "react", "where": "Eindhoven", "country": "nl", "max_days_old": 14 }`
  - Greenhouse/Lever/Ashby/Workable: `{ "token": "<board-slug>", "name": "<Company>" }`
- Each source row shows its config, enabled state, and last-run time.
- The **toggle** enables/disables a source (disabled sources are skipped by
  ingestion). **Remove** deletes it.
- **↻ Refresh inbox** runs all your enabled sources now and shows a summary like
  `+N upserted from M sources`. Re-running is **idempotent** — running twice doesn't
  duplicate jobs (dedupe + upsert).

Try: add one Adzuna source and one public ATS board (e.g. Greenhouse token
`vercel`), refresh, and watch the counts.

### 4. Discovery (`/discovery`) — the inbox

- **State tabs**: New / Saved / Promoted / Dismissed, each with a count. After a
  refresh, ingested jobs land under **New**.
- Each **job card** shows title, company, location/mode, source label, salary (if
  known), posted date, and a link ↗ to the original posting.
- Card actions:
  - **Save** → moves the job to **Saved**.
  - **Dismiss** → moves it to **Dismissed** (where you can **Restore**).
  - **Promote** (amber) → creates a **pre-filled application** linked to the job and
    marks the job **Promoted**. Check `/tracker` — the new application is there with
    company/role/link filled and status "To apply".
- **Filters** (collapsible panel): include/exclude keywords (with any/all),
  location scope (Eindhoven+radius / NL / Remote), min salary, work mode, seniority,
  posted-within-N-days, source, language. Click **Apply filters** → the list narrows
  and the count shows "X of Y". The active filter count appears on the panel header,
  and filters live in the URL (shareable/bookmarkable).
- **Presets**: set some filters → **+ Save current** → name it. The chip appears;
  click it to re-apply later; ✕ deletes it.
- **Paste import** → paste a JSON array like
  `[{ "title": "Senior Engineer", "company": "ASML", "url": "https://…" }]` →
  **Import** → the job appears under **New** (this is the Cowork on-demand path; see
  `docs/cowork-import.md`).

### 5. Sources & attribution (`/legal`)

Linked from the sidebar footer. Lists every source with a link back to its origin
(satisfies RemoteOK/Remotive attribution requirements).

### 6. API endpoints (optional manual checks)

With the dev server running and signed in (browser carries the session cookie):

| Endpoint                         | Method | Without session | With session                          |
| -------------------------------- | ------ | --------------- | ------------------------------------- |
| `/api/applications/export`       | GET    | `401`           | JSON download of your applications    |
| `/api/import`                    | POST   | `401`           | `{ ok, imported, skipped, errors }`   |
| `/api/cron/ingest`               | GET    | `401`           | needs `Authorization: Bearer <secret>`|

Cron (server-to-server, not session-based):

```bash
# wrong/no secret -> 401
curl -i http://localhost:3000/api/cron/ingest
# correct secret -> JSON summary (needs SUPABASE_SERVICE_ROLE_KEY set)
curl -H "Authorization: Bearer <CRON_SECRET>" http://localhost:3000/api/cron/ingest
```

### 7. Multi-user / RLS sanity check (optional but recommended)

Sign in as a **second** email, add your own applications/sources, then sign back in
as the first user. You should **never** see the other account's rows — RLS scopes
every table to `auth.uid()`. This is the core security guarantee.

### Accessibility / polish to spot-check

- **Keyboard:** tab through `/tracker` — focus rings are visible (amber outline);
  the New-application modal closes on **Escape**.
- **Reduced motion:** with OS "reduce motion" on, transitions are minimized.
- **Mobile:** narrow the window — the sidebar collapses to a top nav; layouts stay
  usable.

---

## B. The automated test suite (`tests/`)

The pure, high-value logic — source normalization, dedupe, filtering, and import
validation — is covered by [Vitest](https://vitest.dev) unit tests. These are the
parts most likely to break silently, and they run in milliseconds with **no network
and no database** (every source fetcher takes an injectable `fetch`, so tests feed
canned JSON).

### Running

```bash
npm test          # run once (vitest run) — 79 tests
npm run test:watch # re-run on file changes while developing
```

Run a single file or filter by name:

```bash
npx vitest run tests/filters.test.ts
npx vitest run -t "dedupeFuzzy"
```

Config is `vitest.config.ts` (node environment, `@/*` path alias, picks up
`tests/**/*.test.ts`).

### What each file covers

| File                               | Covers (source under test)                                                                 |
| ---------------------------------- | ------------------------------------------------------------------------------------------ |
| `tests/normalize.test.ts`          | `src/lib/discovery/normalize.ts` — fuzzy key, seniority/mode guess, salary + date parsing.  |
| `tests/dedupe.test.ts`             | `src/lib/discovery/dedupe.ts` — exact `(source, external_id)` + fuzzy cross-source dedupe.  |
| `tests/filters.test.ts`            | `src/lib/discovery/filters.ts` — every filter criterion + combined `filterJobs`.            |
| `tests/filter-params.test.ts`      | `src/lib/discovery/filter-params.ts` — criteria ⇄ URL-param mapping + roundtrip.            |
| `tests/sources/normalizers.test.ts`| all 8 fetchers in `src/lib/sources/*` — field mapping, HTML/entity stripping, edge cases.   |
| `tests/ingest.test.ts`             | `src/lib/discovery/ingest.ts` — failure isolation, cross-source dedupe, `toJobRows` shape.  |
| `tests/import-schema.test.ts`      | `src/lib/discovery/import-schema.ts` — `/api/import` payload validation + id derivation.     |

### What is and isn't tested here

- ✅ **Tested:** the deterministic core — normalizers, dedupe, filters, import
  validation, the ingestion runner's orchestration (with a stubbed `fetch`).
- ❌ **Not unit-tested:** React components, server actions, and DB/RLS behavior —
  those depend on a live Supabase and are covered by the **manual walkthrough**
  above plus `npm run typecheck` and `npm run build`. (The multi-user/RLS check in
  A.7 is the manual stand-in for DB-level tests.)

### The pattern for source-fetcher tests

Fetchers never call the network directly — they accept `ctx.fetchImpl`. Tests pass
a stub that returns canned JSON, so they're fast and deterministic:

```ts
function stub(body: unknown, init = { ok: true, status: 200 }) {
  const impl = (async () => ({ ok: init.ok, status: init.status, json: async () => body }))
    as unknown as typeof fetch;
  return { impl };
}

const { impl } = stub({ results: [/* canned Adzuna payload */] });
const jobs = await fetchAdzuna(config, { adzunaAppId: 'id', adzunaAppKey: 'key', fetchImpl: impl });
expect(jobs[0]).toMatchObject({ source: 'adzuna', title: 'Senior React Engineer' });
```

### Adding tests (when you change/extend logic)

- **New source fetcher:** add a `describe` block in `tests/sources/normalizers.test.ts`
  with a representative canned payload; assert the normalized fields, and cover at
  least one edge case (missing fields, HTML in text, the "throws without token"
  path, etc.).
- **New/changed filter criterion:** add cases to `tests/filters.test.ts` (predicate
  behavior) and `tests/filter-params.test.ts` (param parsing/roundtrip).
- **Touching normalize/dedupe/import:** extend the matching file. These are pure
  functions — prefer small, table-driven `it.each` cases.

### The green gate

Before considering any change "done", run all four and keep them green (this is the
same gate the project was built against):

```bash
npm run typecheck && npm run lint && npm test && npm run build
```
