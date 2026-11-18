<!-- Part of the Travel Log plan; index: docs/plan/README.md -->
# Park badges (M12: steps 1–2 built)

You › Parks becomes a **grid of badges**, one per national park (64), instead of a checklist. A
park you haven't been to shows its badge **outlined**; one you have shows it **in color**. Tapping a
badge opens a flyout with the badge large, **how many times** you've been and **every visit's
dates**, and the park's **hikes in a collapsible section** below. It should feel like Apple Watch
activity awards: a wall of badges that fill in as you earn them, each one a small object you can
pick up and turn over.

Nothing new is saved: like achievements, badges are worked out from your trips (`parkVisits`,
`hikesDone`), so they're always right after an edit, an Undo or a sync.

## 1. The artwork: your own badges

**Decided:** you draw the 64 badges yourself and add them to the repo. (Shutterstock's files were
ruled out: its licences don't allow publishing the image files, which a public repo and site
would do, and there's no matching set of 64. The NPS arrowhead is a registered emblem, so it's
out too.) The app works before any art exists: each park shows a **placeholder** badge (a plain
frame with the park's initials) until its file is there, so badges can be added a few at a time.

**What to make, per park**

- **File name**: the park's id from the table below, e.g. `zion.svg`.
- **Format**: SVG preferred (sharp at any size, small). PNG or WebP also work: **512 × 512 px**,
  transparent background.
- **Canvas**: square, transparent outside the badge. Any badge shape (circle, shield, hexagon…),
  like Apple's awards; keep it within the canvas with a little margin (~4 %) so the shadow fits.
- **Size**: under ~20 KB for an SVG, ~80 KB for a PNG/WebP (64 of them load with the Parks page).
- **Two looks**: the file you make is the **colored, earned** badge. For **not visited**, either
  - add a second file, `<id>-outline.svg` (or `.png`), drawn as you like it unearned; or
  - don't, and the app makes one: the same art in gray, faded, with an outlined ring.
- **The back** (seen when you turn a badge over in the flyout) is drawn by the app (first visit
  date, times visited), so it isn't part of the file.

**Where they go**: `src/assets/park-badges/` in the repo. On GitHub: open that folder, **Add file
› Upload files**, drop them in, commit. The build picks up whatever is there (a Vite glob import),
so a new file shows up on the next deploy with no code change, and a missing one keeps its
placeholder. (Or send them to me and I'll add them.) Adding badges from inside the app isn't
planned: it would mean the app writing image files into the public repo.

**The 64 ids**

| File name (id) | Park |
|---|---|
| `acadia` | Acadia |
| `american-samoa` | American Samoa |
| `arches` | Arches |
| `badlands` | Badlands |
| `big-bend` | Big Bend |
| `biscayne` | Biscayne |
| `black-canyon-of-the-gunnison` | Black Canyon of the Gunnison |
| `bryce-canyon` | Bryce Canyon |
| `canyonlands` | Canyonlands |
| `capitol-reef` | Capitol Reef |
| `carlsbad-caverns` | Carlsbad Caverns |
| `channel-islands` | Channel Islands |
| `chiricahua` | Chiricahua |
| `congaree` | Congaree |
| `crater-lake` | Crater Lake |
| `cuyahoga-valley` | Cuyahoga Valley |
| `death-valley` | Death Valley |
| `denali` | Denali |
| `dry-tortugas` | Dry Tortugas |
| `everglades` | Everglades |
| `gates-of-the-arctic` | Gates of the Arctic |
| `gateway-arch` | Gateway Arch |
| `glacier` | Glacier |
| `glacier-bay` | Glacier Bay |
| `grand-canyon` | Grand Canyon |
| `grand-teton` | Grand Teton |
| `great-basin` | Great Basin |
| `great-sand-dunes` | Great Sand Dunes |
| `great-smoky-mountains` | Great Smoky Mountains |
| `guadalupe-mountains` | Guadalupe Mountains |
| `haleakala` | Haleakalā |
| `hawaii-volcanoes` | Hawaiʻi Volcanoes |
| `hot-springs` | Hot Springs |
| `indiana-dunes` | Indiana Dunes |
| `isle-royale` | Isle Royale |
| `joshua-tree` | Joshua Tree |
| `katmai` | Katmai |
| `kenai-fjords` | Kenai Fjords |
| `kings-canyon` | Kings Canyon |
| `kobuk-valley` | Kobuk Valley |
| `lake-clark` | Lake Clark |
| `lassen-volcanic` | Lassen Volcanic |
| `mammoth-cave` | Mammoth Cave |
| `mesa-verde` | Mesa Verde |
| `mount-rainier` | Mount Rainier |
| `new-river-gorge` | New River Gorge |
| `north-cascades` | North Cascades |
| `olympic` | Olympic |
| `petrified-forest` | Petrified Forest |
| `pinnacles` | Pinnacles |
| `redwood` | Redwood |
| `rocky-mountain` | Rocky Mountain |
| `saguaro` | Saguaro |
| `sequoia` | Sequoia |
| `shenandoah` | Shenandoah |
| `theodore-roosevelt` | Theodore Roosevelt |
| `virgin-islands` | Virgin Islands |
| `voyageurs` | Voyageurs |
| `white-sands` | White Sands |
| `wind-cave` | Wind Cave |
| `wrangell-st-elias` | Wrangell–St. Elias |
| `yellowstone` | Yellowstone |
| `yosemite` | Yosemite |
| `zion` | Zion |

## 2. The grid (You › Parks)

- **Header** as now: "National parks", **14 / 64 visited**, the progress bar, Show (All · Visited ·
  Not visited) and Order (A–Z · State · **Recent**, newest visit first). By State, each state is a
  heading over its own grid.
- **Grid**: `grid-template-columns: repeat(auto-fill, minmax(6.5rem, 1fr))`, so 3 across on a
  390 px phone, 5–6 in the desktop section, 8+ wide. Each cell is one button (≥ 44 px, in fact
  ~104 px), read out as "Zion, visited 3 times" or "Acadia, not visited".
- **A badge cell**: the badge (circle frame, ~84 px), the park's short name under it (two lines,
  no cut-off), and one small line: **"3×" or the year** when visited, nothing when not.
  - **Not visited**: outline art in `--muted` on `--raised`, no fill, no shadow: present but
    clearly not earned.
  - **Visited**: full color, a soft shadow and a faint sheen across it (like Apple's metal
    badges); a small count chip at the top right from 2 visits on ("×3").
  - **Newly visited** (a park first visited on the trip you just saved): the badge "lands" the next
    time the grid shows it (outline → color, a scale bounce), once.
- **Log a visit** moves into the flyout (it doesn't fit a badge cell).
- Reduced motion: no sheen sweep, bounce or spin; badges just switch.

## 3. The flyout (a badge tapped)

The existing park sheet (`ParkSheet.tsx`, a `Sheet`: up from the bottom on phones, from the right on
wider screens), redesigned top to bottom:

1. **The badge, large** (~180 px), with the Apple Watch touch: **drag it sideways to spin it** in
   3D (CSS `rotateY`, following your finger, settling front or back when you let go); the **back**
   is engraved with **your earliest visit's date** ("First visited · May 1, 2016"). *(Decided.)* Tapping it flips it. Not
   visited: the outline badge, and "Not visited yet" on the back. (Keyboard: a "Turn over" button.)
2. **The name and a one-line summary**: "Zion National Park · UT", then **"Visited 3 times ·
   first in 2016"**, or "Not visited yet" with **Log a visit**.
3. **Visits**: each visit, newest first: its dates (the days at the park if the stop has its own,
   else the trip's), the trip's title as a link (opens it on the map), and who went (faces).
4. **Hikes (collapsible)**, a disclosure row "Hikes · 4 done · 31 in this park":
   - **Hikes you've done**, each with its dates and trip (as now), Remove.
   - **All hikes in this park**: the NPS list and the ones people added, as corrected, A–Z, with
     distance, time, difficulty and the nps.gov link; ones you've done are checked. Tapping one
     adds it to a visit (asking which when there are several), so it doubles as **Add a hike**;
     the search box stays above it for hikes not listed.
   - Closed by default when the park has more than ~8 hikes (Glacier has 74); remembered per
     device.
   - The owner's **Correct the hike suggestions** stays at the very bottom.

**Decided:** hikes live here, in the flyout (not under the grid); the badge's back shows the
earliest visit date.

## 4. Counting

- **Times visited** = trips that include the park (`parkVisits`): two stops at Zion on one trip
  count once; two trips count twice.
- **First visited** = the earliest of those, by the park stop's own dates if set, else the trip's.
- **Visited** (colored) = at least one trip to it that has **started** (start date today or
  earlier). There's no planned-trips feature, but a trip can be given future dates; until they
  come, it doesn't color the badge, and the cell says "Upcoming · Jun 2027" instead. *(Decided.)*

## 5. Build order

1. ✅ **Grid with placeholder badges**: `ParkBadge.tsx` (your file when it exists, else the
   placeholder frame with initials; the colored and not-visited looks, count chip), the grid in `ParksSection.tsx`, Recent order, cell names. Tests:
   e2e for outlined vs colored, the count, filters, opening a park (update `parks.spec.ts`,
   which finds rows by `listitem` name today). Built: `ParkBadge.tsx`, `parkBadgeArt.ts` (the
   glob of `src/assets/park-badges/` and a unit test that every file there is named after a
   park), `hasStarted` / `parksVisited` (a park counts once the trip has started, everywhere: the
   grid, the profile's numbers, the map's parks layer, achievements). Log a visit is in the
   flyout only.
2. ✅ **Flyout redesign**: the large badge with flip and drag-to-spin, summary, Visits with trip links,
   the collapsible Hikes with the full list (done ones checked, tap to add). Unit tests for the
   counting rules in `derive.ts`. Built: `TurnableBadge` (in `ParkBadge.tsx`), the sheet's Badge,
   Visits (each with its dates, an Upcoming tag for one dated ahead, the trip and who went) and
   Hikes sections (`travel.park.hikes` remembers open / closed; until you choose, it's open when
   you've done hikes there or the park has 8 or fewer). The owner's corrections sit under it.
3. **Your artwork** (§1): the glob import of `src/assets/park-badges/`, `-outline` files when
   there, the automatic not-visited look otherwise, loaded only with the Parks section. A unit
   test that every file in the folder is named after a real park id (so a typo doesn't go
   unnoticed). Then badges arrive whenever you add them, no code change.
4. **Celebration**: a save that first visits a park shows the badge in the message ("🏅 New badge:
   Zion"), like tier achievements, and the grid plays its "land" once.
5. Docs (this file, ui-lists.md, CLAUDE.md code map) and screenshots at 390 px and desktop.

## Files

- New: `src/components/ParkBadge.tsx` (the badge: your art or the placeholder, both looks, spin),
  `src/assets/park-badges/` (your files).
- Changed: `ParksSection.tsx` (grid), `ParkSheet.tsx` (flyout), `derive.ts` (first visit, counts),
  `e2e/parks.spec.ts`.
- No change to the saved format, sync or `parseTravelData`.
