<!-- Part of the Travel Log plan; index: docs/plan/README.md -->
# Roadmap

## World map (later)

What stays the same: pins, routes, stacked dates, trips, sync, `travel.json`, and the Detailed map
setting (OpenFreeMap and Photon are already worldwide).

What gets added:

| Piece | US (phase 1) | World |
|---|---|---|
| Country borders | — | Natural Earth countries (public domain), ~150 KB low detail + ~1–2 MB sharper detail as TopoJSON. Bundled and available offline |
| States / provinces | `us-states.json` | Natural Earth regions for every country, **split into one small file per country** (`regions/{CC}.json`). Loaded when you zoom into that country, then cached for offline |
| City labels, lakes, coastlines | US places + US lakes | Natural Earth populated places (~7,000 cities) and world lakes/coastlines, all small |
| Offline place search | Census Gazetteer (US) + **GeoNames cities over 15,000 people worldwide (done early)**: ~660 KB compressed, credited on the map. Places abroad have a country but no region yet: lists group them by country, and they don't count toward states | Smaller towns **split per country** and loaded on demand; regions per country |
| Zoomed-out view | **Flat map or globe** (a 🌐 toggle, remembered per device; done early). The globe zooms out to fill 75% of the screen against a starry sky | Same |
| Long routes | Short US hops | Dashed lines follow the great-circle path and cross the date line the short way (LA → Tokyo goes over the Pacific) |
| Stats | States n/50, parks n/64 | Adds **countries n/195** and regions visited per country, with visited countries shaded |
| Checklists | US national parks | Unchanged. Other lists (e.g. UNESCO World Heritage Sites) could be added as separate checklists |

**Size check.** All world map data together is roughly **20–40 MB** in the public `Travel-Log`
repo, and the biggest single file is a few MB.

- GitHub's 100 MB per-file limit: ✅ (per-country splitting keeps every file small)
- GitHub's ~1 GB recommended repo size: ✅ (the data is regenerated rarely, so history grows
  slowly)
- Pages' 1 GB site limit: ✅
- What each device downloads: only the app plus ~2–3 MB of world basics up front. Per-country
  detail downloads the first time you zoom into that country and is then cached.
- The private `travel-data` repo is unaffected. It never holds map data.

## Milestones

| # | Milestone | Done when |
|---|---|---|
| M1 ✅ | Scaffold (Vite/React/TS/Tailwind/PWA), copy Watchlist tooling, MapLibre **outline map** fitted to the US (states, lakes, city labels), build all map data | The map zooms and pans smoothly on a laptop and a phone. The parks count is verified (64) |
| M2 ✅ | Local store (IndexedDB) + **Add trip** form (destination, dates, stops, who went, Family switch) + **people & groups** (avatars, Family group shortcut) + location pins (green for parks) + preview card + state shading by trip count | You can log a multi-stop trip end to end, and it survives a reload |
| M3 ✅ | **Dotted routes** + stacked pins (×N) with date picker + place reuse and stacked visit dates + trip detail | Selecting a pin shows its route; a second trip to the same place stacks onto its pin, and picking either date shows the right route |
| M4 ✅ | **Trips list** + **Places tab**: grouping, sorting, search, Family / Not family filter shared with the map | Every trip can be found without the map, and family trips filter correctly |
| M5 ✅ | **National parks**: `park-hikes.json` (names from NPS Things To Do), map layer, All / Visited / Not visited, checklist with stacked dates, "Log a visit", auto-suggest a park link, **hikes checklist** (in the trip form and per park) | Parks show the correct visited state on the map and in the checklist, and hikes can be checked off per park |
| M6 ✅ | GitHub sync: Settings form, `travel.json` fetch/merge/save, **photo avatar** upload + download cache, status chip, `docs/ACCESS_KEY.md` | A trip and a new photo avatar added on phone appear on PC after refresh. Two-device conflict test passes |
| M7 ✅ | Offline place search, **Map detail setting** (OpenFreeMap tiles + Photon search), stats in header, Export/Import (.zip with `travel.json` + avatars) | All flows work. With the setting off, the app makes no requests except to GitHub |
| M8 ✅ | GitHub Actions deploy to Pages, Playwright E2E (desktop + phone), README | Live at `https://catherinegu16.github.io/Travel-Log/` once pushed and Pages is turned on (setup step 1) |
| Next: M9 | **Profile & achievements** (see profile-and-achievements.md): drop Places, add a You tab with stats, tiered achievements and celebrations; move People, Settings and Home into it | A trip that crosses a tier shows "🏅 Silver · …", and the profile shows earned tiers with progress to the next |
| Later: W1 | World outline data: countries, per-country regions, world cities/lakes, GeoNames search files (scripts + lazy loading + offline caching) | Zooming into any country shows its regions, offline after the first visit |
| Later: W2 | Globe view, great-circle routes across the date line, countries n/195 stat and country shading, region shading for any country | An LA → Tokyo trip draws correctly and counts Japan |
| Later | Other checklists (NPS monuments / seashores, UNESCO sites) | — |

## Open questions

None right now.

### Answered

- **Hike list**: names from the NPS Things To Do feed (the data behind nps.gov's Things To Do
  pages), with a link to each hike's page. No map lines for now.
- **People**: avatars (initials, emoji or photo; photos in the private repo) and groups, with a
  Family group shortcut.
- **State shading**: darker with more trips (1 · 2–3 · 4–6 · 7+).
- **Parks scope**: the 64 national parks only for now.
- **Family / friends trips**: groups only sort people; "Family" is an ordinary tag (earlier group
  tags on trips became tags by name).
- **Places tab**: to be dropped in favor of map pins and the profile (see profile-and-achievements.md).
