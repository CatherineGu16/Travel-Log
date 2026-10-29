# Travel Log — notes for Claude

A personal PWA for logging trips on a map: pins per main destination, routes made of legs (drive,
flight, …) from where the trip started and back, stacked repeat visits, a 64-park checklist with
hikes. Offline-first (IndexedDB), syncs `travel.json` to the user's private GitHub repo. React 19 +
TypeScript + Vite + Tailwind 4 + MapLibre 6. Live: https://catherinegu16.github.io/Travel-Log/

**Design docs:** `docs/plan/README.md` indexes small topic files. Read only the one you need, and
update it when behavior changes.

## Commands

```sh
npm run dev          # http://localhost:5173/Travel-Log/
npx tsc -b           # typecheck (fast; run after edits)
npm run lint         # oxlint
npx vitest run       # unit tests (next to the code, *.test.ts)
npx playwright test  # e2e, desktop Chrome + iPhone (builds first; ~1.5 min). -g "name" for one test
npm run data:map     # rebuild bundled map/search data (--only=world-cities for one file)
```

## Don't open (big generated data; ask before reading)

`src/data/us-places.json` (1.2 MB), `src/data/world-cities.json` (1.5 MB), `park-hikes.json`,
`park-boundaries.json`, `world-countries.json`, `us-states.json`, `us-cities.json`, `us-lakes.json`,
`scripts/nps-day-hikes.json`, `scripts/park-hikes.csv`, `scripts/park-hikes-report.md`. Their row
formats are documented in `docs/plan/data.md` and the loaders in `src/lib/gazetteer.ts` /
`src/lib/placeSearch.ts`.

## Code map

**Data and rules (`src/lib/`, pure, unit-tested)**
- `types.ts`: the saved format (`TravelData`, `Trip`, `Destination`, `Place`, `Person`, `Group`, `Home`).
- `travelActions.ts`: every edit as `(data, ctx) => data` (saveTrip, setHome, people/groups, hikes,
  undo via `revertTo`). Applied through the store.
- `travelData.ts`: `parseTravelData` (validates and **migrates older saves on every load**),
  `mergeData` (newest `updatedAt` per record wins; tombstones), `sameContent`.
- `legs.ts`: legs between stops and to/from the start; mode guesses (250 mi, or 500 mi after a
  drive; remembered picks); road trip / cruise; `tripStart`.
- `route.ts`: `routeOf` (points + legs for drawing), `legPaths` (reuse roads already traveled),
  `followTraveledBends`, `distancesByMode`, bend helpers.
- `derive.ts`: pins, visits, parks/states visited, shading. `filters.ts`: filter, search, grouping.
- `achievements.ts`: tiered achievements (`ACHIEVEMENTS`, `achievementStatus`, `newlyEarned`),
  worked out from trips, never stored. `stats.ts`: totals for the You page.
- `placeSearch.ts` (offline search ranking, country narrowing), `gazetteer.ts` (lazy data loaders,
  naming a dropped pin), `onlineSearch.ts` (Photon, Detailed map only), `partialDate.ts`
  (YYYY / YYYY-MM / YYYY-MM-DD, day numbers), `geo.ts`, `states.ts`.
- `hikeEdits.ts`, `addedHikes.ts`: NPS hike corrections and shared hikes. `backup.ts`, `zip.ts`: export/import.

**State (`src/store/`)**: `travelStore.ts` (IndexedDB copy, `apply(edit, label)` with undo),
`useTravel.ts` (hooks), `avatarStore.ts`. **Sync (`src/sync/`)**: `syncEngine.ts`, `github.ts`.

**Map (`src/map/`)**: `MapView.tsx` (lazy chunk; pins, route, parks, globe toggle, shaping drags),
`outlineStyle.ts` (style + layers + palettes), `routeData.ts` (route GeoJSON + fit bounds, shared),
`RouteMap.tsx` (small still map on trip details), `views.ts` (US view, globe zoom), `detailedTiles.ts`.

**UI (`src/components/`, `src/ui/`)**
- `App.tsx`: shell, pages, selection, shaping banner and state.
- `TripForm.tsx`: Add/Edit trip stepper (Details → Route timeline → Notes); `StopDates.tsx` (day
  strip), `LegRow.tsx` + `timeline.ts`, `PeoplePicker.tsx` (who went), `TagsField.tsx`,
  `PlacePicker.tsx`, `DateRangeField.tsx`.
- `PinCard.tsx` (map preview: swipe cards / stacked cards), `TripDetail.tsx`, `TripsPage.tsx`,
  `ParksPage.tsx`, `ParkSheet.tsx`, `ProfilePage.tsx` (You: stats, achievements, most visited,
  Home, links to People & Settings), `PeopleSheet.tsx`, `Settings.tsx` (+ panels), `FilterSheet.tsx`.
- `Sheet.tsx`: every panel (props `tall`, `full`, `swipeToClose`, `toolbar`, `footer`).
- `src/ui/`: page routing (`route.ts`), theme, persistent state, keyboard inset.

**Tests**: unit `src/**/*.test.ts` (helper `src/test/tripInput.ts`); e2e `e2e/*.spec.ts` (helpers
`e2e/helpers.ts`: `toStep`, `pickDays`, `openDates`, `setTripYear`, `openYou`, `openPeople`,
`openSettings`). E2E finds things by role and
accessible name, so keep those names stable or update the tests.

## Conventions

- Comments say what something is for, in plain language a user would recognize; exported functions
  get a short doc comment. Match the surrounding density.
- Style: no semicolons, single quotes, 2-space indent, long lines are fine (~160).
- Tailwind tokens: `bg-surface`, `bg-bg`, `bg-raised`, `text-muted`, `border-line`, `primary`,
  `var(--route)`, `text-park`. Tap targets ≥ 44 px; check phone width (390 px).
- No outside requests by default (the map, search and fonts are bundled); Detailed map opts in to
  OpenFreeMap + Photon. Never commit personal data (`travel.json`, exports).
- New saved fields: add to `types.ts`, `saveTrip` input, `parseTravelData` (with a default and any
  migration), the test helpers, and `docs/plan/data.md`. Migrations in `parseTravelData` aren't
  written back until a record is edited, so a change that must stick (e.g. pinning a trip's start
  before Home changes) has to be a real edit (see `setHome`).
- Commit messages: a plain-language title and bullets about what changed for the user; end with the
  attribution line from the session.
