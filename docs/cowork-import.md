# Cowork on-demand import recipe

For sources with **no official API**, or to **enrich** a posting (pull stack /
salary / seniority out of a job description), use this **user-initiated** recipe
in Claude Cowork. Cowork reads a page you point it at and emits JSON matching the
import schema, which you load via the app's **Paste import** box (Discovery →
*Paste import*) or by POSTing to `/api/import`.

## Hard boundary (non-negotiable)

- ✅ Public pages you have the right to read; respect each site's Terms of Service
  and `robots.txt`; one page at a time, on demand.
- ❌ **No** headless scrapers that bypass auth, anti-bot, rate limits, or CAPTCHAs.
- ❌ **No** LinkedIn or Indeed scraping.
- Prefer the official APIs and public ATS endpoints the app already supports
  (Adzuna, Arbeitnow, Remotive, RemoteOK, Greenhouse, Lever, Ashby, Workable).
  Use this recipe only for the gaps.

## Import schema (per job)

Only `title` is required; everything else is optional. Unknown `external_id` is
derived from the content so re-imports are idempotent.

| field         | type                                   | notes                                  |
| ------------- | -------------------------------------- | -------------------------------------- |
| `title`       | string (required)                      | role title                             |
| `company`     | string                                 |                                        |
| `location`    | string                                 | e.g. `"Eindhoven, NL"`                 |
| `mode`        | `"On-site" \| "Hybrid" \| "Remote"`    | invalid values dropped to null         |
| `salary_min`  | number                                 | major units, e.g. `60000`              |
| `salary_max`  | number                                 |                                        |
| `currency`    | string                                 | `"EUR" \| "USD" \| "GBP"`              |
| `url`         | string                                 | link to the original posting           |
| `description` | string                                 | plain text                             |
| `posted_at`   | string \| number                       | ISO date or unix epoch                 |
| `source`      | string                                 | defaults to `"import"`                 |
| `external_id` | string                                 | optional; auto-derived if omitted      |

## Prompt template for Cowork

> Read this job posting: `<PASTE URL>`. It is a public page and I have the right
> to view it. Extract the role into a JSON array with exactly these keys:
> `title, company, location, mode, salary_min, salary_max, currency, url,
> description, posted_at`. Use `null` for anything not stated. `mode` must be one
> of "On-site", "Hybrid", "Remote". `description` should be plain text (no HTML).
> Output **only** the JSON array, nothing else. Do not invent values.

For a listing page, ask it to return one object per posting in the array.

## Loading the result

**Easiest (recommended):** copy Cowork's JSON → in the app go to **Discovery →
Paste import** → paste → **Import**. This uses your logged-in session and RLS, so
no secrets leave your machine.

**Direct POST** (if you prefer): `/api/import` is session-protected. Copy your
auth cookie from the browser devtools and:

```bash
curl -X POST https://<your-app>.vercel.app/api/import \
  -H "Content-Type: application/json" \
  -H "Cookie: <your-supabase-auth-cookie>" \
  -d '[{ "title": "Senior Engineer", "company": "ASML", "url": "https://…" }]'
```

Response: `{ "ok": true, "imported": N, "skipped": M, "errors": [...] }`.
Imported jobs land in Discovery under the **New** tab, deduped against existing rows.

## Optional: expose ingestion as an MCP server

The same `/api/import` contract can be driven from inside Claude/Cowork via a thin
MCP server (an Adzuna MCP server exists as a reference implementation). A tool
`import_jobs(jobs: NormalizedJob[])` would simply POST to `/api/import` with the
user's credentials. Not included here to keep the deploy free-tier and dependency-
light, but the endpoint is MCP-ready.
