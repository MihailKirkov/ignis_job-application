# Database

Postgres on Supabase. Four application tables, all owned by a Supabase Auth user
and protected by Row-Level Security. The single source of truth is the migration
`supabase/migrations/0001_init.sql`; the TypeScript mirror is
`src/types/database.ts`. This doc explains the shape and the *why*.

---

## ER diagram

```mermaid
erDiagram
    USERS ||--o{ APPLICATIONS  : owns
    USERS ||--o{ JOBS          : owns
    USERS ||--o{ SOURCES       : owns
    USERS ||--o{ SAVED_FILTERS : owns
    JOBS  ||--o{ APPLICATIONS  : "promoted into"

    USERS {
        uuid id PK "auth.users (managed by Supabase Auth)"
        text email
    }

    JOBS {
        uuid    id PK
        uuid    user_id FK "-> auth.users.id, on delete cascade"
        text    source "adzuna | arbeitnow | ... | import"
        text    external_id "source-native id"
        text    title
        text    company
        text    location
        text    mode "On-site | Hybrid | Remote | null"
        numeric salary_min
        numeric salary_max
        text    currency
        text    url
        text    description
        timestamptz posted_at
        jsonb   raw "untouched source payload"
        text    fuzzy_key "normalized company+title+location"
        text    state "new | saved | dismissed | promoted"
        timestamptz ingested_at
        timestamptz created_at
        timestamptz updated_at
    }

    APPLICATIONS {
        uuid id PK
        uuid user_id FK "-> auth.users.id, on delete cascade"
        uuid job_id FK "-> jobs.id, nullable, on delete set null"
        text company
        text role
        text location
        text mode "On-site | Hybrid | Remote"
        text channel "Detachering | Brainport portal | LinkedIn | ..."
        text status "To apply | Applied | Screening | Interview | Offer | Rejected | Closed"
        text salary "free text, e.g. EUR 60-70k"
        text link
        text contact
        date date_applied
        text next_action
        date next_action_date
        text notes
        timestamptz created_at
        timestamptz updated_at
    }

    SOURCES {
        uuid id PK
        uuid user_id FK "-> auth.users.id, on delete cascade"
        text type "adzuna | greenhouse | lever | ..."
        jsonb config "query/where/token/etc."
        boolean enabled
        timestamptz last_run_at
        timestamptz created_at
        timestamptz updated_at
    }

    SAVED_FILTERS {
        uuid id PK
        uuid user_id FK "-> auth.users.id, on delete cascade"
        text name
        jsonb criteria "serialized FilterCriteria params"
        timestamptz created_at
        timestamptz updated_at
    }
```

> `USERS` is Supabase's built-in `auth.users` table — we don't define it, we only
> reference it. Every app table carries a `user_id` FK to it with
> `on delete cascade`, so deleting an account removes all of its data.

---

## Relationships & lifecycle

- **Ownership (4×):** `applications`, `jobs`, `sources`, `saved_filters` each
  belong to exactly one user via `user_id`. This is what RLS keys on.
- **Promotion (`jobs` → `applications`):** `applications.job_id` is a **nullable**
  FK to `jobs.id`. When you *Promote* a discovered job, a new application row is
  created with `job_id` set and the job's `state` flipped to `promoted`. Manually
  created applications have `job_id = null`. There's intentionally **no unique**
  constraint on `job_id` (you could promote the same posting twice), and the FK is
  `on delete set null` so deleting a job won't delete the application you built
  from it — it just unlinks.

---

## Tables in detail

### `jobs` — the discovery inbox

Ingested postings, normalized into one shape. Created **before** `applications`
in the migration because `applications.job_id` references it.

- **Hard dedupe:** `UNIQUE (user_id, source, external_id)`. This is the conflict
  target for the idempotent upsert in `src/lib/discovery/ingest.ts` — re-ingesting
  the same posting updates content instead of duplicating.
- **Fuzzy dedupe:** `fuzzy_key` (normalized `company + title + location`) lets the
  app collapse the same role arriving from different sources. Computed in app code,
  stored for querying.
- **`state`** (`new | saved | dismissed | promoted`, check-constrained) is the
  per-user workflow state. The upsert deliberately **omits** `state` and
  `ingested_at`, so a refresh never resets your decisions or the original sighting
  time.
- **`raw jsonb`** keeps the untouched source payload for debugging / future
  re-normalization.
- Indexes: `(user_id, state)`, `(user_id, fuzzy_key)`, `(user_id, posted_at desc)`
  — matching the inbox's tab counts, dedupe lookups, and default sort.

### `applications` — the pipeline

Your real applications. Mostly free-text for flexibility, with check constraints on
the controlled vocabularies:

- `mode ∈ {On-site, Hybrid, Remote}` (or null)
- `channel ∈ {Detachering, Brainport portal, LinkedIn, Recruiter, Direct, Referral, Other}` (or null)
- `status ∈ {To apply, Applied, Screening, Interview, Offer, Rejected, Closed}`,
  default `'To apply'`
- `salary` is **text** (e.g. "€60–70k") — human shorthand, unlike the numeric
  `jobs.salary_min/max`.
- Indexes: `(user_id, status)` for the stat counts/filter, `(user_id, next_action_date)`
  for the Needs-action queue and the next-action-first sort, `(job_id)` for the link.

### `sources` — per-user ingestion config

One row per enabled feed/board. `type` selects the fetcher; `config jsonb` holds its
parameters (Adzuna `query/where/...`, or an ATS `{ token, name }`). `enabled` gates
whether ingestion runs it; `last_run_at` is stamped after each run (manual or cron).
Index: `(user_id, enabled)`.

### `saved_filters` — discovery presets

`criteria jsonb` stores the **serialized filter params** (the output of
`criteriaToParams` in `src/lib/discovery/filter-params.ts`), so applying a preset is
just pushing those keys onto the discovery URL. Index: `(user_id)`.

---

## Row-Level Security

RLS is **enabled on all four tables**, and each has four owner-only policies
(select / insert / update / delete) of the form:

```sql
-- read
using (auth.uid() = user_id)
-- write (insert)
with check (auth.uid() = user_id)
-- update
using (auth.uid() = user_id) with check (auth.uid() = user_id)
```

Consequences worth remembering:

- The **anon/publishable key is safe in the browser** — a user can only ever touch
  rows where `user_id = auth.uid()`. This is the whole security model.
- App code never filters by `user_id` for safety reasons (RLS does it), but inserts
  must still set `user_id = auth.uid()` to satisfy the `with check`. Server actions
  do this explicitly.
- The **cron route is the one exception:** there is no session during a scheduled
  run, so it uses the **service-role** client (`src/lib/supabase/admin.ts`), which
  bypasses RLS. It is server-only and writes each job with an explicit `user_id`.
  Never expose that key to the browser.

---

## Triggers & defaults

- `set_updated_at()` is a trigger function attached `before update` to all four
  tables; it stamps `updated_at = now()` on every modification.
- UUIDs default to `gen_random_uuid()` (pgcrypto, enabled in the migration).
- `created_at` / `ingested_at` default to `now()`.

---

## Changing the schema

1. Add a new migration file under `supabase/migrations/` (don't edit `0001_init.sql`
   after it's been applied to a real project).
2. Mirror the change in `src/types/database.ts` — keep using **`type` aliases, not
   `interface`s** (supabase-js's table constraint requires the implicit index
   signature that object-literal types have and interfaces don't; see the note at
   the top of that file).
3. If you add a table, enable RLS and add the four owner-only policies — an
   RLS-less table is readable by anyone with the anon key.
4. Run the green gate (`npm run typecheck && npm run lint && npm test && npm run build`).
