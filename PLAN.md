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
  logged, or sent anywhere except `api.github.com`. It grants access to `travel-data` and, for
  sharing hikes you add, `Travel-Log` (see **Shared hike suggestions**). Use a
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

- A **trip** is the main thing you log: "Utah Parks 2023". It has an ordered list of
  **destinations**, the places it went in visit order. Any number of them can be **main
  destinations**; the rest are stops along the way. Each destination can have its **own dates**
  ("3 days in Zion, then 3 in Las Vegas"), and a note.
- **Legs**: the stretch between two destinations is a **leg**, traveled by drive, flight, train,
  cruise, ferry, walk, or "not sure". It's guessed from the straight-line distance (over 250 mi is
  a flight, under is a drive) unless you pick one. There's no trip-level "how you traveled": a
  trip whose legs are **all drives is a road trip**, and a trip with **a cruise leg anywhere is a
  cruise**. Both are worked out from the legs, never stored, and only used to filter. See
  **Legs**.
- **Who went**: group tags (Family, Friends, your own groups) and individual people. Filtering and
  grouping by Family / Friends uses these tags. (An earlier Family switch and Family / Friends /
  Work type were replaced by the tags; old Family and Friends trips keep them as tags.)
- A **place** is a location you've been to: "Zion National Park", "Las Vegas". Places are shared
  between trips, so going back to the same place reuses it instead of creating a duplicate.
- **One pin per major location**: a pin goes on each place that is a main destination of at least
  one trip. A trip with two main destinations has two pins. Stops don't get their own pins; they
  only appear as part of a route.
- **Pin colors**: **national park pins are green** (the place is linked to a park). All other
  pins use the standard accent color.
- **Dotted route**: selecting a pin shows the trip's route through all its destinations in the
  order you entered them: main destinations as pins, stops as numbered dots, joined by a dashed
  line. Other pins fade back while one is selected, and the map fits the route around the pin card.
- **Shaping a route**: the line between two destinations is straight unless you shape it. In Add
  / Edit trip, "Shape the route on the map" between two places opens the map with just that leg
  (A to B); each tap adds a bend where it fits along the leg, with Undo, Straighten, Cancel and
  Done. Bends aren't places: no pins, no search, no dates. Reordering or removing destinations
  drops the bends of any leg that changed.
- **Legs**: each leg is drawn by how you went: **flights** as a dashed great-circle arc in the
  accent color, **drives, trains, cruises, ferries and walks** as a solid line (straight unless
  shaped), and **not sure** as the thin dotted line. When a trip is selected the map fits its
  destinations, not its arcs, so a long flight can run off the edge while the places stay
  readable.
- **Stacked dates**: if you've been to a major location more than once (Chicago 2018, Chicago
  2022), it stays **one pin with a ×2 badge**. Its preview card stacks each visit's dates (that
  place's own dates when you gave them), newest first, with the newest selected. **Picking a
  different date redraws the route for that trip.** Any place, including a stop, shows every visit
  date stacked on its own detail view, and the parks checklist uses the dates you were at the park,
  not the whole trip's.
- **Older data**: trips saved before destinations (a main place plus stops) are converted when
  they're loaded or synced: the main place is slotted into the stops where it adds the least
  distance, which is how the map drew those routes.

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
us-places.json        [name, state, lat, lng, population] for ~32,000 US cities, towns and CDPs
                      (Census Gazetteer + 2024 population estimates; Natural Earth fills in big
                      unincorporated places like Honolulu); offline place search, biggest first
us-cities.json        ~700 US cities with population and rank (Natural Earth), for map labels
us-lakes.json         large lakes in and around the US (Natural Earth 50m)
park-hikes.json       parkId → [ { id, name, npsUrl, difficulty, distanceMi, distanceSource,
                                   duration } ]
                      each park's day hikes from its nps.gov hiking pages, with the nps.gov
                      link, difficulty (Easy / Moderate / Strenuous), distance and time where
                      NPS states them
public/fonts/         Noto Sans label glyphs (SIL OFL), so labels render with no outside request
```

`scripts/build-map-data.mjs` builds everything except the hikes. It checks the NPS boundary
service's list of parks against Wikipedia's list (location, established date and acreage, which
are plain facts) and stops if the two disagree.

**How `park-hikes.json` is built** (`scripts/build-park-hikes.mjs`, run on a laptop, never by the
app):

1. **The list is each park's own day hikes**, as its nps.gov hiking pages list them ("Day Hikes",
   "Suggested Hikes", per-area trail pages; e.g. Mount Rainier's "Trails of Mount Rainier" and its
   area pages, Grand Teton's suggested hikes, Rocky Mountain's list of hiking trails, the Smokies'
   Day Hikes A–Z). Only day hikes: backpacking routes (the Wonderland Trail), campsite paths,
   roads and bike paths are left out. These are kept in `scripts/nps-day-hikes.json`, one entry
   per park with its source pages and, for each hike, the distance (and whether it's round trip,
   one way or a loop), time and difficulty **as the page states them**, null where it doesn't.
   The pages are laid out differently in every park (tables, lists, prose, PDFs), so the file was
   compiled by reading them rather than by a parser; each park's `sources` and `note` say where
   everything came from and what was left out.
   A park can instead name its hiking page under **`listingPages`** (Acadia does): many nps.gov
   pages load their hike lists in the browser from nps.gov's search, so the script runs those same
   searches (on the page and on the park's hiking pages it links to), reads each hike's own page
   for the distance it states ("Distance: 2.7 miles round trip"), and also picks up trails written
   as a heading plus a paragraph starting with the distance (Acadia's Schoodic trails). Pages are
   cached in `scripts/.cache/nps-pages/`; `--refresh` reads them again.
   Then every park's trails in **NPS's trail database** (the trail cards on park pages, from
   `home.nps.gov/customfields/trail_selector/getTrails.cfm?site_code=…`; 13 parks have some, e.g.
   Acadia 26, Rocky Mountain 50) join its list with their difficulty, length, route type and time.
   A trail with the same name as a listed hike fills in what the listing leaves out; one whose name
   contains a listed hike's name ("Chasm Lake Trail from Longs Peak Trailhead") isn't added.
   **Distances are shown as NPS states them**: "3.9 mi one way" (a point-to-point trail),
   "0.3 mi loop", "2.7 mi round trip", or just "1.1 mi" when it doesn't say (out-and-back trails in
   the trail database are sometimes one way, sometimes round trip).
2. The NPS **Things To Do** feed (the entries behind nps.gov/thingstodo pages, read with the
   public `DEMO_KEY`, cached) adds a link, difficulty and time to the hike it's about, matched by
   name, where the list leaves them out. Things To Do hikes that aren't on the park's list are
   left out (named in the report). NPS content is US-government public domain.
3. **Distances are only NPS's.** A hike whose page gives no full distance has none (Angels
   Landing's page gives only the 0.5 mi chain section, so it shows none) rather than a guess.
4. Parks whose pages list no day hikes (Dry Tortugas, Gates of the Arctic, Gateway Arch, Kobuk
   Valley) have an empty entry with a note, and list none. A park missing from the file would fall
   back to the named trails on the official **NPS trails map** (`NPS_Public_Trails`), with
   OpenStreetMap lengths marked "≈"; none does today.
5. Hikes with an nps.gov page are listed first, then the rest A–Z.
6. Write the list, plus `scripts/park-hikes-report.md` with every park's hikes, sources and
   counts, and **`scripts/park-hikes.csv`**, the same list as a spreadsheet (park, hike, distance,
   time, difficulty, nps.gov page), and commit them to the public repo.

Hikes aren't drawn on the map.

**Coverage.** The current list has **1,402 day hikes** across 60 parks, most with an NPS
distance. Dry Tortugas, Gates of the Arctic, Gateway Arch and Kobuk Valley list none. Custom hikes
cover the gaps. To refresh a park, re-read its pages and update its entry in
`scripts/nps-day-hikes.json`.

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
             destinations: [ { placeId,      // in visit order
                               isMain,       // main destinations get pins; at least one per trip
                               startDate | null, endDate | null,   // this place's own dates
                               note,
                               via: [[lng, lat]],       // bends in the route from the previous destination
                               legMode | null } ],      // how you got here from the previous one; null = guessed
             fromHome,                       // drove from home and back: drives at both ends, always drawn
             returnSameWay,                  // came back through the same stops in reverse (2+ stops)
             companions: [personId],         // people who went, one by one
             companionGroupIds: [groupId],   // groups tagged as a whole ("Friends")
             hikes: [ { parkId,              // hikes done on this trip
                        hikeId | null,       // from park-hikes.json, or null for a custom hike
                        name,                // trail name (custom hikes type their own)
                        date | null } ],
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
              isFamily,                      // only the built-in "Family" group; "Friends" is also built in
              createdAt, updatedAt, deleted? } ],
  home: { id: "home", name, lat, lng,        // Settings → Home; legs to and from it are optional per trip
          createdAt, updatedAt, deleted? } | null
}
```

Leg modes (`legMode`): `"drive" | "flight" | "train" | "cruise" | "boat" | "walk" | "unknown"`,
or null for "use the guess". Trips saved with the old trip-level `travelMode` are converted when
read: a road trip's legs become drives and it's marked as driven from home, and a cruise's legs
become cruises. (A single-stop "Flight" trip has no legs left to say so.)

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
- **Shared hike suggestions**: after each sync, hikes you typed in yourself (not picked from a
  suggestion, and not already suggested) are added to `src/data/added-hikes.json` in the public
  `Travel-Log` repo, **name and park only** (no dates, trips or people), using the same access
  key. The next deploy bundles them, so they're suggested on every device. Each device remembers
  what it has shared and doesn't ask again. If the key can't write to `Travel-Log`, your own sync
  still works and Settings says why. The repo is taken from the build (`GITHUB_REPOSITORY`).
- **Correcting the NPS suggestions** (owner only): in a park's page, **Correct the NPS hike info**
  lists the park's NPS hikes with Edit: name, distance, time, difficulty, or **Don't suggest this
  hike**. A correction is a `hikeEdits` record in your private data (synced, with Undo; resetting
  it goes back to NPS's values) and shows at once. After each sync the corrections are written to
  `src/data/hike-edits.json` in the public repo, so every device sees them after the next deploy.
  Per hike, the newer of the published correction and your own wins.
  **Only the public repo's owner (CatherineGu16) adds to it**: the app only tries when the sync
  username is the repo's owner, and GitHub itself refuses writes from anyone else's key, so a
  stranger using the site just syncs their own private repo.
- **National park pin**: the pin's place has a `parkId`.
- **A leg's mode**: the mode you picked; else the mode you last picked for the same two places on
  any trip (either direction); else over 250 mi straight-line is a flight, under is a drive.
- **Road trip / cruise**: every leg (including the drives from and back to home) is a drive → road
  trip; any leg is a cruise → cruise (a cruise wins over a road trip). A trip with no legs is
  neither.
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
  - **With**: groups (Family, Friends, …) and people, plus year, tag and how you traveled.
  - **National parks layer** (the Parks button on the map, remembered per device): Off · All ·
    Visited · Not visited. All 64 parks show as small tree badges (so they don't look like trip
    pins). Visited parks are filled green (with a shaded boundary when zoomed in); not-yet-visited
    parks are gray, with a dashed outline when zoomed in. Tapping a badge opens that park. A segmented
    control switches between **All · Visited · Not visited**, with a **"14 / 64 parks"** progress
    line.
  - Year and tag.
- **Add trip**: the colored **+** circle in the center of the navigation, always visible.

### Add / edit trip

A **three-step stepper**, so trip details and mapping out the route are on separate pages: **1.
Details** (title, dates, who went), **2. Route** (destinations in order, the leg between each pair,
driving from home, coming back the same way), **3. Notes** (hikes, description, highlights, rating, tags). Back and
Next keep everything; Save works from the Route step on, since Notes is optional. Editing a trip
opens the same steps with tabs to jump straight to one.

- **Where you went**: add destinations in order: search a place (your places and parks first, then
  cities and towns, **biggest first**; towns near the trip's main destination come first; plus
  landmarks and addresses when the detailed map is on). Long-press (or right-click) the map to
  start a trip at that spot. Picking a place you've been to before reuses it, so the new dates
  stack onto it. A dropped pin gets its state from the bundled outlines and its nearest town from
  the bundled places list, and can be renamed. (There's no "Pick on map" in the form: a tap can't
  place a spot exactly, so tapping the map is used to shape routes instead.)
  - Each place has a **Main / Stop** pill: Main places get a pin on the map, stops get a number
    on the route. Tap it to switch. The first place starts as Main, and a trip keeps at least one.
  - Each destination can have **its own dates** ("I know when I was here", as a date range) and a
    note. On a new trip, these fill in the trip's start and end until you set those yourself.
  - A place inside a national park offers to be linked to the park ("This is inside Zion National
    Park. Count it as a visit?").
  - Move up / down, remove.
  - Between two destinations, a **leg row**: a small rail (solid for ground, dashed for flights),
    the mode with its icon, the straight-line distance, "guessed" until you pick one, and a tap
    target of at least 44 px that opens a one-step mode picker. Ground legs also have **"Shape the
    route on the map"** (see Shaping a route); this is how a drive follows the real road, since
    the app uses no routing service.
  - **Drove from home and back** (when Home is set in Settings; off by default): adds a drive from
    home to the first place and one back home at the end, always drawn on the map. Home legs only
    exist on trips you drove from home, so they're always drives (no mode picker, no guess), and a
    single-stop drive from home counts as a road trip. Fly-in trips just leave it off.
  - **Came back the same way** (two or more places; chosen over reusing bends automatically): the
    trip returns from the last place through the same places in reverse, with the same bends and
    modes, without listing them twice. One row in the Route step ("↩ Back the same way · 470 mi")
    and "↩ same way back" on the pin card. Not drawn again on the map, since it runs over the way
    there. With "Drove from home", the way home starts from the first place.
- **Trip dates**: a **date range picker**: tap the first day, then the last, on a calendar (Date),
  a month grid (Month) or a year grid (Year). The month and year menus above the calendar jump to
  any date. Plus "Dates are approximate".
- **Title** (suggested from the main destinations and year, e.g. "Zion & Las Vegas 2024").
- **Hikes**: for every national park on the trip, the hikes you did there, added with the same
  **Add a hike** search box and suggestions as the park page (no checklist).
- **Who went**:
  - **Group tags**: **+ Family**, **+ Friends** (both built in) or any group you create adds the
    group as a tag **plus each of its members** (so "+ Family" tags Family and adds your family,
    and you remove anyone who didn't come). A group with no members, like Friends usually is, is
    just the tag, so you don't have to add each friend. Removing the tag removes the members it
    added. Everyone in a tagged group counts as on the trip for filters.
  - Individual people (optional): search by name, or **add a new person** (name, avatar, and which
    groups they belong to) without leaving the form.
- Optional: description, highlights, rating, tags.
- Save, then the map flies to the new pin and shows its route.
- **On phones**, while the on-screen keyboard is open the form fills exactly the visible part of the
  screen (iPhone Safari pans the page when you tap a field) and scrolls on its own, so the title
  and first field stay in view. The Add trip / Cancel buttons hide until the keyboard closes.

### Trips list (non-map)
- Every trip in a plain, scrollable list: title, main destination, dates, stops count, who went,
  a Family badge on family trips.
- **Group by**: Year (default, newest first) · State · Who went (Family, Friends, …, Other).
- **Sort**: Newest · Oldest · Title · Rating.
- **Who-went filter**: Family, Friends, other groups or people, same as the map. Filters are shared with the map
  and remembered per device, as in Watchlist.
- **Search** across title, places, description, people, groups and tags.
- **No travel-mode chip on rows** (here or on pin cards). Instead the Filter sheet has **Road
  trip** (every leg a drive), **Flight** (any leg a flight) and **Cruise** (any leg a cruise).
- Tapping a row opens the trip detail and highlights its route on the map.

### Places tab
- Every place you've been to, A–Z or by state, with a visit count. Opening a place shows its
  **stacked visit dates**, each linked to its trip.

### National parks checklist
- All 64 national parks as a checklist, A–Z or by state, with Visited / Not visited / All and a
  "14 / 64" progress bar.
- Visited parks show every visit date stacked (newest first) with links to the trips.
- **Hikes**: not a checklist. Each park row shows how many hikes you've done ("3 hikes").
  Opening a park shows **Hikes you've done**, each with its dates (stacked if done more than
  once), trip, NPS facts and link when it came from the NPS list, and Remove. **Add a hike** is a
  search box with suggestions: hikes you've done there before, then hikes added to the shared
  list, then the park's NPS day hikes with distance and time; or add exactly what you typed.
  Adding asks which trip it belongs to when you've been more than once.
- Unvisited parks have **"Log a visit"**, which opens Add trip with the park prefilled as the main
  destination.

### Trip detail
- Title, dates, who went, Family badge, Road trip / Cruise label when it is one, the route stop by stop with each leg's mode and distance between stops (each with its own dates and note,
  and "Also here" chips for every other visit to that place, which open those trips), hikes, description, highlights, and Edit and Delete with Undo.

### Header, navigation, settings
- **Header**: states n/50 and parks n/64 progress, trips this year (on wide screens), and the sync
  status chip (a colored dot on phones).
- **Navigation**: Map · Trips · **+** · Places · Parks, kept in the URL hash so Back works. **Add
  trip** is a large colored circle in the center: raised above the bottom tab bar on phones, in the
  middle of the header's page links on wider screens.
- **Settings**: Sync across devices (same as Watchlist), **Home** (pick your town from the bundled
  place search; synced in `travel.json`; trips can be marked as driven from it), **Map detail** (Outline · Detailed, with a
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
| M7 ✅ | Offline place search, **Map detail setting** (OpenFreeMap tiles + Photon search), stats in header, Export/Import (.zip with `travel.json` + avatars) | All flows work. With the setting off, the app makes no requests except to GitHub |
| M8 ✅ | GitHub Actions deploy to Pages, Playwright E2E (desktop + phone), README | Live at `https://catherinegu16.github.io/Travel-Log/` once pushed and Pages is turned on (setup step 1) |
| Later: W1 | World outline data: countries, per-country regions, world cities/lakes, GeoNames search files (scripts + lazy loading + offline caching) | Zooming into any country shows its regions, offline after the first visit |
| Later: W2 | Globe view, great-circle routes across the date line, countries n/195 stat and country shading, region shading for any country | An LA → Tokyo trip draws correctly and counts Japan |
| Later | Other checklists (NPS monuments / seashores, UNESCO sites) | — |

## Your setup steps (at M6/M8, with step-by-step help)

1. Make this repo, `Travel-Log`, **public** on GitHub and turn on Pages (Settings → Pages →
   Source: GitHub Actions). Check that it holds no personal data first.
2. Create the **private** repo `travel-data` (empty).
3. Create a fine-grained token: Settings → Developer settings → Fine-grained tokens → name it
   `Travel Log app` → Repository access: *Only select repositories* → `travel-data` and
   `Travel-Log` (the second only for sharing hikes you add) → Permissions: *Contents: Read and
   write* → pick an expiration date.
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
- **Family / friends trips**: marked with Family / Friends tags under Who went (replaced an earlier
  Family switch, then a Family / Friends / Work type).
