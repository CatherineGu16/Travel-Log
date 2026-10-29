<!-- Part of the Travel Log plan; index: docs/plan/README.md -->
# Navigation and layout (planned, M10)

## Pages and addresses

- **Bottom tabs on phones** (kept): Map · Trips · **+** · Parks · You. Page links in the header on
  wider screens. The header holds only the title, the page links and the sync chip.
- **Addresses** (hash, so Back works and links can be shared to a page):
  `#/trips`, `#/trips/<tripId>`, `#/you`, `#/you/achievements`, `#/you/people`, `#/you/settings`.
  The sync chip opens `#/you/settings`.

## You: sections

| Section | What's in it |
|---|---|
| **Profile** | Your numbers, **Recently earned** with "See all achievements →", Most visited |
| **Achievements** | Every achievement by category, with the All / Earned / In progress filter |
| **People & groups** | The people and groups editor, in the page instead of a pop-up |
| **Settings** | Sync, **Home** (moved here from the profile), Map detail, Backup, Appearance |

- **Desktop:** a menu down the left, the section on the right.
- **Phones:** section tabs across the top, under the title; tap or swipe between them.

## Trips: a panel over the map

- **Desktop:** the Trips page becomes a **collapsible panel on the left over the map** (the map
  stays visible). It holds the list (search, group, sort, filter). Selecting a trip shows it in the
  panel with a **breadcrumb**, `Trips › Utah 2023` ("Trips" goes back), and draws its route.
  « collapses the panel to a full map. Clicking a map pin opens the panel on that place:
  `Trips › Moab` (its trips, stacked) then `› Moab 2021`. This replaces the floating pin card and
  the full-screen trip details on desktop.
- **Phones:** the same, as a **sheet over the map** you drag between peeking, half and full height:
  the list, then a trip with the breadcrumb, with its route on the map above. Replaces the Trips
  page, the pin card's swipe cards and the trip details sheet on phones.
- **Open question:** with Trips showing the map too, the Map and Trips tabs may merge into one
  (the map with the panel/sheet); decide once it's built.

## Build order

1. Addresses with sub-paths (`#/you/<section>`, `#/trips/<tripId>`).
2. You sections: layout (left menu / top tabs), Profile overview, Achievements, People & groups
   and Settings in the page, Home into Settings.
3. Desktop Trips panel with breadcrumb; map pins open it.
4. Phone Trips sheet (drag between heights) with the same list, breadcrumb and details.
5. Tests and docs.
