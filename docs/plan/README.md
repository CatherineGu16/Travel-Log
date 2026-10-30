# Travel Log — Plan

A personal web app for logging trips on an interactive map. Each **main destination** gets a pin
(green for national parks); a trip's **route** runs through its stops and legs (drives, flights,
trains…), from where it started and back. Going back somewhere **stacks** the visits on one pin. A
**US national parks checklist** tracks the 64 parks and the hikes done in each. The app installs on
iPhone, iPad and Windows, works offline, and syncs across devices through a private GitHub repo.

Phase 1 covers the United States, with world place search and a globe view done early; the data
model is world-ready (ISO country and region codes on every place). **No trip photos**: text and
locations only, plus optional small avatar photos for people.

## Files

Read only the file you need.

| File | What it covers |
|---|---|
| [decisions.md](decisions.md) | Stack, hosting, sync approach, map and search choices; free-account limits |
| [privacy.md](privacy.md) | What stays private, the access key, outside requests (none by default) |
| [trips-and-routes.md](trips-and-routes.md) | Trips, places, pins, legs and modes, routes, reusing the way you came, shaping, stacked dates, start/home |
| [data.md](data.md) | Bundled public data files, the `travel.json` format, migrations of older saves, and every derived rule (guesses, road trip / cruise, visits, parks and states) |
| [sync.md](sync.md) | GitHub sync and merging |
| [ui-map.md](ui-map.md) | The map: pins, shading, preview cards, filters, parks layer |
| [ui-trip-form.md](ui-trip-form.md) | Add / edit trip: the Details → Route → Notes stepper, the Route timeline, stop dates, who went, tags |
| [ui-lists.md](ui-lists.md) | Trips list, parks checklist, trip detail (Places was dropped) |
| [ui-app.md](ui-app.md) | Header, navigation, settings, people & groups, responsive layout, theme |
| [profile-and-achievements.md](profile-and-achievements.md) | The You page, tiered achievements and celebrations (M9; badge artwork next) |
| [navigation-and-layout.md](navigation-and-layout.md) | Pages and addresses, You sections (left menu / top tabs), Trips on the map: a panel (desktop) or a sheet (phones) with a breadcrumb |
| [roadmap.md](roadmap.md) | World map (later), milestones, open and answered questions |
| [setup.md](setup.md) | One-time setup steps for GitHub, Pages and the access key |

The code map and working conventions are in [CLAUDE.md](../../CLAUDE.md) at the repo root.
