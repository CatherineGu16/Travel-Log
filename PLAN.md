# Travel Log — Plan

A personal web app for logging trips on an interactive map. Each **major location** gets **one
pin**. National park pins are a different color. Selecting a pin draws a **dotted route** through
the stops of that trip. If you've been somewhere more than once, the pin **stacks the dates**, and
picking a date shows that trip's route. An **Add trip** button records the destination, dates, key
stops and who went. Trips can be filtered by **family vs not family**. A **US national parks
checklist** tracks which of the 64 parks you've been to and **which hikes** you've done in each.
The app installs on iPhone, iPad and Windows, works offline, and syncs across devices through a private GitHub repo, the same way as Watchlist-Tracker.

Phase 1 covers the United States. The data model is world-ready (ISO country and region codes on
every place), so the map can expand to the whole world later without converting any saved trips.
See **World map (later)**.

**No trip photos.** The app stores text and locations, plus optional small avatar photos for
people, which keeps sync simple and the private repo tiny.

## Decisions

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
| Place search | **Bundled by default**: searches a built-in list of US cities and towns (Census Gazetteer, public domain) plus the national parks, entirely on the device. When the detailed map is on, search also asks **Photon** (free, no key, OpenStreetMap data) for businesses, landmarks and addresses. Tapping or long-pressing the map drops a pin anywhere either way |
| Deploy | GitHub Actions workflow runs lint + tests, then publishes to Pages on push to `main`. Copied from Watchlist's `deploy.yml` |

### Free-account checks

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

## Privacy and security

Same rules as Watchlist-Tracker, plus map rules:

- **Strangers** who open the site get an empty map with public data only (states, national
  parks). They cannot see your trips without your token.
- **The token** is stored only in the device's local storage for this site. It is never committed,
  logged, or sent anywhere except `api.github.com`. It only grants access to `travel-data`. Use a
  **separate token from Watchlist's**, so revoking one doesn't break the other.
- **Outside map requests: none by default.** The outline map and place search run entirely from
  bundled files. Only when you turn on the detailed map does the app contact OpenFreeMap (tiles)
  and Photon (search). They see which area you're viewing or what you typed into search, but
  never your token or trips.
- **Hardening**: strict Content Security Policy:
  `connect-src 'self' https://api.github.com https://tiles.openfreemap.org https://photon.komoot.io`
  (the two map domains are allowed so the optional setting can work, but the app never calls them
  while it's off),
  `img-src 'self' data: blob:` (blob: for avatar photos), and `worker-src 'self' blob:` (MapLibre needs this). No analytics, ads or
  third-party scripts. Fonts and libraries are bundled at build time.
- **Lost device / expired token**: same as Watchlist. Revoke or regenerate the token. Nothing is
  lost. Local data is kept and merges back once reconnected.
- **Avatar photos are never public.** They live in the private repo, are downloaded with the
  token and shown from local blob URLs, and are re-encoded before upload, which strips EXIF and
  GPS data.
- **Repo hygiene**: `data/private/` is git-ignored for any local exports.

## How trips, pins and places fit together

- A **trip** is the main thing you log: "Utah Parks 2023". It has one **main destination** and an
  ordered list of **stops** (key destinations).
- A **place** is a location you've been to: "Zion National Park", "Las Vegas". Places are shared
  between trips, so going back to the same place reuses it instead of creating a duplicate.
- **One pin per major location**: a pin goes on each place that is the main destination of at
  least one trip. Stops don't get their own pins; they only appear as part of a route.
- **Pin colors**: **national park pins are green** (the main destination is linked to a park).
  All other pins use the standard accent color.
- **Dotted route**: selecting a pin shows the trip's stops as small numbered dots joined by a
  dashed line, in visit order. The main destination (the pin) is slotted into the route where it
  adds the least distance, since the form doesn't ask where it falls in the order. Other pins fade
  back while one is selected, and the map fits the route around the pin card.
- **Stacked dates**: if you've been to a major location more than once (Chicago 2018, Chicago
  2022), it stays **one pin with a ×2 badge**. Its preview card stacks each visit's dates, newest
  first, with the newest selected. **Picking a different date redraws the route for that trip.**
  Any place, including a stop, shows every visit date stacked on its own detail view.

## Data split

**Public reference data** (shipped with the app, `src/data/`). Facts about places, not about you.

```
us-states.json        TopoJSON state + territory outlines (us-atlas / US Census, public domain),
                      tagged with ISO 3166-2 codes ("US-CA")
world-countries.json  TopoJSON country outlines (Natural Earth 50m, public domain), so Canada and
                      Mexico show as land; reused by the world map later
national-parks.json   id, name, fullName, npsCode, states[], lat, lng, established, areaAcres
park-boundaries.json  TopoJSON park boundaries (NPS Land Resources Division, public domain),
                      simplified, ~300 KB; used for the parks layer and park auto-suggest
us-places.json        [name, state, lat, lng] for ~32,000 US cities, towns and CDPs (Census
                      Gazetteer, public domain); used for offline place search
us-cities.json        ~700 US cities with population and rank (Natural Earth), for map labels
us-lakes.json         large lakes in and around the US (Natural Earth 50m)
park-hikes.json       parkId → [ { id, name, npsUrl } ]
                      the names of the hikes each park lists in its nps.gov "Things To Do",
                      each with a link to its nps.gov page (names only; hikes aren't on the map)
public/fonts/         Noto Sans label glyphs (SIL OFL), so labels render with no outside request
```

`scripts/build-map-data.mjs` builds everything except the hikes. It checks the NPS boundary
service's list of parks against Wikipedia's list (location, established date and acreage, which
are plain facts) and stops if the two disagree.

**How `park-hikes.json` is built** (`scripts/build-park-hikes.mjs`, run on a laptop, never by the
app):

1. Read every park's entries from the official NPS **Things To Do** feed, the same entries shown
   on nps.gov/thingstodo pages, and keep the ones tagged as hiking. The feed is read with the
   public `DEMO_KEY`, which needs no NPS account (about 10 requests an hour, so all parks are
   fetched in a few batched requests and cached). NPS content is US-government public domain.
2. Drop general overview pages ("Hiking in Yosemite", "Day Hikes") and tidy names ("Hike Beehive
   Loop" → "Beehive Loop").
3. Sequoia and Kings Canyon share one NPS code; their hikes are split by park boundary.
4. Write the list, plus `scripts/park-hikes-report.md` with every park's hikes and counts, and
   commit both to the public repo. Re-run it whenever you want a fresh list.

Hikes are **names only** for now: no trail lines or locations on the map. Matching them to
OpenStreetMap trails (for a map line and length) is a possible later addition.

**Coverage is uneven.** The current list has **628 hikes**. How many a park has depends on how
much that park has put into NPS Things To Do: Yellowstone has 55 and Acadia 51, while 13 parks
list none yet (including Grand Canyon, Yosemite, Canyonlands and Crater Lake). Custom hikes cover
the gaps, and re-running the script picks up anything parks add later.

There are **64 national parks**. Chiricahua (Arizona) became the 64th on October 20, 2026; the
NPS boundary service still files it as a monument, so the build script adds it by code. Other NPS
units (monuments, seashores, historic sites — 400+ total) could be added later as a second list.

**Private data** (`travel-data/travel.json`):

```
{
  schemaVersion: 1,
  updatedAt,
  trips: [ { id,
             title,                          // "Utah Parks 2023"
             startDate, endDate | null,      // partial ISO, same as Watchlist: "2019" | "2019-07" | "2019-07-04"
             approximate,
             mainPlaceId,                    // where the trip's pin goes
             stops: [ { placeId,             // key destinations, in visit order
                        startDate | null, endDate | null,   // optional per-stop dates
                        note } ],
             companions: [personId],         // who went
             hikes: [ { parkId,              // hikes done on this trip
                        hikeId | null,       // from park-hikes.json, or null for a custom hike
                        name,                // trail name (custom hikes type their own)
                        date | null } ],
             isFamily,                       // Family trip or not (one switch)
             description, highlights,        // short summary; favorite moments
             rating | null,                  // 1–5
             tags: [],
             createdAt, updatedAt, deleted? } ],   // deleted = tombstone for sync merges
  places: [ { id, name,                      // "Zion National Park"
              lat, lng, city,
              countryCode,                   // ISO 3166-1: "US" (only "US" in phase 1)
              regionCode,                    // ISO 3166-2: "US-CA", later "CA-BC", "JP-13"
              parkId | null,                 // links to a national park; auto-suggested from coordinates
              createdAt, updatedAt, deleted? } ],
  people: [ { id, name,
              avatar: { kind: "initials" | "emoji" | "photo",
                        color,               // background color
                        emoji | null,        // when kind = "emoji"
                        photoUpdatedAt | null },  // when kind = "photo": avatars/{id}.jpg
              createdAt, updatedAt, deleted? } ],
  groups: [ { id, name,                      // "Family", "College friends", "Work team"
              memberIds: [personId],
              isFamily,                      // exactly one group, "Family", has this; created by default
              createdAt, updatedAt, deleted? } ]
}
```

**Avatar photos** (`travel-data/avatars/`, optional):

```
avatars/{personId}.jpg      square, 256 px, ~15–25 KB, re-encoded in the browser (no EXIF/GPS).
                            JPEG rather than WebP: iPhone Safari can't encode WebP from a canvas
```

Most people can just use an initials or emoji avatar, which is stored in `travel.json` and needs
no file. A photo avatar is one small file per person. At ~20 KB each, even 200 people is ~4 MB.

### Derived values (computed, never stored)

- **Visits to a place**: every non-deleted trip where it is the main place or a stop, with that
  trip's (or stop's) dates. This is the stacked date list.
- **State visited**: at least one visited place with that `regionCode` (`US-CA`, ...). The same
  rule gives provinces and regions in other countries once the world map lands.
- **National park visited**: at least one visited place with that `parkId`. When you add a place
  that falls inside a park boundary, the app suggests linking it ("Is this Yosemite National
  Park?").
- **Hikes done in a park**: every hike across all non-deleted trips with that `parkId`. Doing the
  same trail on two trips stacks both dates on it.
- **National park pin**: the pin's place has a `parkId`.
- **The built-in Family group** is stamped at the epoch, so a new device's empty copy never wins a
  sync merge over a Family group edited on another device.
- **Family trip**: `isFamily === true`. When you pick who went, the form turns the Family switch on
  if anyone in the Family group is on the trip, and you can turn it off.
- **State shading level**: number of trips that visited the state, bucketed into 1 · 2–3 · 4–6 ·
  7+ (each step a darker shade).
- **Counts**: states visited (n/50), parks visited (n/64), trips per year, family vs other trips,
  top companions.

## Sync design

Same engine as Watchlist-Tracker (`src/sync/`).

1. **On open / on focus / on reconnect**: `GET .../contents/travel.json`. Merge it into the local
   copy and remember the file's `sha`.
2. **On change**: apply locally right away (IndexedDB), then debounce ~3 s and
   `PUT .../contents/travel.json` with the last known `sha`. Quick edits are batched into one
   commit.
3. **Conflict** (409/422 because another device saved first): re-fetch, merge, retry. Merges go
   record by record (`id` + `updatedAt`) for trips, places, people and groups, with tombstones
   for deletes.
   Unsynced edits are tracked with a flag, as in Watchlist.
4. **Avatar photos**: uploaded with a single `PUT .../contents/avatars/{id}.jpg` **before** the
   `travel.json` that points to them, so another device never sees a photo avatar without its
   file. Downloaded once per device and cached in IndexedDB. Replacing a photo overwrites the
   file and bumps `photoUpdatedAt`. Until a photo has downloaded, the initials avatar shows.
   On the device, photos are kept in IndexedDB as bytes (Safari won't store Blobs there in private
   browsing).
5. **Offline**: edits and avatar uploads stay queued and push when the connection returns.
6. **Status chip** in the header: Synced / Saving / Syncing / Offline / Sync problem.
7. **First-time setup** (once per device): Settings → Sync across devices → username, repo, key,
   device name. If `travel.json` doesn't exist, the app creates it from the local data.
8. **Without a token**, the app still works fully on that one device and offers Export/Import
   (a .zip with `travel.json` + avatar photos).

## UI

### Map view (home)
- Full-screen **outline map** (states, park boundaries, lakes, major-city labels) that opens fitted
  to the continental US, with quick-jump buttons for Alaska and
  Hawaii, plus zoom +/- and "Reset to US".
- **Visited states shaded darker by number of trips** (1 · 2–3 · 4–6 · 7+), with a small legend.
  Hover (desktop) or tap (mobile) shows the state name and trip count.
- **Location pins**, one per major location (×N badge when visited more than once), clustered
  when zoomed out. **Green pins are national parks**; all others use the accent color. A small
  legend explains the colors.
- Tapping a pin opens a **preview card** with the place name and its **stacked visit dates**. The
  newest visit is selected and its **dotted route** is drawn. Tapping another date switches the
  card (title, who went, stops, hikes) and redraws the route for that trip.
- **Filter button**:
  - **Who**: All · Family · Not family, plus filter by person or group.
  - **National parks layer** (the Parks button on the map, remembered per device): Off · All ·
    Visited · Not visited. All 64 parks show as small tree badges (so they don't look like trip
    pins). Visited parks are filled green (with a shaded boundary when zoomed in); not-yet-visited
    parks are gray, with a dashed outline when zoomed in. Tapping a badge opens that park. A segmented
    control switches between **All · Visited · Not visited**, with a **"14 / 64 parks"** progress
    line.
  - Year and tag.
- **Add trip** button ("+"), always visible.

### Add / edit trip
- **Title** (suggested from the destination and year, editable).
- **Main destination**: search a place (cities, towns and parks from the bundled list, plus
  landmarks and addresses when the detailed map is on), or tap/long-press the map. A dropped pin
  gets its state (`regionCode`) from the bundled outlines and its nearest town from the bundled
  places list. Picking a place you've been to before reuses it, so the new dates stack onto it.
- **Dates**: start and end (exact / month / year / approximate, as in Watchlist).
- **Key destinations**: add stops in order, each with optional dates and a note. Drag to reorder.
  The route is drawn on the main map once the trip is saved.
- **Hikes**: shown when the main destination or any stop is a national park. Check off trails
  from that park's list, or add a custom hike by name. An optional date per hike.
- **Who went**: shown as avatar chips.
  - **Group shortcuts** at the top: tapping **Family** (or any group) adds everyone in it at once.
    Tap a chip's × to drop anyone who didn't come.
  - Search people by name to add individuals, or **add a new person** (name, avatar, and which
    groups they belong to) without leaving the form.
- **Family trip** switch, turned on automatically when anyone from the Family group is added.
- Optional: description, highlights, rating, tags.
- Save, then the map flies to the new pin and shows its route.

### Trips list (non-map)
- Every trip in a plain, scrollable list: title, main destination, dates, stops count, who went,
  a Family badge on family trips.
- **Group by**: Year (default, newest first) · State · Family / Not family.
- **Sort**: Newest · Oldest · Title · Rating.
- **Family filter**: All · Family · Not family, same as the map. Filters are shared with the map
  and remembered per device, as in Watchlist.
- **Search** across title, places, description, people, groups and tags.
- Tapping a row opens the trip detail and highlights its route on the map.

### Places tab
- Every place you've been to, A–Z or by state, with a visit count. Opening a place shows its
  **stacked visit dates**, each linked to its trip.

### National parks checklist
- All 64 national parks as a checklist, A–Z or by state, with Visited / Not visited / All and a
  "14 / 64" progress bar.
- Visited parks show every visit date stacked (newest first) with links to the trips.
- **Hikes**: each park row shows "Hikes 3 / 12". Opening a park lists its trails as a checklist.
  Trails you've done show their dates (stacked if done more than once) and the trip. Checking
  off a trail asks which trip it belongs to (or starts a new one). You can also add a custom hike
  that isn't on the list.
- Unvisited parks have **"Log a visit"**, which opens Add trip with the park prefilled as the main
  destination.

### Trip detail
- Title, dates, who went, Family badge, the route stop by stop (each with its own dates and note,
  and "Also here" chips for every other visit to that place, which open those trips), hikes, description, highlights, and Edit and Delete with Undo.

### Header, navigation, settings
- **Header**: states n/50 and parks n/64 progress, trips this year, and the sync status chip.
- **Navigation**: Map · Trips · Places · Parks, kept in the URL hash so Back works. A bottom tab bar
  on phone (with Add trip), page links in the header on wider screens.
- **Settings**: Sync across devices (same as Watchlist), **Map detail** (Outline · Detailed, with a
  note that Detailed contacts OpenFreeMap and Photon), People & groups (see below),
  Export/Import, theme.

### People & groups
- **People**: a grid of avatar cards. Tap one to edit their name and avatar, see their groups, and
  see every trip they were on (with a count and their states/parks).
- **Avatar editor**: pick **initials** (auto from the name) or an **emoji**, choose a background
  color, or **add a photo** (camera roll / file picker, cropped to a circle in the app).
- **Groups**: create, rename and delete groups and add or remove members. A **Family** group
  exists from the start and drives the Family shortcut and turns on the Family trip switch. A
  person can be in several groups.

### Responsive
- **Phone (≤640px)**: full-screen map, bottom tab bar, and bottom sheets for previews, details and
  forms. Pinch to zoom, drag to pan, double-tap to zoom.
- **iPad / desktop**: the detail panel slides in from the right over the map. Lists use a single
  centered column, as in Watchlist. Wheel to zoom, drag to pan, double-click to zoom.
- Tap targets ≥44px, no horizontal scroll at 360px, iOS safe areas respected.
- **Theme**: follows the system setting, with light and dark map styles to match (for both the
  outline and detailed maps).

## World map (later)

What stays the same: pins, routes, stacked dates, trips, sync, `travel.json`, and the Detailed map
setting (OpenFreeMap and Photon are already worldwide).

What gets added:

| Piece | US (phase 1) | World |
|---|---|---|
| Country borders | — | Natural Earth countries (public domain), ~150 KB low detail + ~1–2 MB sharper detail as TopoJSON. Bundled and available offline |
| States / provinces | `us-states.json` | Natural Earth regions for every country, **split into one small file per country** (`regions/{CC}.json`). Loaded when you zoom into that country, then cached for offline |
| City labels, lakes, coastlines | US places + US lakes | Natural Earth populated places (~7,000 cities) and world lakes/coastlines, all small |
| Offline place search | Census Gazetteer (US) | GeoNames (CC BY 4.0, needs a "data from GeoNames" credit in About): cities over 15,000 people bundled (~1 MB compressed); smaller towns **split per country** and loaded on demand |
| Zoomed-out view | Flat map | MapLibre **globe projection** when zoomed out, flat when zoomed in |
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

## Project structure

Matches Watchlist-Tracker's layout.

| Path | What |
|---|---|
| `src/data/` | `us-states.json`, `world-countries.json`, `national-parks.json`, `park-boundaries.json`, `us-places.json`, `us-cities.json`, `us-lakes.json`, `park-hikes.json` (public) |
| `scripts/` | `build-map-data.mjs` (states, countries, parks, boundaries, places, cities, lakes, label fonts) and `build-park-hikes.mjs` (hike names from NPS Things To Do). Run once, or when the data changes. Downloads are cached in `scripts/.cache/` (git-ignored) |
| `src/lib/` | Avatar image resize/crop, partial dates, visit stacking, derived counts, park and state matching (point in polygon), offline place search, merging |
| `src/store/` | IndexedDB store, undo |
| `src/sync/` | GitHub sync for `travel.json` and avatar photos |
| `src/map/` | MapView, outline style + optional tile style, layers (states, lakes, city labels, parks, location pins, stop dots, dashed routes), controls |
| `src/components/`, `src/ui/` | Trip form, lists, detail, parks checklist, people & groups, avatar editor, sheets, settings |
| `docs/ACCESS_KEY.md` | Renewing the access key (adapted from Watchlist) |
| `e2e/` | Playwright tests, desktop Chrome + iPhone WebKit |
| `.github/workflows/deploy.yml` | Test and deploy to Pages |

Shared code from Watchlist (partial dates, sync engine, GitHub client, Sheet, Toast, SyncPanel,
SyncChip, ThemePicker) is copied over and adapted, not shared as a package. That keeps the two
apps independent.

## Milestones

| # | Milestone | Done when |
|---|---|---|
| M1 ✅ | Scaffold (Vite/React/TS/Tailwind/PWA), copy Watchlist tooling, MapLibre **outline map** fitted to the US (states, lakes, city labels), build all map data | The map zooms and pans smoothly on a laptop and a phone. The parks count is verified (64) |
| M2 ✅ | Local store (IndexedDB) + **Add trip** form (destination, dates, stops, who went, Family switch) + **people & groups** (avatars, Family group shortcut) + location pins (green for parks) + preview card + state shading by trip count | You can log a multi-stop trip end to end, and it survives a reload |
| M3 ✅ | **Dotted routes** + stacked pins (×N) with date picker + place reuse and stacked visit dates + trip detail | Selecting a pin shows its route; a second trip to the same place stacks onto its pin, and picking either date shows the right route |
| M4 ✅ | **Trips list** + **Places tab**: grouping, sorting, search, Family / Not family filter shared with the map | Every trip can be found without the map, and family trips filter correctly |
| M5 ✅ | **National parks**: `park-hikes.json` (names from NPS Things To Do), map layer, All / Visited / Not visited, checklist with stacked dates, "Log a visit", auto-suggest a park link, **hikes checklist** (in the trip form and per park) | Parks show the correct visited state on the map and in the checklist, and hikes can be checked off per park |
| M6 ✅ | GitHub sync: Settings form, `travel.json` fetch/merge/save, **photo avatar** upload + download cache, status chip, `docs/ACCESS_KEY.md` | A trip and a new photo avatar added on phone appear on PC after refresh. Two-device conflict test passes |
| M7 | Offline place search, **Map detail setting** (OpenFreeMap tiles + Photon search), stats in header, Export/Import (.zip with `travel.json` + avatars) | All flows work. With the setting off, the app makes no requests except to GitHub |
| M8 | GitHub Actions deploy to Pages, Playwright E2E (desktop + phone), README | Live at `https://catherinegu16.github.io/Travel-Log/` |
| Later: W1 | World outline data: countries, per-country regions, world cities/lakes, GeoNames search files (scripts + lazy loading + offline caching) | Zooming into any country shows its regions, offline after the first visit |
| Later: W2 | Globe view, great-circle routes across the date line, countries n/195 stat and country shading, region shading for any country | An LA → Tokyo trip draws correctly and counts Japan |
| Later | Other checklists (NPS monuments / seashores, UNESCO sites) | — |

## Your setup steps (at M6/M8, with step-by-step help)

1. Make this repo, `Travel-Log`, **public** on GitHub and turn on Pages (Settings → Pages →
   Source: GitHub Actions). Check that it holds no personal data first.
2. Create the **private** repo `travel-data` (empty).
3. Create a fine-grained token: Settings → Developer settings → Fine-grained tokens → name it
   `Travel Log app` → Repository access: *Only select repositories* → `travel-data` →
   Permissions: *Contents: Read and write* → pick an expiration date.
4. On each device: open the site, install it, then go to Settings → Sync across devices and enter
   `CatherineGu16`, `travel-data`, the key, and a device name. On iPhone/iPad, do this **inside
   the installed app**, because its storage is separate from Safari.

## Open questions

None right now.

### Answered

- **Hike list**: names from the NPS Things To Do feed (the data behind nps.gov's Things To Do
  pages), with a link to each hike's page. No map lines for now.
- **People**: avatars (initials, emoji or photo; photos in the private repo) and groups, with a
  Family group shortcut.
- **State shading**: darker with more trips (1 · 2–3 · 4–6 · 7+).
- **Parks scope**: the 64 national parks only for now.
- **Trip type**: a single Family / Not family switch. Groups cover the rest of "who went".
