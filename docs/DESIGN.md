# NKOYI — Design system

The interface is an analyst's workstation: dense, quiet, and explicit about
what each figure is. This document is the reference for anyone adding to it.

## Principles

1. **The data is the figure.** Surfaces are graphite; colour is spent on status
   and on the map's incidents, not on chrome.
2. **Status is never colour alone.** Every state has its own shape and a written
   label. Colour reinforces.
3. **Say what a number is.** Confidence, attention scores and counts carry a
   tooltip or a breakdown. A comparison with no baseline says so; it does not
   print 0 %.
4. **Failures are visible.** A feed that is down shows as down. A missing
   basemap gets a banner. An empty chart is an empty state, not a flat line.
5. **Four voices, kept apart.** What sources said, what the engine computed,
   what an analyst decided, and what a model would add are separate sections
   with separate headings.

## Tokens

Defined in `tailwind.config.ts` and mirrored as CSS variables in
`src/app/globals.css`. Map paint expressions use the same hex values via
`C` in `src/lib/layers.ts`.

| Token | Hex | Use | Contrast on `b1` |
|---|---|---|---|
| `b0` | `#0b0d10` | canvas | — |
| `b1` | `#101318` | surface, panels | — |
| `b2` | `#161a21` | raised, hover, selected | — |
| `b3` | `#242a34` | borders, separators | — |
| `t1` | `#e6e9ee` | primary text | 15.3 : 1 |
| `t2` | `#9aa3b0` | secondary text | 7.3 : 1 |
| `t3` | `#7f8896` | labels, metadata | 5.2 : 1 |
| `grn` | `#3fb984` | confirmed, healthy | 7.5 : 1 |
| `amb` | `#e2a336` | disputed, degraded, brand accent | 8.4 : 1 |
| `alert` | `#e5484d` | conflict, error | 4.8 : 1 |
| `blu` | `#6f9bff` | focus, links, corroborated | 6.9 : 1 |
| `cyn` | `#58c4dc` | humanitarian | — |
| `pur` | `#9d8cff` | political, clusters | — |

All text tokens meet WCAG 2.2 AA (4.5 : 1) on `b1` and `b2`.

## Typography

- **Interface text:** Inter (`font-sans`, the default).
- **Data:** IBM Plex Mono (`font-data`) — coordinates, timestamps, counts,
  identifiers; anything whose characters must align. Pair with `tabular-nums`.
- **Scale** (rem, so the text-size setting scales everything):
  `3xs` 10 px · `2xs` 11 px · `xs` 12 px · `sm` 13 px · `base` 16 px.
  Nothing renders below 10 px at the default size.
- **Section labels:** `text-3xs font-semibold uppercase tracking-[0.09em] text-t3`.

## Layout

- Navigation rail: 216 px, collapsing to 52 px. Application bar: 48 px.
- Workspace header: title (16 px semibold) and a one-line hint, then filters.
- Cards: `bg-b1 border border-b3 rounded`, 12 px padding. Radius is 3 px;
  nothing is pill-shaped except status dots.
- Record panel: 30–34 rem, to the right of what it describes.

## Components

| Component | File | Notes |
|---|---|---|
| `StatusBadge`, `StatusGlyph` | `components/ui/kit.tsx` | shape + label + colour; tooltip explains the state |
| `CategoryTag` | `kit.tsx` | conflict ▲ · humanitarian ✚ · political ■ |
| `OriginTag` | `kit.tsx` | marks simulated material wherever a source is shown |
| `ConfidenceMeter` | `kit.tsx` | five segments + percentage + band in words |
| `WorkspaceHeader`, `Card`, `EmptyState`, `Skeleton`, `SegButton`, `Fact` | `kit.tsx` | page scaffolding |
| `ChartCard`, `TrendChart`, `BarList`, `DataTable`, `Spark` | `components/ui/charts.tsx` | every chart has a table toggle |
| `Icon` | `components/ui/Icon.tsx` | 16-unit grid, 1.25 stroke, decorative |
| `NavRail`, `AppBar` | `components/layout/` | shell |
| `IntelFeed`, `IntelDetail` | `components/intel/` | windowed feed; event record |

## Accessibility

- Skip link, landmark roles, `aria-current` on navigation, focus moved to the
  content region on view change.
- Visible focus: 2 px `blu` outline, 2 px offset, on every focusable element.
- All controls have an accessible name; icons are `aria-hidden`.
- Charts: `role="img"` with a title, plus the table alternative.
- Map: a text summary for screen readers; the same events are available as a
  list under *Live intelligence*.
- Text size: Settings → Standard / Large / Extra large (root font size).
- Motion: honours `prefers-reduced-motion`.
- Language: French and English; `<html lang>` follows the choice.

## Adding a language

Add an object of the same shape to `DICTS` in `src/lib/i18n/index.ts` and an
entry to `LANGS`. A test fails if any key or placeholder is missing.

## Integration points

Slots that exist in the interface and say they are not connected:

| Slot | Where | What to connect |
|---|---|---|
| AI synthesis | `IntelDetail` → “Synthèse par IA” | server-side model call returning text + cited source ids |
| Assistant engine | `lib/strategic/synthesis.ts` → `buildBrief` | same contract, model-backed |
| Humanitarian funding | `lib/live/opendata.ts` → `fetchFunding` | server relay for OCHA FTS (invalid CORS headers upstream) |
| Sub-national displacement | `HumanitarianPanel` | IOM-DTM (subscription key) or HDX HAPI (identifier) |
| Congolese press | `lib/fusion/sources.ts` → `fetchNewsFeeds` | server relay for RSS feeds |
| Authentication | `useAuthStore.login` | real identity provider; roles server-side |
| Persistence | `useStrategicStore` (`load` / `save`) | database behind the same actions |
