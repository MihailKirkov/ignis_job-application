# Wireframes

> **⚠️ Deprecated — predates the HUD redesign.** This file describes an earlier
> layout and is no longer kept in sync with the code. For the current UI — the
> Command Center HUD language, `HudFrame`, the dial/readout components, and the
> board ⇄ console tracker — see **[`design-system.md`](./design-system.md)**. Kept
> only as historical reference.

The planned design of each page, as ASCII layouts. These mirror what the Server
Components actually render — use them as a map of the UI, and update them when a
page's structure changes.

Conventions used in the sketches:

- `[ Button ]` — a button. `[ Primary ]*` marks the amber **primary action**.
- `( input )` — text input. `( select ▾ )` — dropdown. `‹chip›` — a toggle chip.
- `‹‹badge››` — a pill/badge. `· · ·` — repeated rows of the same kind.
- Everything sits on the dark "command-center" palette; the single amber accent is
  reserved for the primary action and the "needs action" signal.

---

## Global shell (`(app)/layout.tsx`)

Every protected page renders inside this two-column shell. The left sidebar is the
fixed nav (desktop ≥768px); on mobile it collapses to a horizontal scroller at the
top. Content is capped at `max-w-6xl` and centered.

```
┌────────────────┬──────────────────────────────────────────────────────┐
│ JOB · CC       │                                                        │
│ Command Center │   <page content — max-w-6xl, scrolls independently>    │
│                │                                                        │
│ │ Needs action │‹3›                                                     │
│   Tracker      │                                                        │
│   Discovery    │                                                        │
│   Sources      │                                                        │
│                │                                                        │
│   · · ·        │                                                        │
│                │                                                        │
│ ──────────────│                                                        │
│ Sources & attr │                                                        │
│ you@email.com  │                                                        │
│ [ Sign out ]   │                                                        │
└────────────────┴──────────────────────────────────────────────────────┘
   240px sidebar         flexible main, overflow-y auto
```

- The active item shows an amber left-rail tick + brighter text.
- `Needs action` carries an amber count badge when the queue is non-empty (the
  count is fetched once in the layout).
- Footer block: legal link, signed-in email, sign-out (POST to `/auth/signout`).

**Mobile (<768px):** sidebar replaced by a top bar.

```
┌──────────────────────────────────────────────┐
│ │Needs action  Tracker  Discovery  Sources →  │   ← horizontal scroll
├──────────────────────────────────────────────┤
│  <page content>                              │
```

---

## Login (`/login`)

Public, centered card. Magic-link first, Google second. No nav shell.

```
                    JOB · CC
                 Command Center
        Sign in to your discovery inbox and pipeline.

        ┌──────────────────────────────────────┐
        │  Email                               │
        │  ( you@example.com               )   │
        │                                      │
        │  [        Send magic link        ]*  │
        │                                      │
        │  ───────────── or ─────────────      │
        │                                      │
        │  [      Continue with Google     ]   │
        └──────────────────────────────────────┘
        Google sign-in requires the provider …
```

After submit, the form swaps to a success panel: "Check you@example.com for a magic
link." Errors render in red beneath the Google button.

---

## Needs action (`/needs-action`) — the hero queue

The default landing page. Two grouped sections: **Overdue** (red heading) then
**Due today**. Each row is an `ApplicationCard` with its next-action strip
highlighted. Empty state when the queue is clear.

```
┌──────────────────────────────────────────────────────────────────┐
│ Needs action                                  [ + New application ]*│
│ 3 items due · 1 overdue                                            │
├──────────────────────────────────────────────────────────────────┤
│ OVERDUE                                                            │
│ ┌────────────────────────────────────────────────────────────┐    │
│ │ Senior Frontend Engineer ↗            ‹‹Interview››          │   │
│ │ ASML                                        €70–85k          │   │
│ │ Eindhoven · Hybrid · Recruiter                               │   │
│ │ ┌──────────────────────────────────────────────────────┐    │   │
│ │ │ Follow up with recruiter   12 Jun · overdue      [×] │     │   │  ← amber strip
│ │ └──────────────────────────────────────────────────────┘    │   │
│ │ applied 02 Jun                            [ Edit ] [ Delete ]│   │
│ └────────────────────────────────────────────────────────────┘    │
│                                                                    │
│ DUE TODAY                                                          │
│ ┌ · · · application cards · · · ┐                                 │
└──────────────────────────────────────────────────────────────────┘
```

Empty state:

```
            Queue is clear ✓
   No overdue or due-today follow-ups. New items appear
   here when an application's next-action date arrives.
```

---

## Tracker (`/tracker`) — the pipeline

Header with **Export JSON** + **New application**, a row of pipeline stat tiles, the
search/status toolbar, then the filtered list of `ApplicationCard`s. Search and
status live in the URL (`?q=&status=`) so the view is shareable.

```
┌──────────────────────────────────────────────────────────────────┐
│ Tracker                              [ Export JSON ]  [ + New ]*    │
│ Your application pipeline.                                         │
├──────────────────────────────────────────────────────────────────┤
│ ┌Total┐ ┌Active┐ ┌To apply┐ ┌Applied┐ ┌Screen.┐ ┌Interv┐ ┌Offer┐ …│  ← 8 stat tiles
│ │ 24  │ │ 11  │* │   3   │ │   8   │ │   2   │ │   4  │ │  1  │   │
│ └─────┘ └─────┘  └───────┘ └───────┘ └───────┘ └──────┘ └─────┘   │
│                                                                    │
│ ( 🔍 Search company, role, notes…    )   ( All statuses ▾ )        │
│                                                                    │
│ ┌ · · · ApplicationCard · · · ┐                                   │
│ ┌ · · · ApplicationCard · · · ┐                                   │
└──────────────────────────────────────────────────────────────────┘
```

- Stat tiles: Total, Active (amber accent), then one per status in
  `APPLICATION_STATUSES`. Grid reflows 2 → 4 → 8 columns by breakpoint.
- Cards are sorted by next-action date, then date applied.
- Empty state adapts: "No matching applications" when filtered, else "No
  applications yet."

### Application card (anatomy)

Used on both Needs-action and Tracker. The next-action strip only renders when the
row has a next action; it turns amber when overdue or when `highlightAction` is set.

```
┌──────────────────────────────────────────────────────────────┐
│ <Role>  ↗(link)                            ‹‹StatusBadge››     │
│ <Company>                                     <salary, mono>   │
│ <location> · <mode> · <channel>                               │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ <next action>      <date, mono>            [× clear]      │ │  ← strip (conditional)
│ └──────────────────────────────────────────────────────────┘ │
│ applied <date>                              [ Edit ] [ Delete ]│
└──────────────────────────────────────────────────────────────┘
```

### Application dialog (New / Edit modal)

Opened from any "New application" or card "Edit" button. Two-column field grid in a
centered modal.

```
        ┌─ New application ───────────────────────── × ┐
        │ ( Company * )            ( Role * )          │
        │ ( Location )             ( Mode ▾ )          │
        │ ( Channel ▾ )            ( Status ▾ )        │
        │ ( Salary )               ( Date applied 📅 ) │
        │ ( Next action )          ( Next action 📅 )  │
        │ ( Link )                 ( Contact )         │
        │ ( Notes …………………………………………………………………… )       │
        │                          [ Cancel ] [ Add ]* │
        └──────────────────────────────────────────────┘
```

Edit mode is identical, titled `<Company> — <Role>`, with a "Save changes" primary.

---

## Discovery (`/discovery`) — the inbox

Header with **Import (paste)** + **Refresh inbox**, then state tabs, a collapsible
filter panel, a preset bar, and the list of `JobCard`s. State, filters, and the
active preset all live in the URL.

```
┌──────────────────────────────────────────────────────────────────┐
│ Discovery                          [ Import ]  [ ↻ Refresh inbox ] │
│ Review, save, dismiss, or promote ingested jobs.                  │
├──────────────────────────────────────────────────────────────────┤
│ │ New ‹42›   Saved ‹7›   Dismissed ‹13›   Promoted ‹4›            │  ← tabs (state)
│                                                                    │
│ ┌ Filters ‹2›                                              ▼ ┐    │  ← collapsible
│ └────────────────────────────────────────────────────────────┘    │
│ Presets:  ‹Eindhoven React›  ‹Remote senior›   [ + Save ]         │
│                                                                    │
│ 12 of 42 jobs                                                      │
│ ┌ · · · JobCard · · · ┐                                           │
│ ┌ · · · JobCard · · · ┐                                           │
└──────────────────────────────────────────────────────────────────┘
```

- Tabs: New / Saved / Dismissed / Promoted, each with a live count.
- Count line shows "N of M jobs" when filters narrow the set.
- Empty state adapts to the active tab + whether filters are applied.

### Filter panel (expanded)

Collapsed to a single bar by default; the badge shows how many filters are active.
Expanded, it exposes the full `FilterCriteria`:

```
┌ Filters ‹2›                                                  ▲ ┐
│ Include keywords / stack          Exclude keywords             │
│ ( react, typescript )             ( php, wordpress )           │
│   match ( any ▾ )                                              │
│                                                                │
│ Location ( Anywhere ▾ )  Min salary ( 50000 )  Posted ( Any ▾)│
│                                                                │
│ Work mode   ‹On-site› ‹Hybrid› ‹Remote›                       │
│ Seniority   ‹intern›‹junior›‹medior›‹senior›‹lead›‹principal› │
│ Source      ‹Adzuna›‹Arbeitnow›‹Remotive›‹RemoteOK›‹Green…›   │
│                                                                │
│ ( Any language ▾ )                       [ Clear ] [ Apply ]* │
└────────────────────────────────────────────────────────────────┘
```

Chips toggle on/off (amber when selected). **Apply** writes the criteria to the URL;
**Clear** resets to just the active state.

### Job card (anatomy)

```
┌──────────────────────────────────────────────────────────────┐
│ <Title>  ↗(orig posting)                   ‹‹SOURCE››          │
│ <Company>                                     <salary, mono>   │
│ <location> · <mode>                                           │
│ <description, 2-line clamp>                                   │
│ posted <date>                  [ Save ] [ Dismiss ] [ Promote ]│
└──────────────────────────────────────────────────────────────┘
```

- Source badge is the provider label (Adzuna, Lever, …).
- "posted <date>" falls back to "seen <date>" (ingested) when no posted date.
- **Promote** creates the linked application and moves the job to the Promoted tab.
- **Import (paste)** opens a modal that accepts a Cowork recipe's JSON payload
  (`POST /api/import`).

---

## Sources (`/sources`) — ingestion config

Header with **Refresh inbox** + **Add source**, then a list of configured source
rows, and a footer note about env vars / terms.

```
┌──────────────────────────────────────────────────────────────────┐
│ Sources                            [ ↻ Refresh inbox ] [ + Add ]*  │
│ Job feeds and target-company ATS boards to ingest.                │
├──────────────────────────────────────────────────────────────────┤
│ ┌────────────────────────────────────────────────────────────┐    │
│ │ Adzuna                                    [ Disable ] [ × ] │    │
│ │ {"query":"react","where":"eindhoven","country":"nl"}       │    │  ← config JSON, mono
│ │ last run 11 Jun 14:02                                       │    │
│ └────────────────────────────────────────────────────────────┘    │
│ ┌────────────────────────────────────────────────────────────┐    │
│ │ Lever (company board)   ‹disabled›        [ Enable ]  [ × ] │    │
│ │ {"token":"netflix"}                                        │    │
│ │ never run                                                  │    │
│ └────────────────────────────────────────────────────────────┘    │
│ · · ·                                                              │
│                                                                    │
│ Adzuna needs ADZUNA_APP_ID / ADZUNA_APP_KEY in env. ATS tokens …  │
└──────────────────────────────────────────────────────────────────┘
```

- Each row: provider label (+ a `disabled` pill when off), the raw config JSON, the
  last-run timestamp ("never run" until first ingest), and toggle/delete controls.
- **Add source** opens a modal: pick a provider, fill the config hint for that
  provider (`SOURCE_META[type].configHint`), save.
- Empty state nudges adding Adzuna or a Greenhouse/Lever/Ashby/Workable token.

---

## Sources & attribution (`/legal`)

Public, narrow page linked from the sidebar footer. A back link, an intro, then a
list of every aggregated source with a link out and a one-line note.

```
┌──────────────────────────────────────────────┐
│ ← Back                                       │
│ Sources & attribution                        │
│ Job postings are aggregated from the official│
│ APIs and public job-board endpoints below…   │
│                                              │
│ ┌ Adzuna ↗ — Official jobs API.            ┐ │
│ ┌ Arbeitnow ↗ — Free public job-board API. ┐ │
│ ┌ Remotive ↗ — … data delayed 24h.         ┐ │
│ ┌ · · · one row per source · · ·           ┐ │
└──────────────────────────────────────────────┘
```

---

## State & empty-state summary

| Page         | Key states                                                        |
| ------------ | ----------------------------------------------------------------- |
| Needs action | Overdue / Due today groups · "Queue is clear ✓"                   |
| Tracker      | Filtered (q/status) vs. full · "No matching" vs. "No applications" |
| Discovery    | Per-tab (New/Saved/Dismissed/Promoted) · filtered vs. unfiltered  |
| Sources      | Configured list vs. "No sources yet" · per-row enabled/disabled   |
| Login        | idle / sending / sent / error                                     |

All list pages share the same `EmptyState` primitive (title + hint) and the same
card grid spacing, so the surfaces feel like one app.
