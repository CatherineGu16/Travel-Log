# Travel Log

A personal map of your trips. One pin per place you've been (green for national parks), a dotted
route through each trip's stops, dates that stack when you go back somewhere, a checklist of all 64
US national parks with their hikes, and Family / Not family filters. It installs on iPhone, iPad and
Windows, works offline, and syncs across devices through a private GitHub repo.

**Live:** <https://catherinegu16.github.io/Travel-Log/>

The full design is in [PLAN.md](PLAN.md).

## Using it

- **Add trip:** search a place (offline: your places, the national parks, ~32,000 US towns) or
  pick it on the map; add key stops in order, dates, who went (tap **+ Family** to add your Family
  group), and hikes for any park on the trip. Long-press (phone) or right-click (computer) the map
  to start a trip at that spot.
- **Map:** tap a pin to see its trip's route; places you've been more than once list every visit,
  and picking a date shows that trip. **Parks** shows all 64 parks; **Filter** narrows to Family /
  Not family, people, year or tag.
- **Trips, Places, Parks** pages list everything without the map.
- **Settings:** sync across devices, map detail, backup (.zip export/import), and theme.

## Your data

- **On each device**, everything is saved in the browser (IndexedDB) and works offline.
- **To sync**, the app saves `travel.json` and photo avatars to a **private** repo,
  `travel-data`, using a fine-grained access key that can only touch that repo. Setup is in
  Settings → Sync across devices; renewing the key is in [docs/ACCESS_KEY.md](docs/ACCESS_KEY.md).
- **This repo is public** and holds only the app and public reference data (state outlines, park
  boundaries and hikes, US towns). Never commit `travel.json` or exports here; `data/private/` is
  git-ignored for that.
- **Outside services:** none by default. The outline map, place search and label fonts are bundled.
  Turning on Settings → Map detail → **Detailed** adds OpenFreeMap tiles and Photon search, which
  see the map area you view and what you search for, never your trips or access key.

## Developing

Requires Node 22.

```sh
npm install
npm run dev        # http://localhost:5173/Travel-Log/
npm test           # unit tests (Vitest)
npm run e2e        # end-to-end tests on desktop Chrome and iPhone WebKit (Playwright)
npm run lint       # oxlint
npm run build      # typecheck + production build in dist/
npm run preview    # serve the build
```

### Bundled data

The files in `src/data/` and `public/fonts/` are built by scripts and committed. Re-run them only
when the source data changes (downloads are cached in `scripts/.cache/`, git-ignored):

```sh
npm run data:map     # states, countries, national parks + boundaries, US towns, cities, lakes, fonts
npm run data:hikes   # hike names for each park from the NPS Things To Do feed
```

`data:map` checks the NPS list of national parks against Wikipedia's and stops if they disagree
(Chiricahua became the 64th park on October 20, 2026). `data:hikes` uses the NPS API's public
`DEMO_KEY` (no account needed; set `NPS_API_KEY` to use your own) and writes a readable report to
`scripts/park-hikes-report.md`.

Sources: US Census (state outlines, Gazetteer towns), National Park Service (park boundaries, Things
To Do), Natural Earth (countries, lakes, cities), Wikipedia (park facts), Noto Sans (label fonts,
SIL OFL).

## Deploying

Pushing to `main` runs lint, unit and end-to-end tests, then publishes to GitHub Pages
(`.github/workflows/deploy.yml`). One-time setup: repo Settings → Pages → Build and deployment →
Source: **GitHub Actions**.
