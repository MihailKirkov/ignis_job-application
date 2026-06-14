# Setup guide

Everything needed to get the Job Command Center running locally and on Vercel —
which keys to get, and exactly where each value goes.

> TL;DR: create a Supabase project → run the SQL migration → get an Adzuna key →
> copy `.env.example` to `.env.local` and fill it in → `npm install && npm run dev`.

---

## 0. Prerequisites

- **Node.js 20.9+** (Next 16 requires it) — check with `node -v`.
- **npm** (ships with Node).
- A **Supabase** account (free tier) — https://supabase.com
- An **Adzuna** developer account (free) — https://developer.adzuna.com
- For deployment: a **Vercel** account + this repo on GitHub.

Install dependencies once:

```bash
npm install
```

---

## 1. Create the Supabase project

1. Go to https://supabase.com → **New project**. Pick a name, a strong database
   password, and a region close to you. Wait for it to finish provisioning.
2. You now have a project. Everything below lives inside it.

---

## 2. Run the database migration

This creates the four tables, enables Row-Level Security on all of them, adds the
owner-only policies, the dedupe indexes, and the `updated_at` triggers.

**Option A — dashboard (simplest):**

1. In the Supabase dashboard, open **SQL Editor → New query**.
2. Open `supabase/migrations/0001_init.sql` from this repo, copy its **entire**
   contents, paste into the editor, and click **Run**.
3. You should see "Success. No rows returned." Verify under **Database → Tables**
   that `applications`, `jobs`, `sources`, and `saved_filters` exist, and under
   **Authentication → Policies** that each table shows owner-only policies.

**Option B — Supabase CLI:**

```bash
npm i -g supabase            # if you don't have it
supabase login
supabase link --project-ref <your-project-ref>   # ref is in the project URL
supabase db push                                  # applies supabase/migrations/*
```

---

## 3. Configure authentication

1. **Authentication → Providers → Email:** keep it **enabled**. Magic-link sign-in
   works out of the box — no SMTP setup needed for the built-in dev mailer
   (Supabase sends the link).
2. **(Optional) Google sign-in:** enable the **Google** provider and paste in a
   Google OAuth Client ID + secret (from the Google Cloud console). Skip this if
   you only want magic links.
3. **Authentication → URL Configuration:**
   - **Site URL:** `http://localhost:3000` for local dev (change to your Vercel
     domain in production, or set both — production Site URL + localhost as an
     additional redirect).
   - **Redirect URLs — add both:**
     - `http://localhost:3000/auth/callback`
     - `https://<your-app>.vercel.app/auth/callback` (after you know your domain)

### Recommended: cross-device magic links (token_hash)

This is the **default** the app is built around. Go to **Authentication → Email
Templates → Magic Link** and set the link to:

```
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=magiclink&next=/needs-action
```

The `/auth/confirm` route is already implemented — no code change needed. With
this template the magic link works **across browsers and devices** (request it on
your laptop, open it on your phone), which is what most people expect.

> Prefer not to touch the template? Leave it on Supabase's default
> `{{ .ConfirmationURL }}`. The app still works via the PKCE `code` flow through
> `/auth/callback` — but those links must be opened **in the same browser** that
> requested them. Google OAuth always uses this `code` flow.

---

## 4. Get the Supabase keys

**Project Settings → API.** Copy three values:

| Dashboard label                     | Goes into env var               | Exposure        |
| ----------------------------------- | ------------------------------- | --------------- |
| **Project URL**                     | `NEXT_PUBLIC_SUPABASE_URL`      | browser-safe    |
| **Publishable** / **anon public**   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser-safe    |
| **service_role** (secret)           | `SUPABASE_SERVICE_ROLE_KEY`     | **server-only** |

> The service-role key **bypasses RLS**. Never prefix it with `NEXT_PUBLIC`, never
> commit it, never use it in client code. It is only read by the cron route. If you
> don't plan to use the scheduled Cron yet, you can leave it blank — the manual
> "Refresh inbox" button works without it.

---

## 5. Get the Adzuna API key

1. Register at https://developer.adzuna.com → create an app.
2. You get an **App ID** and an **App Key**.

| Adzuna value | env var          |
| ------------ | ---------------- |
| App ID       | `ADZUNA_APP_ID`  |
| App Key      | `ADZUNA_APP_KEY` |

Adzuna's free tier is rate-limited; the app handles `429` by backing off. Without
these keys, every other source still works — only Adzuna sources error (visibly,
in the per-source result).

> **ATS company-board tokens are NOT keys and do NOT go in env.** You add them in
> the app UI (Sources → Add source), and they're stored per-user in the `sources`
> table. They're just the public board slugs, e.g. Greenhouse `stripe`, Lever
> `netflix`. See "Adding a source" in the README.

---

## 6. The CRON_SECRET

This guards the scheduled ingestion route so only Vercel Cron (or you) can trigger it. Generate any long random string:

```bash
node -e "console.log(crypto.randomUUID())"
```

Put it in `CRON_SECRET`. On Vercel, when this env var is set, Cron automatically
sends it as `Authorization: Bearer <CRON_SECRET>`; the route rejects anything else.

---

## 7. Create `.env.local`

Copy the template and fill in everything from steps 4–6:

```bash
cp .env.example .env.local
```

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...            # publishable / anon
SUPABASE_SERVICE_ROLE_KEY=eyJ...                # server-only; cron only
ADZUNA_APP_ID=xxxxxxxx
ADZUNA_APP_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
CRON_SECRET=your-long-random-string
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

`.env.local` is gitignored. **Important:** `NEXT_PUBLIC_*` values are baked into
the build, so if you change them you must restart `npm run dev` (or rebuild).

---

## 8. Run it

```bash
npm run dev          # http://localhost:3000
```

Open http://localhost:3000 — the public landing page. Hit **Sign in**, enter your
email, and click the magic link in the email. With the recommended token_hash
template (step 3) it opens on any device; you land on the **Needs action** page,
where a first-run checklist walks you through setup. First-time flow:

1. Go to **Sources** → **Add source** → pick **Adzuna**, adjust the example config
   (e.g. `query`, `where: "Eindhoven"`), **Add source**.
2. Click **Refresh inbox** → jobs appear under **Discovery → New**.

For a full functional walkthrough, see [`testing.md`](./testing.md).

---

## 9. Deploy to Vercel + enable Cron

1. Push the repo to GitHub and **Import** it in Vercel.
2. **Project → Settings → Environment Variables** — add **all** of the same vars
   from `.env.local`, including `SUPABASE_SERVICE_ROLE_KEY` and `CRON_SECRET`. Set
   `NEXT_PUBLIC_SITE_URL` to your real domain.
3. Back in Supabase (step 3), add the production redirect URL
   `https://<your-app>.vercel.app/auth/callback`.
4. Deploy. `vercel.json` already registers the daily cron:
   ```json
   { "crons": [{ "path": "/api/cron/ingest", "schedule": "0 6 * * *" }] }
   ```
5. Test the cron manually:
   ```bash
   curl -H "Authorization: Bearer $CRON_SECRET" https://<your-app>.vercel.app/api/cron/ingest
   ```
   Expect a JSON summary. Without the header you get `401` (that's correct).

---

## Where each value ends up — quick reference

| What                       | From                              | Into                            | Used by                          |
| -------------------------- | --------------------------------- | ------------------------------- | -------------------------------- |
| Project URL                | Supabase → Settings → API         | `NEXT_PUBLIC_SUPABASE_URL`      | all Supabase clients             |
| Anon/publishable key       | Supabase → Settings → API         | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser + server (RLS-scoped)    |
| Service-role key           | Supabase → Settings → API         | `SUPABASE_SERVICE_ROLE_KEY`     | cron route only (bypasses RLS)   |
| Adzuna App ID / Key        | developer.adzuna.com              | `ADZUNA_APP_ID` / `_KEY`        | Adzuna fetcher                   |
| Cron secret                | you generate it                   | `CRON_SECRET`                   | guards `/api/cron/ingest`        |
| Site URL                   | your domain                       | `NEXT_PUBLIC_SITE_URL`          | auth redirect building           |
| ATS board tokens           | the company's public board slug   | **app UI** (Sources), not env   | Greenhouse/Lever/Ashby/Workable  |

---

## Troubleshooting

- **"Your project's URL and Key are required to create a Supabase client!"** — the
  `NEXT_PUBLIC_SUPABASE_*` vars weren't present at build time. Stop the dev server,
  confirm they're in `.env.local`, and restart `npm run dev`.
- **Magic link says "invalid"** — if you're on the default Supabase template
  (PKCE), open the link in the **same browser** you requested it from; or switch
  to the recommended cross-device token_hash template (step 3).
- **Redirected to `/login` in a loop after clicking the link** — your
  `/auth/callback` URL isn't in the Supabase **Redirect URLs** list (step 3).
- **Adzuna source shows an error in the refresh summary** — missing/!invalid
  `ADZUNA_APP_ID` / `ADZUNA_APP_KEY`, or you hit the rate limit (try again later).
- **Cron returns 401** — missing/incorrect `CRON_SECRET`, or you didn't send the
  `Authorization: Bearer …` header.
- **Cron returns "requires … SUPABASE_SERVICE_ROLE_KEY"** — set that env var; the
  scheduled run needs it (the manual "Refresh inbox" button does not).
