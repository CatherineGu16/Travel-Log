<!-- Part of the Travel Log plan; index: docs/plan/README.md -->
# Navigation and layout (M10, built)

## Pages and addresses

- **Pages**: Map · **+** · Parks · You, as bottom tabs on phones and header links on wider
  screens. There's no Trips tab: trips live on the map (below). The header holds only the title,
  the page links and the sync chip.
- **Addresses** (hash, so Back works and links can be shared; `src/ui/route.ts`):
  - `#/` the map, with the Trips list (phones: the sheet peeking).
  - `#/trips` the map with the Trips list showing (phones: the sheet raised).
  - `#/trips/<tripId>` a trip; `#/trips/at/<placeId>` a pin's trips; `#/trips/at/<placeId>/<tripId>`
    one of them, so the breadcrumb keeps the place.
  - `#/parks`; `#/you`, `#/you/achievements`, `#/you/people`, `#/you/settings`. The sync chip
    opens `#/you/settings` when something needs fixing.
  - Old links still work: `#/places` opens the map.
- **Closing goes up**: Back when the app opened the view, otherwise (a link opened straight to it)
  the view above it (`useRoute().close`).

## You: sections

| Section | What's in it |
|---|---|
| **Profile** | Your numbers, **Recently earned** with "See all achievements →", Most visited |
| **Achievements** | Every achievement by category, with the All / Earned / In progress filter |
| **People & groups** | The people and groups editor, in the page; an editor opens in place with a back arrow |
| **Settings** | Sync, **Home**, Map detail, Backup, Appearance |

- **Desktop:** a menu down the left, the section on the right.
- **Phones:** section tabs across the top, under the title ("People" for short); tap them, or swipe
  sideways on the section (not on the Recently earned row, which scrolls sideways itself).
- `YouPage.tsx` (layout), `YouSections.tsx` (Profile, Achievements), `PeoplePanel.tsx`, `Settings.tsx`.

## Trips: on the map

The map page always has Trips over it, showing one of three views, with a **breadcrumb** on top
(`Trips › Moab › Moab 2021`; each step back is a link):

- **The list** (`TripList.tsx`): search, group, sort. The map's Filter applies to it.
- **A place** (a map pin, or Most visited): `Trips › Moab`, its trips as stacked cards
  (`PinCard.tsx`). The highlighted card's route is on the map; click another to switch, Details to
  open it. Close goes back to the list.
- **A trip** (`TripDetail.tsx`): the details, with its route drawn on the big map (no small map).
  Edit opens the trip form over it; after saving, the trip stays open. Saving from anywhere else
  opens the trip's place with it on the map. Delete goes back up a level.

Where it sits (`TripsPanel.tsx`):

- **Wider screens:** a panel on the left over the map. « hides it for the full map ("Show trips"
  brings it back); opening a place or trip brings it back too. Moving the map to a trip centers it
  in the space beside the panel.
- **Phones:** a sheet over the map, peeking (just the breadcrumb), half, or nearly full height.
  Drag the top (a quick flick goes one size; a slow drag settles on the nearest), or tap it to go
  peeking → half → full → peeking. Opening a place or trip raises it to half; tapping the bare map
  or going to `#/` lowers it to peeking. At the list, peeking is `#/` and taller is `#/trips`. The
  map ends where the peeking sheet starts, so its buttons stay in reach.

## Build order (done)

1. ✅ Addresses with sub-paths.
2. ✅ You sections; People & groups and Settings in the page; Home into Settings.
3. ✅ Desktop Trips panel with breadcrumb; map pins open it.
4. ✅ Phone Trips sheet (drag between heights) with the same list, breadcrumb and details.
5. ✅ Trips tab, Trips page, floating pin card, swipe cards and the details sheet removed.
6. ✅ Tests (`e2e/addresses.spec.ts` for addresses, the panel and the sheet) and docs.
