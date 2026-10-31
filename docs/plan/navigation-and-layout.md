<!-- Part of the Travel Log plan; index: docs/plan/README.md -->
# Navigation and layout (M10, built)

## Pages and addresses

- **Pages**: Map · **+** · You, as bottom tabs on phones; on wider screens the toolbar has a Map
  tab, **+ Add trip** (which opens the trip form in the Trips panel; see ui-trip-form.md) and your
  photo, which opens You (ringed while you're there), so there's no You tab. There's no Trips tab (trips live on the map,
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
    `#/you/achievements/<id>` an achievement's details over Achievements, `#/you/earned/<id>` the
    same over the profile (from Recently earned, so the page doesn't switch).
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

- **Desktop:** your profile card (photo centered, name, Home, "Traveling since", Edit profile) and the
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

- **The list** (`TripList.tsx`): search, filter, group, sort.
- **A pin** (or a place in Most visited): `Trips › Moab` lists its trips as cards (`PinCard.tsx`),
  newest first, one card when you've been once, each with its dates, places in order and who
  went; pointing at a card puts its route on the map, tapping it opens the trip with all its
  details (`Trips › Moab › Moab 2021`).
- **Phones**: the same in the sheet. Tapping a pin raises it to half height with the card(s), the
  route drawn above; a card opens the trip (drag the sheet up for more of it); ‹ or the
  breadcrumb goes back; tapping the bare map goes back to the list and lowers the sheet.
- **A trip** (`TripDetail.tsx`): every detail right away (no Details button), with its route on
  the big map: When, Who went, Stops, Notes, each with its own Edit (which opens the form on that
  step, so there's no Edit trip button), and a quiet "Delete trip" at the end (back up a level,
  with Undo). Saving a trip opens it.
- **Getting back**: below the list, a ‹ button by the title goes up a level; the breadcrumb's links
  too. **Clicking the bare map** lets go of the place or trip and goes back to the list (on a phone
  with nothing open, it lowers the sheet).

**Heading** (the same in every view, on the panel and the sheet): where you came from as small
links (Trips › Moab), then where you are as the title, with one line under it: "3 trips", "2 visits
· UT", or where a trip went and how far (`tripWhere` in `stats.ts`; its dates are under When). It's one breadcrumb,
read as "Trips › Moab › Moab 2021". The views below it don't repeat the title.

**The list's controls**: search (with an icon), then Filter, Group and Sort as small chips, kept at
the top as the list scrolls on wider screens. **Filter** opens its options in place, right under
them (`FilterPanel.tsx`: with, people, how you traveled, year, tag; Clear all; "Show N trips" folds
it away), not as a panel of its own. Group names are small labels; trips are plain rows with a ›.
The map has no Filter button, just Parks.

Where it sits (`TripsPanel.tsx`):

- **Wider screens:** a panel on the left over the map. A tab on its right edge (‹) hides it for
  the full map; the same tab on the map's left edge ("Trips ›") brings it back, and so does opening
  a place or trip. While it's open, the map's own padding keeps its
  width clear, so everything centers in the space beside it: the US when the app opens, the US
  button, routes, places, and the globe zoomed out. Hiding or showing it slides the view over.
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
