<!-- Part of the Travel Log plan; index: docs/plan/README.md -->
# Profile & achievements (planned, M9)

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

Defined in code (`src/lib/achievements.ts`, planned); nothing new is stored or synced.

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
- **Celebration**: after a save, a newly earned tier shows "🏅 Silver · National Parks". Each device
  remembers which tiers it has shown (local storage, not synced).

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

1. Navigation: drop Places, add You, move People / Settings / Home into it.
2. `achievements.ts`: definitions, progress, earned-on, with unit tests (no UI).
3. The You page with stats and plain achievement cards.
4. Celebration after a save.
5. Badge design pass.
