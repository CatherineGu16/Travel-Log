<!-- Part of the Travel Log plan; index: docs/plan/README.md -->
# Data: what is stored, and what is worked out

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
world-cities.json     { countries: {code: name}, cities: [name, region, country, lat, lng, population] }
                      for ~29,000 cities over 15,000 people outside the US (GeoNames), biggest
                      first; offline place search and naming a pin dropped abroad
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
             start: { name, lat, lng } | null,  // where it started and ended: a copy of Home when made
             startMode, endMode,             // leg modes from the start to the first place and back (flight by default)
             startVia, endVia,               // bends on the way there and back (not for a flight)
             companions: [personId],         // people who went, one by one
             hikes: [ { parkId,              // hikes done on this trip
                        hikeId | null,       // from park-hikes.json, or null for a custom hike
                        name,                // trail name (custom hikes type their own)
                        date | null } ],
             description, highlights,        // short summary; favorite moments
             rating | null,                  // 1–5
             tags: [],                       // "camping", "Family"… (earlier group tags became tags by name)
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
          createdAt, updatedAt, deleted? } | null,
  profile: { id: "profile", name,             // You → Edit profile; older files have none (null)
             avatar: { kind, color, emoji, photoUpdatedAt },   // like a person's; photo at avatars/profile.webp
             createdAt, updatedAt } | null
}
```

Leg modes (`legMode`): `"drive" | "flight" | "train" | "cruise" | "boat" | "walk" | "unknown"`,
or null for "use the guess". Trips saved with the old trip-level `travelMode` are converted when
read: a road trip's legs become drives and it's marked as driven from home, a flight trip as
flown from home, and a cruise's legs become cruises. Trips saved before trips kept their own
`start` have none: they follow Home until Home is changed or cleared, when the old Home is copied
onto them (a normal edit, so it syncs). With no Home yet, they start at the first one you set.

**Avatar photos** (`travel-data/avatars/`, optional):

```
avatars/{personId}.jpg      square, 256 px, ~15–25 KB, re-encoded in the browser (no EXIF/GPS).
                            JPEG rather than WebP: iPhone Safari can't encode WebP from a canvas
```

Most people can just use an initials or emoji avatar, which is stored in `travel.json` and needs
no file. A photo avatar is one small file per person. At ~20 KB each, even 200 people is ~4 MB.

## Derived values (computed, never stored)

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
  Right after a drive (a road trip) legs up to 500 mi are guessed as drives, so LA → Yosemite
  (~265 mi) stays a drive on a trip you drove.
- **Where a trip starts**: its own `start`, so changing Home never moves earlier trips.
- **Road trip / cruise**: every leg (including the way from and back to the start) is a drive → road
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
