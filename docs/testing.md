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

### 1. Needs action (`/needs-action`) — the command bridge

The HUD "command bridge" homepage (see [`design-system.md`](./design-system.md)):

- **Command bar:** a **T-MINUS countdown** to the mission deadline + the milestone
  date. Both come from `MISSION` in `src/lib/constants.ts` — edit `targetDate` /
  `milestone` and reload to confirm the countdown re-targets.
- **Vitals:** Active / Applied / Interview / Offer readouts + a **RESPONSE RATE**
  radial gauge (replies ÷ sent). Create/advance a few applications and watch them move.
- **Priority alerts:** the queue of applications whose `next_action_date` is **today
  or earlier** and that are **not** Rejected/Closed — split into **Overdue** (red)
  and **Due today** (amber). Starts as "queue clear". The sidebar **Needs action**
  item shows a count badge.
- Click **✓ Clear** on an item → its next-action clears and it leaves the queue.
- **Telemetry:** a live feed of recent activity events (see section 6).

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

**Board vs Console** (toggle top-right, reflected in `?view=`):

- **Console** — the dense table (search + status filter apply here).
- **▦ Board** — a drag-and-drop kanban. Drag a card across lanes (To apply → Applied
  → … → Offer) and it **moves immediately** (optimistic) while the status persists in
  the background; the status badge recolours. **Rejected / Closed** are compact
  archive drop zones below — drag a card there to archive it. Drag to an invalid spot
  or kill the network and the card **reverts** with a toast. Keyboard: focus a card's
  grip handle and use space + arrows. With OS reduce-motion on, the drop animation is
  suppressed.
- **Auto-fill from Discovery:** when you **Promote** a job (section 4), the new card
  lands in **To apply** with company/role/link pre-filled and `job_id` linked, so its
  AI **fit score** badge rides along onto the board/console.

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

**AI fit-scoring** (needs a profile + an Anthropic key — section 5; full pipeline in
[`ai-scoring.md`](./ai-scoring.md)):

- Each **New** card has a **Score / Rescore** control. Click it → after a moment the
  card shows a fit **badge** (0–100 + verdict colour: green strong / amber medium /
  red weak) and a one-line rationale; matched skills + gaps are recorded.
- **Score new jobs** (batch) → kicks off an async run; progress shows **"scored X /
  N"** with a **Cancel**, and each badge fills in as its chunk returns. Reload
  mid-run → you're offered **Resume**.
- The **New** tab is sorted **best-fit-first** (unscored last) — score a handful and
  reload to see the order change.
- **Staleness:** edit your profile (section 5) and the existing scores go stale;
  re-running scores them again (the stored profile hash changed).
- **No key?** Scoring is disabled with a message — never a crash.

### 5. Profile & CV (`/profile`)

- **Profile form:** identity, seniority, skills, target roles/locations/salary, work
  modes, languages, links. Save → a `profile.updated` activity event is logged.
- **CV:** paste plain text, **or** upload a **PDF** → its text is extracted (`unpdf`)
  into `cv_text` and the file is stored in the private `cvs` bucket. **Remove** clears
  the file.
- **AI key (Profile → AI):** paste your Anthropic key → it's encrypted and stored in
  `user_secrets` (the plaintext is never shown again). **Clear** removes it. Without a
  stored key, scoring falls back to the server `ANTHROPIC_API_KEY` if set.
- **Prefill from CV:** with CV text present, this extracts skills / seniority /
  summary / target roles for you to review and save (it does not auto-write).

### 6. Activity (`/activity`)

The unified feed of every action (see [`logging.md`](./logging.md)):

- Every mutation you did above (created/edited/deleted an application, saved/dismissed/
  promoted a job, changed a source, updated the profile, ran ingestion) appears as a
  line with a category dot, a human summary, and a timestamp; clicking it deep-links
  to the relevant surface.
- **Filter** by category + date range (the bar submits instantly; the log streams in).
- **Ingestion rows expand** (native `<details>`) into a per-source breakdown table
  (fetched / new / updated / status). Confirm secrets never appear in a message.

### 7. Sources & attribution (`/legal`)

Linked from the sidebar footer. Lists every source with a link back to its origin
(satisfies RemoteOK/Remotive attribution requirements).

### 8. API endpoints (optional manual checks)

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

### 9. Multi-user / RLS sanity check (optional but recommended)

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
npm test          # run once (vitest run) — 19 files, 227 tests
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

The suite is **19 files / 227 tests**, all over the **pure** logic (no network, no
DB). The `src/lib/ai/*` server-only modules (`client`, `crypto`, `resolve-key`,
`scoring-run`) are deliberately **out** of the test import graph — `server-only`
throws under Vitest — so only the pure AI core is unit-tested (via a fake
`ModelCall`).

**Discovery brain + sources**

| File | Covers (source under test) |
| ---- | -------------------------- |
| `tests/normalize.test.ts` | `discovery/normalize.ts` — fuzzy key, seniority/mode guess, salary + date parsing, HTML strip. |
| `tests/dedupe.test.ts` | `discovery/dedupe.ts` — exact `(source, external_id)` + fuzzy cross-source dedupe + source trust ranking. |
| `tests/filters.test.ts` | `discovery/filters.ts` — every filter criterion + combined `filterJobs`. |
| `tests/filter-params.test.ts` | `discovery/filter-params.ts` — criteria ⇄ URL-param mapping + roundtrip. |
| `tests/import-schema.test.ts` | `discovery/import-schema.ts` — `/api/import` payload validation + id derivation. |
| `tests/ingest.test.ts` | `discovery/ingest.ts` — failure isolation, cross-source dedupe, `toJobRows`/`diffJobs`/`summarizeRun`. |
| `tests/pipeline.test.ts` | `lib/pipeline.ts` — the shared ingestion pipeline glue. |
| `tests/sources/normalizers.test.ts` | all **10** fetchers in `sources/*` — field mapping, HTML/entity stripping, edge cases. |

**Profile + activity**

| File | Covers |
| ---- | ------ |
| `tests/profile.test.ts` | `lib/profile.ts` — CV sanitize/clamp, list/links parse, normalization, `validateProfile`. |
| `tests/contacts.test.ts` | `lib/contacts.ts` — text/email/url/channel normalization, `buildCompanyPayload`/`buildContactPayload`, `validate*`. |
| `tests/insights.test.ts` | `lib/insights.ts` — `buildChannelFunnel` stage counts + rates, null→Other, ordering, `funnelTotals`, `bestChannel`. |
| `tests/templates.test.ts` | `lib/templates.ts` — `fillTemplate` `{variable}` substitution (case/whitespace, unknown/empty left literal, idempotent), `extractVars`, `buildTemplatePayload`/`validateTemplate`. |
| `tests/activity-summary.test.ts` | `activity/summary.ts` — `categoryFromType` + `buildActivitySummary` for every event type (incl. company/contact). |

**AI (pure core, via an injected `ModelCall`)**

| File | Covers |
| ---- | ------ |
| `tests/ai-prompt.test.ts` | `ai/prompt.ts` — single + batch + prefill prompt builders, cache flag, caps. |
| `tests/ai-parse.test.ts` | `ai/parse.ts` — score/prefill parse + coerce/clamp, fence/prose extraction. |
| `tests/ai-batch.test.ts` | `ai/parse.ts` + `ai/score.ts` — `parseBatchScoreResponse` tolerance (missing/extra/duplicate ids) + `runBatchScore`. |
| `tests/ai-hash.test.ts` | `ai/hash.ts` — `scoredProfileHash` stability + order/case independence. |
| `tests/ai-score.test.ts` | `ai/score.ts` — `runScore`/`runPrefill` orchestration + the `progress.ts` chunk accounting. |
| `tests/ai-draft.test.ts` | `ai/prompt.ts` + `ai/parse.ts` + `ai/score.ts` — `buildDraftPrompt` context embedding, `parseDraftResponse` (subject coercion, fences, malformed throws), `runDraft`. |

### What is and isn't tested here

- ✅ **Tested:** the deterministic core — normalizers, dedupe, filters, import
  validation, the ingestion runner's orchestration (with a stubbed `fetch`).
- ❌ **Not unit-tested:** React components, server actions, and DB/RLS behavior —
  those depend on a live Supabase and are covered by the **manual walkthrough**
  above plus `npm run typecheck` and `npm run build`. (The multi-user/RLS check in
  A.9 is the manual stand-in for DB-level tests.)

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
