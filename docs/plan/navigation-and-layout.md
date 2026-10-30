<!-- Part of the Travel Log plan; index: docs/plan/README.md -->
# Navigation and layout (M10, built)

## Pages and addresses

- **Pages**: Map · **+** · You, as bottom tabs on phones; on wider screens the toolbar has Map
  and You as tabs and **+ Add trip** on the right. There's no Trips tab (trips live on the map,
  below) and no Parks tab (the checklist is You › Parks). The toolbar spans the top, above the map
  and pages: the title, the pages, Add trip, the sync status and your photo (opens You); every
  control is 36 px tall.
- **Addresses** (hash, so Back works and links can be shared; `src/ui/route.ts`):
  - `#/` the map, with the Trips list (phones: the sheet peeking).
  - `#/trips` the map with the Trips list showing (phones: the sheet raised).
  - `#/trips/<tripId>` a trip; `#/trips/at/<placeId>` a pin's trips; `#/trips/at/<placeId>/<tripId>`
    one of them, so the breadcrumb keeps the place.
  - `#/you`, `#/you/achievements`, `#/you/parks`, `#/you/people`, `#/you/settings`. The sync chip
    opens `#/you/settings` when something needs fixing.
  - `#/you/stats/<states|countries|days|drive|flight|hikes>` a stat's list over the profile;
    `#/you/achievements/<id>` an achievement's details.
  - Old links still work: `#/places` opens the map, `#/parks` opens You › Parks.
- **Closing goes up**: Back when the app opened the view, otherwise (a link opened straight to it)
  the view above it (`useRoute().close`).

## You: sections

| Section | What's in it |
|---|---|
| **Profile** | Your numbers (each opens what it counts), **Recently earned** with "See all achievements →", Most visited |
| **Achievements** | Every achievement by category, with the All / Earned / In progress filter; each opens its details |
| **Parks** | The 64-park checklist (was the Parks tab) |
| **People & groups** | The people and groups editor, in the page; an editor opens in place with a back arrow |
| **Settings** | Sync, **Home**, Map detail, Backup, Appearance |

- **Desktop:** your profile card (photo, name, Home, "Traveling since", Edit profile) and the
  section menu (with counts) down the left; the section fills the rest, up to 72 rem.
- **Phones:** the card on top, section tabs under it ("People" for short); tap them, or swipe
  sideways on the section.
- See profile-and-achievements.md for the profile, stat lists and achievement details.
- `YouPage.tsx` (layout, the stat and achievement panels), `YouSections.tsx` (Profile,
  Achievements, `StatList`, `AchievementDetail`), `ParksSection.tsx`, `PeoplePanel.tsx`
  (`PersonEditor` also edits your profile), `Settings.tsx`.

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
