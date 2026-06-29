# Logging: the activity feed + ingestion log

The app keeps **two** logs with different jobs, bridged so the human view stays
unified while the operational data stays queryable.

| Layer | Tables | Purpose | Who reads it |
| ----- | ------ | ------- | ------------ |
| **Activity** | `activity_events` | One append-only row per **user-meaningful** action, with a precomputed human `summary`. | The `/needs-action` TELEMETRY strip + the full `/activity` feed. |
| **Ingestion** | `ingestion_runs` + `ingestion_run_sources` | Structured **operational** metrics per ingestion run, with a per-source fetched/new/updated breakdown. | The `/activity` ingestion-row expander (and any future ops view). |

The bridge: every ingestion run writes the structured rows **and** emits exactly one
`ingestion.completed` activity event that references the run, so it shows up in the
unified feed and can deep-link to its breakdown.

Related: [`database.md`](./database.md) (table shapes + RLS),
[`code-structure.md`](./code-structure.md) (where the modules live).

---

## Layer 1 — `activity_events` (the unified feed)

`src/lib/activity/` holds the logic:

| File | Side | Responsibility |
| ---- | ---- | -------------- |
| `summary.ts` | pure | `categoryFromType` (category from the type prefix) + `buildActivitySummary(type, meta)` — the denormalized human line. Robust to missing meta; **never throws**. Unit-tested in `tests/activity-summary.test.ts`. |
| `feed.ts` | pure | `activityHref(event)` — where a feed line links (application→`/tracker`, job→`/discovery`, profile→`/profile`, source→`/sources`, contact→`/contacts`, company/outreach→`/contacts?company=<id>`, ingestion→`/activity?run=<id>`). |
| `log.ts` | DB glue | `logActivity(supabase, userId, input)` — **the single emission point**. |
| `record-run.ts` | DB glue | `recordIngestionRun(...)` — writes the ingestion rows + emits the bridging event (see Layer 2). |

### One emission point

`logActivity` is the **only** place an `activity_events` row is created. It derives
`category` from the `type` prefix, builds the `summary` from `meta` (unless one is
passed), and inserts. It is **best-effort**: a logging failure is swallowed so it can
never break the mutation it accompanies — the feed is a side-channel, never
load-bearing.

```ts
await logActivity(supabase, user.id, {
  type: 'application.status_changed',
  entityType: 'application',
  entityId: app.id,
  meta: { company, from, to },
});
```

**Rule:** every mutating Server Action emits **exactly one** event. They're wired in
`actions/applications.ts`, `jobs.ts`, `sources.ts`, `profile.ts`, `companies.ts`,
`contacts.ts`, and `outreach.ts`. When you add a new mutation, add its `logActivity`
call (and, if it's a genuinely new kind of event, extend the vocabulary below +
`buildActivitySummary`).

> **Silent "clear" actions.** `clearNextAction` (applications), `clearFollowUp`
> (contacts), and `clearBump` (outreach) resolve a due item from the Needs-action
> queue **without** emitting an event — they're side-channel queue dismissals, the
> same exception the original `clearNextAction` already made.

> **Auto-create-or-link is silent.** When `createContact` auto-creates a company by
> name, that company insert does **not** emit its own `company.created` event — the
> contact action emits the single `contact.created` event, preserving the
> one-event-per-mutation rule. Companies created from the `/contacts` UI directly do
> emit `company.created`.

> **Message templates are settings, not activity.** `actions/templates.ts`
> (`saveTemplate`/`deleteTemplate`) emits **no** event at all — there is no
> `template.*` vocabulary. Templates are reusable boilerplate the user manages on
> /profile (like the CV or the API key), not timeline-worthy work, so they stay out
> of the feed entirely. `draftMessage` likewise reads only (it composes a draft);
> the event is emitted later, when the user actually logs the resulting outreach.

### The event vocabulary

Types live in `src/types/database.ts` (`ActivityType`) and `src/lib/constants.ts`
(`ACTIVITY_TYPES`). The category is always the prefix:

| Category | Types |
| -------- | ----- |
| `application` | `application.created`, `application.status_changed`, `application.deleted` |
| `job` | `job.promoted`, `job.saved`, `job.dismissed` |
| `profile` | `profile.updated` |
| `source` | `source.added`, `source.removed`, `source.toggled` |
| `ingestion` | `ingestion.completed` |
| `company` | `company.created`, `company.updated`, `company.deleted` |
| `contact` | `contact.created`, `contact.updated`, `contact.deleted` |
| `outreach` | `outreach.logged`, `outreach.status_changed` |

`buildActivitySummary` turns `(type, meta)` into the stored line — e.g.
`application.status_changed` with `{ company, from, to }` → `"Acme: Applied →
Interview"`; `ingestion.completed` → `"Ingestion ok · 42 fetched · 7 new"`. Each
category has a colour token (`ACTIVITY_CATEGORY_COLOR`) and a 3-letter glyph
(`ACTIVITY_CATEGORY_ICON`, e.g. `APP`/`JOB`/`ING`) used by the telemetry LED and the
feed dots.

### Why a denormalized `summary`?

The line is computed **once at write time** and stored, so rendering the feed/strip
is a trivial read — no join, no per-row formatting, and the log survives even if the
referenced entity is later deleted (`entity_id` has **no FK** on purpose).

---

## Layer 2 — `ingestion_runs` / `ingestion_run_sources`

An ingestion run (manual-all, per-source, or cron) is the one operation rich enough
to deserve structured metrics. `executeIngestion` (`src/lib/discovery/ingest.ts`)
returns an `IngestionOutcome` — a run roll-up (`status` ok/partial/error,
`sourcesRun`, `fetched`, `new`, `updated`) plus a per-source breakdown
(`IngestionSourceOutcome[]`). The diff distinguishes **fetched vs new vs updated**:
`fetchExistingKeys` reads the natural keys already in the inbox, `diffJobs` splits
new from re-ingested **before** the idempotent upsert — so a re-ingested job is never
mislabelled as new.

`recordIngestionRun(supabase, userId, { trigger, startedAt, finishedAt, outcome })`
then:

1. inserts one `ingestion_runs` row (rolled-up counts + `duration_ms`),
2. inserts the `ingestion_run_sources` rows (per-source status, `http_status`,
   fetched/new/updated, duration, message),
3. emits the bridging `ingestion.completed` activity event with `meta.run_id` so the
   feed line deep-links to `/activity?run=<id>`.

### Secret redaction

Per-source `message` text (often a fetcher error containing a URL) is passed through
`redactSecrets` before storage: it drops any URL query string and redacts common
secret params (`app_key`, `api_key`, `token`, `secret`, …). **Secrets are never
persisted in a run message.**

### Where runs are recorded

- **Manual** — `runUserIngestion` in `actions/jobs.ts` (`manual_all` /
  `manual_source`), RLS-scoped to the signed-in user.
- **Cron** — `/api/cron/ingest` (`trigger: 'cron'`), using the **admin** client
  (no session), grouping enabled sources by owner and recording one run per user.

---

## The `/activity` page

`src/app/(app)/activity/page.tsx` is the full feed (see also the
[design system](./design-system.md) for the HUD shell it renders in):

- A **FILTER** bar (category + from/to date) submits via plain `method="get"` — it
  paints instantly because it has no data dependency.
- The **EVENT LOG** streams in a `<Suspense>` boundary (HUD skeleton fallback). It
  reads `activity_events` newest-first, paginated (`PAGE_SIZE = 25`), and links each
  line via `activityHref`.
- **Ingestion rows expand.** For the `ingestion.completed` events on the page, it
  pre-fetches their `ingestion_run_sources` and renders a `<details>` table
  (Source / Status / Fetched / New / Updated / Note) — **no client JS**, just native
  `<details>`. A direct link with `?run=<id>` lands you on that run.

The `/needs-action` **TELEMETRY** strip reads the same `activity_events` table (most
recent few) and renders them through the shared `LogFeed` component — the
"unified feed" promise: one table, two surfaces.
