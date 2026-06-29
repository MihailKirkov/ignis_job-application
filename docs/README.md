# Job Command Center — documentation

A personal **job-discovery inbox + application tracker**. Every morning it ingests
roles from public job APIs and ATS boards, scores each one against your profile +
CV with AI, and ranks your inbox best-fit-first — then you save/dismiss/promote and
work the pipeline on a drag-and-drop board. Built on **Next.js 16** (App Router) +
**Supabase** (Postgres / Auth / RLS), deployed on Vercel with a daily cron.

This folder is the system's documentation. Start here, then follow the links. The
root [`../CLAUDE.md`](../CLAUDE.md) is the one-screen orientation file (what the app
is, the conventions table, the green gate); these docs go deep on each subsystem.

> **The code is the source of truth.** These docs are reconciled to the repo. If a
> doc ever disagrees with the code, the code wins — fix the doc.

---

## Map of the docs

| Doc | What it covers |
| --- | -------------- |
| [`setup.md`](./setup.md) | Get it running locally + on Vercel — every env var, the full migration list, auth config, deploy, and cron. **Start here.** |
| [`code-structure.md`](./code-structure.md) | What lives where and why — the layers (`sources` → `discovery` → `ai` → `actions` → routes/components), the Supabase clients, and how a request flows. |
| [`database.md`](./database.md) | Every table, column, RLS policy, index, and trigger, with an ER diagram. Fourteen tables, all owner-scoped. |
| [`ai-scoring.md`](./ai-scoring.md) | The AI fit-scoring pipeline end to end — pure prompt/parse, batching + prompt caching, the per-user encrypted key, `scoring_runs` + the chunk loop, cron auto-scoring, and inbox ranking. |
| [`logging.md`](./logging.md) | The two-layer log model — `activity_events` (the unified human feed) vs `ingestion_runs`/`ingestion_run_sources` (operational), how they bridge, and the `/activity` page. |
| [`design-system.md`](./design-system.md) | The HUD visual language — design tokens, `HudFrame`, the dial/meter/readout components, the command bridge, board vs console, and the rules for building new UI. |
| [`testing.md`](./testing.md) | The Vitest suite (19 files, 227 tests) + a full manual walkthrough of every page. |
| [`cowork-import.md`](./cowork-import.md) | The on-demand `/api/import` recipe for sources without an official API (Claude Cowork → Paste import). |
| [`wireframes.md`](./wireframes.md) | **Deprecated** — predates the HUD redesign. Superseded by [`design-system.md`](./design-system.md). |

---

## The 60-second model

- **Two surfaces:** a **discovery inbox** (`/discovery`) and an **application
  tracker** (`/tracker`), plus a **command bridge** homepage (`/needs-action`).
- **A pure brain:** normalizing each source into one `NormalizedJob`, deduping,
  filtering, and the AI prompt/parse logic are **pure functions** in `src/lib`
  (`sources/`, `discovery/`, `ai/`), unit-tested with no network or DB.
- **Stateful work through Supabase:** Server Components **read**; Server Actions
  (UI) and Route Handlers (APIs / cron) **write**; a root `proxy.ts` refreshes the
  session and gates protected routes.
- **RLS-first security:** every row is `user_id`-scoped and every table has
  owner-only policies, so the browser key can only ever touch your own data. The
  cron is the one exception (no session → service-role client, server-only).
- **AI fit-scoring:** Claude Haiku 4.5 via the Anthropic SDK (server-only), with a
  per-user encrypted API key, batched + prompt-cached calls, and async resumable
  runs tracked in `scoring_runs`.

## The green gate

Before any change is "done":

```bash
npm run typecheck && npm run lint && npm test && npm run build
```
