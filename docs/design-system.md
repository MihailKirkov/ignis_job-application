# Design system — the Command Center HUD

The UI speaks one visual language: a dark **"command-center" HUD**. The data stays
clean and high-contrast; the HUD feel comes from a small, recurring vocabulary —
cyan system chrome, glowing hairlines, chamfered corners, bracketed frames — applied
to **structure, never to body text**. This doc is the rulebook for building new UI
that fits.

> This supersedes the old [`wireframes.md`](./wireframes.md), which predates the HUD
> redesign and is kept only as a stale reference.

---

## Colour discipline (the one rule that matters)

Tokens live in `src/app/globals.css` under Tailwind v4's `@theme` (there is **no**
`tailwind.config.js`). Tailwind reads `--color-*` and generates utilities
(`bg-bg`, `text-system`, `border-system/20`, …). Three accents, each with a job:

| Token | Colour | Reserved for |
| ----- | ------ | ------------ |
| `--color-system` | cyan `#22d3ee` | **HUD chrome** — borders, dividers, gauges, active states, focus rings. The default structural accent. |
| `--color-highlight` | magenta `#ff2e88` | sparing secondary emphasis. |
| `--color-accent` | amber `#f5b544` | **RESERVED**: the primary action **and** the "needs action" signal — nothing else. |

Pipeline status colours map 1:1 to the kanban/badges:
`status-grey` (To apply / Closed), `status-applied` (cyan), `status-screening`
(violet), `status-interview` (amber), `status-offer` (green), `status-rejected`
(red). `STATUS_COLOR` / `FIT_VERDICT_COLOR` in `src/lib/constants.ts` map enums →
token names; components take a `colorToken` string and build
`var(--color-${token})`.

**Glow** is `--glow-*` box-shadow tokens (e.g. `shadow-[var(--glow-system)]`) — only
on borders / dividers / gauges / active states, **never** on body text.

Other base facts (all in `globals.css`): the canvas is `#060a12` with a static faint
cyan grid; fonts are **Inter** (`--font-sans`) + **JetBrains Mono** (`--font-mono`,
used for all numeric data with `tabular-nums`); focus-visible is a 2px cyan outline,
sharp (no radius); scrollbars + selection are cyan-tinted.

---

## `HudFrame` — the one panel primitive

**Nothing else in the app draws panel borders.** `src/components/hud-frame.tsx`
(`'use client'`) renders a single absolutely-positioned SVG, sized to its container
via `ResizeObserver`, so the 1px cyan strokes stay crisp and the 45° chamfer cuts
stay true at any size. The corner **brackets** are integral segments of the frame
geometry (short strokes with deliberate gaps); the background is clipped to the same
chamfer with CSS `clip-path` so corners read as cut, not rounded.

Key props:

| Prop | Meaning |
| ---- | ------- |
| `chamfer` | which corners are cut (`['tl']` default; `['tl','br']` is the common "card" look). |
| `accentCorner` / `accentTone` | the corner that gets the brighter accent stroke + optional node, and its colour token. |
| `tone` | the frame stroke colour token (default `system`). |
| `node` / `nodePulse` | draw a connector LED on the accent corner (pulsing for alerts). |
| `label` / `right` | optional header: a `hud-hatch` glyph + mono `hud-label` on the left, `right` content on the right, a cyan hairline under it. |
| `flush` / `bodyClassName` | drop the default `p-3.5` body padding / restyle the body. |
| `glow` | toggle the drop-shadow on the bracket strokes (default on). |

```tsx
<HudFrame label="RESPONSE RATE" chamfer={['tl', 'br']} accentCorner="tl" node>
  …
</HudFrame>
```

---

## The HUD component kit (`src/components/hud.tsx`)

Server-safe presentation (no hooks) built on `HudFrame`. Re-exports `HudFrame` +
`Corner`. Use these instead of rolling your own:

- **`SectionLabel`** — the mono uppercase micro-label (`hud-label`: 10px, 0.18em
  tracking). The standard caption for any section/panel.
- **`StatusLed`** — a glowing dot; `colorToken`, `alert` (pulses), `size`. Used for
  feed dots, lane nodes, the brand mark.
- **`TickBar`** — a segmented baseline scale (`total`/`lit`); the lit segments glow.
- **`StatReadout`** — a bracketed metric tile: mono value, label, `TickBar`, and the
  status LED sitting **on** the frame's chamfer node. `active` brightens it; `index`
  adds a mono corner tag (`V1`…); `ledAlert` pulses. This is the vitals tile.
- **`RadialMeter`** — a ticked ring dial (270° sweep): dim tick ring, lit ticks +
  active arc for the value, mono % in the centre. No dependencies, pure SVG. Used for
  the response-rate gauge.
- **`LogFeed`** — the telemetry list: `time · LED · text` rows in mono. Takes
  `LogEntry[]` (`{ time, text, colorToken }`). Shared by the `/needs-action`
  TELEMETRY strip and any feed.

### General primitives (`src/components/ui.tsx`)

Lower-level, server-safe, token-styled: `Card`/`CardHeader`/`CardBody`, `Button`
(variants `primary`/`secondary`/`ghost`/`danger` — **`primary` is the amber
`hud-cut` chamfered button**, the others sharp-square), `Badge` (`colorToken`-driven
pill with a dot), form fields `Label`/`Input`/`Textarea`/`Select` (all on the
`hud-field` class — dark fill, sharp corners, cyan focus glow, mono text;
`Select` adds a cyan caret), `EmptyState`, and `Stat`.

### CSS utilities (`globals.css`, `@layer components`)

Reusable classes the components lean on: `hud-rule` (cyan hairline divider),
`hud-label`, `hud-hatch` (diagonal-hatch accent block), `hud-tick`/`hud-tick-on`,
`hud-field`/`hud-select`, and `hud-cut` (the 45° chamfered clip for buttons). The
`hud-pulse` animation and the `hud-skeleton` shimmer both **degrade to static under
`prefers-reduced-motion`** (a global rule kills all animation/transition).

---

## Composed surfaces

### The command bridge (`needs-action-view.tsx`)

`CommandBridge` is the presentational hero rendered by both the real `/needs-action`
page and the public `/demo` (so they stay pixel-identical; `readOnly` disables
mutations). Its anatomy, all in `HudFrame`s:

- **Command bar** — title + a `CountdownTimer` (T-MINUS to the mission deadline) +
  the milestone date. The deadline is configurable in `src/lib/constants.ts`
  (`MISSION` → `targetDate`, `milestone`).
- **Vitals** — a `ConnectorRail` wiring four `StatReadout`s (Active / Applied /
  Interview / Offer) to a `RadialMeter` RESPONSE RATE gauge.
- **Priority alerts** — overdue + due-today follow-ups as `AppCard`s.
- **Telemetry** — a `LogFeed` of recent `activity_events` (see [logging](./logging.md)).

### Tracker: board vs console

`/tracker` has two views, toggled by `TrackerViewToggle` (reflected in the URL
`?view=` so the **server** renders the chosen one; `q`/`status` are preserved):

- **Board** (`tracker-board.tsx`, `'use client'`) — a **@dnd-kit** kanban.
  `ACTIVE_LANES` (To apply → Offer) are a horizontal scroller of ~300px lanes;
  `ARCHIVE_LANES` (Rejected / Closed) are compact always-visible drop zones below, so
  the whole lifecycle is drag-reachable. Lanes are droppables (`id = status`);
  `board-card.tsx` cards are draggables (a grip handle carries the
  pointer/touch/keyboard listeners). A cross-column drop **optimistically** moves the
  card (a `pending` override that stays authoritative until fresh server data shows
  the move — no flicker) and calls `setStatus`, which emits the `status_changed`
  event + revalidates; on error it reverts and toasts. Empty active lanes collapse to
  a thin rail and re-expand on drag. `DragOverlay` previews the dragged card;
  reduced-motion kills the drop animation. Status filter applies in **console only**
  (the board needs every lane populated).
- **Console** (`tracker-console.tsx`) — a dense, sortable table view.

### Streaming + skeletons

Route segments stream: the shell paints immediately, slow data (the discovery list,
the activity feed) is wrapped in `<Suspense>` with a HUD skeleton, and **every**
`(app)` segment ships a `loading.tsx` (route skeleton) + `error.tsx` (the shared
retry-able `HudError` boundary). Skeleton primitives live in
`components/hud-skeleton.tsx` (`Skeleton`, `SkeletonPanel`); the `hud-skeleton`
shimmer is disabled under reduced-motion. Mutations elsewhere are optimistic via
`useOptimistic`/`useTransition` (source toggle, job state, clear-action).

---

## Rules for new UI

1. **Frame with `HudFrame`.** Don't add CSS borders for panels/cards.
2. **Pick a `colorToken`, don't hard-code hex.** Reach for the status/system tokens;
   build `var(--color-${token})`.
3. **Amber is sacred.** Use `--color-accent` only for the primary action or a
   "needs action" signal. Everything structural is cyan (`system`).
4. **Glow on chrome, never on text.** Body copy stays flat and high-contrast.
5. **Mono + `tabular-nums` for data** (dates, counts, salaries, scores).
6. **Reuse the kit** (`hud.tsx` / `ui.tsx`) before writing new markup; extend it if
   genuinely missing a primitive.
7. **Respect reduced-motion** — animations must degrade (the global rule handles
   most; don't reintroduce motion that ignores it).
8. **Server-safe by default.** Keep components hookless unless they need
   interactivity; isolate `'use client'` to the smallest widget.
