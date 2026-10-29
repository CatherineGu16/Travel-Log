<!-- Part of the Travel Log plan; index: docs/plan/README.md -->
# Decisions

| Topic | Decision |
|---|---|
| Account | Free GitHub account only. No other accounts or paid services |
| App hosting | **GitHub Pages** from the **public** repo `Travel-Log` (free Pages requires a public repo). It holds code + public reference data only (state outlines, national parks list), **no personal data** |
| Personal data | **Private** repo `travel-data`: `travel.json` for trips, places, people and groups, plus an `avatars/` folder for optional people photos |
| Sync | Same as Watchlist-Tracker: the browser calls the GitHub REST API directly with a **fine-grained personal access token** limited to `travel-data`, with only *Contents: Read and write* permission |
| Login | Same Settings → **Sync across devices** form as Watchlist: GitHub username, private repo (prefilled `travel-data`), access key, device name. Same status chip, same error messages, same "refuses to sync if the data repo is public" check, and a `docs/ACCESS_KEY.md` renewal guide |
| Install | Progressive Web App: "Add to Home Screen" on iOS/iPadOS, "Install app" in Edge/Chrome on Windows |
| Offline | Local-first: IndexedDB on each device is the working copy. Changes queue and sync when online |
| Frontend | Same stack as Watchlist: React + TypeScript + Vite, Tailwind CSS, Radix UI primitives, `vite-plugin-pwa`, oxlint, Vitest, Playwright |
| Map | **MapLibre GL JS**: smooth wheel/drag/pinch zoom and pan, vector rendering, dashed route lines, scales to a world map later |
| Base map | **Outline map by default, fully bundled**: state outlines, park boundaries, lakes and major-city labels, drawn by MapLibre from files shipped with the app. No outside map service, works fully offline |
| Detailed map (optional) | A **Settings toggle, off by default**, adds **OpenFreeMap** tiles (free, no key, no account) under the outline layers for streets, terrain and labels. Only the visible map area is requested, and no token or personal data is sent. If the service is down or you're offline, the outline map shows as usual |
| Place search | **Bundled by default**: searches a built-in list of US cities and towns (Census Gazetteer, public domain), **cities over 15,000 people worldwide** (GeoNames, CC BY 4.0, credited on the map as "Place names: GeoNames") plus the national parks, entirely on the device. Biggest first; a trailing state or country narrows it ("Springdale, UT", "Lisbon, Portugal", "london uk"). When the detailed map is on, search also asks **Photon** (free, no key, OpenStreetMap data) for businesses, landmarks and addresses. Tapping or long-pressing the map drops a pin anywhere either way |
| Deploy | GitHub Actions workflow runs lint + tests, then publishes to Pages on push to `main`. Copied from Watchlist's `deploy.yml` |

## Free-account checks

- GitHub Pages on Free: public repos only. ✅ `Travel-Log` is public and contains no personal data.
- Private repos on Free: unlimited. ✅ Used for `travel-data`.
- Fine-grained tokens on Free: available, scoped to one repo. ✅
- API rate limit: 5,000 requests/hour with a token. ✅ Typical use is tens per day.
- `travel.json` size: ~1–3 KB per trip. ✅ Stays well under the 1 MB Contents API limit for
  hundreds of trips.
- Private repo size: a few MB of JSON history plus avatar photos (~20 KB each, rarely changed). ✅
- Pages limits: 1 GB site size, 100 GB/month soft bandwidth. ✅ The app plus bundled map data is a
  few MB.
- Browser access: `api.github.com` allows CORS calls with a token, so no server is needed. ✅
