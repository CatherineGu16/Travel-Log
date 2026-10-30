<!-- Part of the Travel Log plan; index: docs/plan/README.md -->
# Profile & achievements (M9 and the M11 redesign built, except badge artwork)

A **You** page with your stats and tiered achievements, to make logging trips a little bit of a
game. Badge artwork comes later; this fixes the format first.

## Navigation

- **Drop the Places tab.** It only lists main destinations and hands off to the map; map pins and
  the profile's **Most visited** cover it.
- **Tab bar / header links:** Map · Trips · **+** · Parks · **You**.
- **Into the profile:** People & groups, Settings (sync, map detail, backup, theme) and **Home**
  (from Settings). The header keeps the title, the states/parks counts and the sync chip (which
  still opens sync settings).

## The You page, top to bottom

1. **You**: avatar and name, Home, "Traveling since 2019" (the first trip's year).
2. **Stats**: states n/50, parks n/64, countries, trips, days traveled, miles driven, miles flown,
   hikes. Each taps through to the list or filter it counts.
3. **Recently earned**: the last few tiers earned, newest first, each with the trip that earned it.
4. **Achievements by category**, filter All · Earned · In progress. Each shows its badge, current
   tier and progress to the next ("41 / 64 parks · Gold at 64"); locked ones show progress only.
5. **Most visited**: your most-visited main destinations, each opening on the map.
6. **People & groups**, **Settings**, **Backup**.

## Achievement format

Defined in code (`src/lib/achievements.ts`; totals in `src/lib/stats.ts`; the page is
`src/components/YouSections.tsx`); nothing new is stored or synced. Continents come from
`world-cities.json` (`continents`, GeoNames).

```
{ id, category, name, description,
  tiers: [{ level: 'bronze' | 'silver' | 'gold', goal }]   // one tier for one-off achievements
  progress(data) → number                                   // counted from your trips, every time
}
```

- **Always correct**: progress is worked out from your data, so editing or deleting a trip updates
  it.
- **Earned on**: the trip that crossed a tier's goal, found by replaying trips in date order
  ("Silver · Mar 2024 · Utah Parks").
- **Celebration**: the save message itself carries a newly earned tier ("Added Utah 2023 · 🏅 Silver
  · National Parks (+1 more)"), so Undo stays one tap away. It compares before and after the save,
  so nothing needs remembering.

## The list (Bronze / Silver / Gold)

| Category | Achievement | Tiers |
|---|---|---|
| States | States visited | 10 / 25 / 50 |
| | Coast to Coast (Pacific and Atlantic stops on one trip) | once |
| | Regions (New England, Four Corners, Pacific Coast…) | once each |
| Parks | National parks | 10 / 30 / 64 |
| | Park Hopper (parks on one trip) | 2 / 3 / 5 |
| | Utah's Mighty 5, California's 9 | once each |
| | Off the Grid (remote parks) | 1 / 3 / 5 |
| Hikes | Hikes logged | 10 / 50 / 100 |
| | Strenuous hikes (NPS difficulty) | 1 / 5 / 10 |
| | Iconic trails (Angels Landing, Half Dome…) | 1 / 3 / 5 |
| Road & air | Longest road trip | 500 / 1,000 / 2,500 mi |
| | Trips with a flight | 5 / 10 / 25 |
| | Ways to travel (drive, flight, train, cruise, ferry…) | 3 / 4 / 5 |
| World | Countries | 2 / 5 / 10 |
| | Continents | 2 / 3 / 4 |
| People & habits | Travel buddy (trips with one person) | 3 / 5 / 10 |
| | Family trips (everyone in Family) | 1 / 5 / 10 |
| | Year streak (a trip every year) | 3 / 5 / 10 years |
| | Storyteller (trips with notes) | 5 / 10 / 25 |
| | Trips logged | 10 / 25 / 50 |

## Build order

1. ✅ Navigation: Places dropped, You added, People / Settings / Home moved into it.
2. ✅ `achievements.ts`: definitions, progress, earned-on, with unit tests.
3. ✅ The You page with stats and plain achievement cards (placeholder badges: the category's
   icon in a ring of the tier's color).
4. ✅ Celebration on the save message.
5. Badge design pass (next).
- Not built from the list: **Strenuous hikes** (needs the NPS hike data loaded alongside).

## Redesign (M11, built)

Modeled on GitHub's profile: a card with who you are beside wide content.

- **Toolbar**: one full-width bar above the map and pages (not floating), every control the same
  height (36 px) and shape. Desktop: title on the left, then **Map · You** as tabs with icons; on
  the right **+ Add trip** (a labeled primary button), the sync status and your photo (opens You).
  Phones: the same bar with the title, sync status and photo; the bottom tabs are **Map · + ·
  You**. Every button shows the hand cursor (Tailwind 4 resets it; set once in `index.css`).
- **No Parks tab**: the 64-park checklist becomes the **Parks** section of You (`#/you/parks`;
  old `#/parks` links go there). The Parks layer stays on the map.
- **Profile**: a synced `profile` record (`types.ts` `Profile`: name and avatar, one record like
  Home, set with `setProfile`; the photo uploads like a person's, at `avatars/profile.webp`).
  Until it's set the card shows "You", a stand-in photo and "Add your name and photo". **Edit profile** sets the
  name and the same initials / emoji / photo avatar as people.
- **Layout**: wide (up to 72 rem). Desktop: a left column with the profile card (photo, name, Home,
  "Traveling since", Edit profile) and the section menu (Profile, Achievements, Parks, People &
  groups, Settings); the section fills the rest. Phones: the card on top (photo beside name), the
  sections as tabs under it.
- **Cards you can click look clickable**: a border, a chevron, lift and border color on hover,
  the hand cursor, a focus ring. Cards that only show something are flat (no border, no chevron).
  The classes are in `components/cards.ts` (`PRESSABLE_CARD`, `PRESSABLE_ROW`, `FLAT_CARD`).
- **Stats open lists** (a panel from the right on desktop, a sheet on phones; `#/you/stats/<kind>`):
  States (each with its trips), Countries, Trips (opens the Trips list on the map), Days traveled
  (trips by length), Miles driven / flown (trips by distance), Hikes (each hike, its park and
  date). National parks opens the Parks section. Trips in a list open on the map; hikes open
  their park. The lists come from `stats.ts` (`tripsByArea`, `tripsBy`, `hikesLogged`).
- **Achievement details** (same panel/sheet, `#/you/achievements/<id>`, or `#/you/earned/<id>`
  over the profile from Recently earned): the badge, what it's for, progress to the next tier,
  each tier's goal and when and on which trip you earned it (the trip opens on the map). Parks
  achievements (National parks, Utah's Mighty 5, California's 9, Off the Grid) also list the parks
  that count (`Achievement.parks`), checked off once visited; each opens its park. Park Hopper
  counts parks on any one trip, so it has no list.
