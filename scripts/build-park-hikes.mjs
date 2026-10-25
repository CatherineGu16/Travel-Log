#!/usr/bin/env node
// Builds src/data/park-hikes.json: each national park's hiking trails, from two NPS sources:
//
//  - The NPS trails map (the national NPS_Public_Trails dataset on mapservices.nps.gov): every
//    named, open, public hiking trail in the park. This is the list, so trails that have no
//    "Things To Do" page (Skyline Trail at Mount Rainier) still show up.
//  - NPS "Things To Do" (the pages behind nps.gov/thingstodo): a link, difficulty, distance and
//    time for the hikes that have a page. Matched to trails by name; a page that names a specific
//    hike but no mapped trail ("Hike to Delicate Arch" in a park with patchy trail data) is kept
//    too. Pages that aren't about one hike ("A Day In Paradise", "Spring Recreation") are not.
//
// Distance: the one NPS states on the hike's page; else the length of the same-named trail in
// OpenStreetMap (Overpass API, free, no key, one query per park), marked approximate. The length of the
// trail on the NPS map isn't used, since many parks have only parts of their trails drawn.
//
//   node scripts/build-park-hikes.mjs            uses cached downloads when present
//   node scripts/build-park-hikes.mjs --refresh  re-downloads everything
//   node scripts/build-park-hikes.mjs --no-osm   skips the OpenStreetMap distance lookups
//
// Sequoia, Kings Canyon and Gates of the Arctic have no trails in the NPS dataset, so they list
// their Things To Do hikes only.
//
// Data comes from the official NPS Things To Do feed, the entries behind nps.gov/thingstodo pages
// (developer.nps.gov). Without NPS_API_KEY it uses the public DEMO_KEY, which needs no account
// but allows only ~10 requests an hour, so all parks are fetched in a few batched requests and
// cached in scripts/.cache/.

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { feature } from 'topojson-client'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CACHE = join(ROOT, 'scripts', '.cache')
const OUT = join(ROOT, 'src', 'data', 'park-hikes.json')
const REPORT = join(ROOT, 'scripts', 'park-hikes-report.md')
const REFRESH = process.argv.includes('--refresh')
const NPS_KEY = process.env.NPS_API_KEY || 'DEMO_KEY'
const USE_OSM = !process.argv.includes('--no-osm')
const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter']

// The national parks, from src/data/national-parks.json (built by build-map-data.mjs). NPS Things
// To Do files Sequoia (sequ) and Kings Canyon (kica) together under "seki"; those hikes are split
// by which park's boundary they fall in.
const PARKS = JSON.parse(readFileSync(join(ROOT, 'src', 'data', 'national-parks.json'), 'utf8'))
const BOUNDARIES = JSON.parse(readFileSync(join(ROOT, 'src', 'data', 'park-boundaries.json'), 'utf8'))
const THINGS_TO_DO_CODE = { sequ: 'seki', kica: 'seki' }
const ttdCode = (p) => THINGS_TO_DO_CODE[p.npsCode] ?? p.npsCode

// ---------- NPS ----------

async function fetchThingsToDoFor(codes) {
  const items = []
  for (let start = 0; ; ) {
    const url = `https://developer.nps.gov/api/v1/thingstodo?parkCode=${codes.join(',')}&limit=500&start=${start}&api_key=${NPS_KEY}`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`NPS ${res.status}: ${(await res.text()).slice(0, 200)}`)
    const body = await res.json()
    // Keep only the fields used below, so the cache stays small.
    for (const t of body.data) {
      items.push({
        id: t.id,
        title: t.title,
        url: t.url,
        latitude: t.latitude,
        longitude: t.longitude,
        activities: (t.activities || []).map((a) => a.name),
        relatedParks: (t.relatedParks || []).map((p) => p.parkCode),
        shortDescription: t.shortDescription,
        longDescription: t.longDescription,
        durationDescription: t.durationDescription,
        duration: t.duration,
        tags: t.tags,
        location: t.location,
      })
    }
    start += body.data.length
    console.log(`NPS: ${start} / ${body.total}`)
    if (body.data.length === 0 || start >= Number(body.total)) break
  }
  return items
}

/** All parks' Things To Do, cached. Parks added later (e.g. a newly designated park) are fetched on their own. */
async function fetchThingsToDo() {
  const path = join(CACHE, 'nps-thingstodo.json')
  let cache = !REFRESH && existsSync(path) ? JSON.parse(await readFile(path, 'utf8')) : { codes: [], items: [] }
  // Caches from before descriptions were kept are re-fetched.
  if (!Array.isArray(cache) && cache.version !== 2) cache = { version: 2, codes: [], items: [] }
  // Older caches were a bare list of items.
  if (Array.isArray(cache)) cache = { codes: [...new Set(cache.flatMap((t) => t.relatedParks))], items: cache }
  const missing = [...new Set(PARKS.map(ttdCode))].filter((c) => !cache.codes.includes(c))
  if (missing.length) {
    console.log(`NPS: fetching ${missing.join(', ')}`)
    const seen = new Set(cache.items.map((t) => t.id))
    for (const t of await fetchThingsToDoFor(missing)) if (!seen.has(t.id)) cache.items.push(t)
    cache.codes = [...new Set([...cache.codes, ...missing])]
    await writeFile(path, JSON.stringify({ ...cache, version: 2 }))
  }
  return cache.items
}

// "Hiking", "Front-Country Hiking", "Backcountry Hiking". Walking tours alone don't count.
const isHike = (t) => t.activities.some((a) => /hiking/i.test(a))

// Overview pages ("Hiking in Zion", "Day Hikes", "Hiking Trails") rather than one specific hike.
const isOverview = (title) =>
  /^(day |short |easy |family |backcountry |winter )?(hikes|hiking|trails|walks)( and [a-z ]+)?$|^(day |short )?(hikes|hiking|trails|walks) (in|at|around|of|near|for)\b|\bhiking (opportunities|options|trails in)\b|\bjunior ranger\b/i.test(
    title.trim(),
  )

// "Hike Beehive Loop" → "Beehive Loop", "Hike to Delicate Arch" → "Delicate Arch".
const cleanName = (title) => {
  const name = title.trim().replace(/^(go )?(hike|hiking|walk)( to| the| on| up| along)? /i, (m) => (/ the $/i.test(m) ? 'The ' : ''))
  return name.charAt(0).toUpperCase() + name.slice(1)
}

// ---------- Difficulty, distance and time from NPS ----------

const stripHtml = (s = '') =>
  s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&rsquo;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()

const WORD_NUMBERS = { a: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20 }
const NUM = `(\\d+(?:\\.\\d+)?|\\.\\d+|${Object.keys(WORD_NUMBERS).join('|')}|half(?:\\s+a)?|quarter)`

const toNumber = (raw) => {
  const w = raw.toLowerCase()
  if (w.startsWith('half')) return 0.5
  if (w === 'quarter') return 0.25
  return WORD_NUMBERS[w] ?? Number(w)
}

/**
 * The hike's distance in miles as NPS states it. Prefers a round-trip / total figure; skips
 * distances that are clearly about something else (drives, "from the road", elevation).
 */
export function parseDistanceMi(text) {
  const re = new RegExp(`${NUM}\\s*(?:-|–|to)?\\s*(?:${NUM}\\s*)?[- ]?(miles?|mi\\b|kilometers?|km\\b)(?:[^.]{0,40}?(round[- ]?trip|roundtrip|loop|one[- ]way|total))?`, 'gi')
  let best = null
  for (const m of text.matchAll(re)) {
    const before = text.slice(Math.max(0, m.index - 30), m.index).toLowerCase()
    if (/\b(drive|driving|road|from the|parking|located|away|north of|south of|east of|west of)\b/.test(before)) continue
    // A distance to somewhere ("12 miles from the visitor center", "5 miles north of town").
    const after = text.slice(m.index + m[0].length, m.index + m[0].length + 25).toLowerCase()
    if (/^\s*(\([^)]*\)\s*)?(from|away|north|south|east|west|past|beyond|by road|drive)\b/.test(after)) continue
    // A part of the hike ("After 1 mile on the Riverside Walk", "only accounts for the 0.5 mi").
    if (/\b(after|first|only|accounts for|spur|then|another|additional|last|beyond|within)\b/.test(before)) continue
    const n = toNumber(m[2] ?? m[1])
    if (!(n > 0 && n < 100)) continue
    const miles = /^k/i.test(m[3]) ? n * 0.621371 : n
    const kind = (m[4] ?? '').toLowerCase().replace(/[- ]/g, '')
    const factor = kind === 'oneway' ? 2 : 1
    const candidate = { miles: Math.round(miles * factor * 10) / 10, strong: kind !== '' }
    if (!best || (candidate.strong && !best.strong)) best = candidate
    if (best.strong) break
  }
  return best?.miles ?? null
}

const DIFFICULTY = [
  [/\b(very strenuous|extremely strenuous|strenuous|difficult|challenging|hard|advanced)\b/i, 'Strenuous'],
  [/\b(moderate|moderately)\b/i, 'Moderate'],
  [/\b(easy|easiest|beginner|leisurely|accessible)\b/i, 'Easy'],
]

/** Easy / Moderate / Strenuous from NPS tags first, then the descriptions. */
export function parseDifficulty(tags, text) {
  for (const source of [(tags ?? []).join(' | '), text]) {
    let found = null
    let at = Infinity
    for (const [re, label] of DIFFICULTY) {
      const m = source.match(re)
      if (m && m.index < at) [found, at] = [label, m.index]
    }
    if (found) return found
  }
  return null
}

/** NPS's own time estimate, tidied: "1-2 Hours" → "1–2 hours". */
export const parseDuration = (d) => (d && d.trim() ? d.trim().replace(/\s*-\s*/, '–').replace(/\b(Hours?|Minutes?|Days?)\b/, (w) => w.toLowerCase()) : null)

// ---------- Distance from OpenStreetMap ----------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const haversine = (a, b) => {
  const toRad = (d) => (d * Math.PI) / 180
  const x = Math.sin(toRad(b.lat - a.lat) / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(toRad(b.lon - a.lon) / 2) ** 2
  return 2 * 6371e3 * Math.asin(Math.sqrt(x))
}
const lineLength = (g = []) => g.reduce((m, p, i) => (i ? m + haversine(g[i - 1], p) : 0), 0)
const STOP = new Set(['the', 'to', 'trail', 'trails', 'trailhead', 'hike', 'hiking', 'loop', 'route', 'path', 'nature', 'walk', 'of', 'and', 'a', 'at', 'via', 'in', 'on', 'from', 'with', 'bus', 'island', 'explorer'])
const tokens = (s) => new Set(s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/['’ʻ]/g, '').split(/[^a-z0-9]+/).filter((t) => t && !STOP.has(t)))
function sameName(a, b) {
  const A = tokens(a)
  const B = tokens(b)
  if (!A.size || !B.size) return false
  let shared = 0
  for (const t of A) if (B.has(t)) shared++
  return shared === Math.min(A.size, B.size) && shared >= Math.min(2, Math.min(A.size, B.size))
}

async function overpass(query) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const res = await fetch(OVERPASS[attempt % OVERPASS.length], {
        // Overpass can stall when it's busy; give up on a request rather than wait forever.
        signal: AbortSignal.timeout(60_000),
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Travel-Log build script' },
        body: 'data=' + encodeURIComponent(query),
      })
      if (res.ok) return await res.json()
    } catch {
      // retry
    }
    await sleep(4000 * (attempt + 1))
  }
  return null
}

/**
 * Lengths in miles of the park's named trails in OpenStreetMap: { "skyline": 5.5, ... } keyed by
 * the name's words (see tokens), one query per park. A hiking route relation is measured whole;
 * otherwise the ways sharing a name inside the park are added up.
 */
async function osmParkLengths(park) {
  const g = boundaryById.get(park.id)
  if (!g) return {}
  const pts = (g.type === 'Polygon' ? [g.coordinates] : g.coordinates).flat(2)
  const [w, s, e, n] = pts.reduce(([w, s, e, n], [x, y]) => [Math.min(w, x), Math.min(s, y), Math.max(e, x), Math.max(n, y)], [180, 90, -180, -90])
  await sleep(1100)
  const data = await overpass(`[out:json][timeout:180][bbox:${s},${w},${n},${e}];
(
  way["highway"~"^(path|footway|track|bridleway|steps)$"]["name"];
  relation["route"~"^(hiking|foot)$"]["name"];
);
out tags geom;`)
  if (!data) return null // not cached, so a later run retries
  const ways = new Map()
  const routes = new Map()
  for (const el of data.elements) {
    const key = [...tokens(el.tags.name)].sort().join(' ')
    if (!key) continue
    if (el.type === 'relation') {
      const m = (el.members ?? []).filter((x) => x.geometry).reduce((sum, x) => sum + lineLength(x.geometry), 0)
      routes.set(key, Math.max(routes.get(key) ?? 0, m))
    } else if (el.geometry?.length && inPark(park.id, el.geometry[0].lon, el.geometry[0].lat)) {
      ways.set(key, (ways.get(key) ?? 0) + lineLength(el.geometry))
    }
  }
  const out = {}
  for (const [key, m] of [...ways, ...routes]) {
    const miles = Math.round((m / 1609.344) * 10) / 10
    if (miles > 0.05 && miles < 250) out[key] = miles
  }
  return out
}

// ---------- Sequoia / Kings Canyon split ----------

const boundaryById = new Map(feature(BOUNDARIES, BOUNDARIES.objects.parks).features.map((f) => [f.properties.id, f.geometry]))

function inRing(lng, lat, ring) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

function inPark(parkId, lng, lat) {
  const g = boundaryById.get(parkId)
  if (!g) return false
  const polygons = g.type === 'Polygon' ? [g.coordinates] : g.coordinates
  return polygons.some(([outer, ...holes]) => inRing(lng, lat, outer) && !holes.some((h) => inRing(lng, lat, h)))
}

// Sequoia and Kings Canyon share one NPS code: use the boundaries, then place names.
function sekiPark(t) {
  const lat = Number(t.latitude)
  const lng = Number(t.longitude)
  if (lat && lng) {
    if (inPark('kings-canyon', lng, lat)) return 'kings-canyon'
    if (inPark('sequoia', lng, lat)) return 'sequoia'
  }
  const text = `${t.title} ${t.shortDescription} ${t.location || ''}`
  return /kings canyon|grant grove|cedar grove|redwood canyon|big stump|zumwalt|roaring river/i.test(text) ? 'kings-canyon' : 'sequoia'
}

// ---------- NPS trails map ----------

const TRAILS = 'https://mapservices.nps.gov/arcgis/rest/services/NationalDatasets/NPS_Public_Trails/FeatureServer/0/query'

// Mapped ways that aren't a hike someone would check off.
const NOT_A_HIKE =
  /\b(campsite|campground|camp( \d+)?$|spur|connector|access|cutoff|cut-off|road|street|parking|bike path|bicycle|walkways?|sidewalk|pathways?|bridge|crossing|stairs?|service|social|unnamed|unknown|reroute|climbing|developed area|picnic|utility|maintenance|tram station|gaging|boardwalk to|portage|ski|snowmobile)\b|^(trail|path|loop|route)( \d+)?$|^\W*$|^\d/i

// The map's abbreviations: "Burroughs Mtn Trail", "Chinook Pass To Tipsoo Lk Trail".
const ABBREVIATIONS = [
  [/\bMtn\b\.?/g, 'Mountain'],
  [/\bMt\b\.?/g, 'Mount'],
  [/\bLk\b\.?/g, 'Lake'],
  [/\bPt\b\.?/g, 'Point'],
  [/\bCk\b\.?|\bCr\b\.?/g, 'Creek'],
  [/\bJct\b\.?/g, 'Junction'],
]
export const tidyTrailName = (raw) => {
  let name = raw.replace(/\s+/g, ' ').trim()
  for (const [re, word] of ABBREVIATIONS) name = name.replace(re, word)
  // "Chinook Pass To Tipsoo Lake Trail" → "Chinook Pass to Tipsoo Lake Trail".
  return name.replace(/ (To|And|Of|The|At|On|Via)(?= )/g, (m) => m.toLowerCase()).replace(/\bMc([a-z])/g, (_, c) => `Mc${c.toUpperCase()}`)
}

/** Whether a name on the trails map is a hike (not a spur, road, walkway or campsite path). */
export const isTrailHike = (name) => !NOT_A_HIKE.test(name)

/** One park's mapped trails, grouped by name: [{ name, miles, lat, lng }], miles summed over segments. */
async function fetchParkTrails(unitCode) {
  const segments = []
  for (let offset = 0; ; ) {
    const q = new URLSearchParams({
      where: `UNITCODE='${unitCode}'`,
      outFields: 'TRLNAME,MAPLABEL,TRLSTATUS,TRLTYPE,TRLFEATTYPE',
      returnGeometry: 'true',
      outSR: '4326',
      geometryPrecision: '5',
      f: 'json',
      resultOffset: String(offset),
      resultRecordCount: '2000',
    })
    const res = await fetch(`${TRAILS}?${q}`, { signal: AbortSignal.timeout(180_000) })
    const body = await res.json()
    if (body.error) throw new Error(`NPS trails ${unitCode}: ${JSON.stringify(body.error)}`)
    segments.push(...body.features)
    offset += body.features.length
    if (!body.exceededTransferLimit || body.features.length === 0) break
  }
  const byName = new Map()
  for (const { attributes: a, geometry } of segments) {
    if (a.TRLSTATUS !== 'Existing') continue
    if (/water|snow/i.test(a.TRLTYPE ?? '') || /non-nps|unofficial/i.test(a.TRLFEATTYPE ?? '')) continue
    const raw = (a.TRLNAME ?? '').trim() || (a.MAPLABEL ?? '').trim()
    if (!raw || !isTrailHike(raw)) continue
    const name = tidyTrailName(raw)
    const key = name.toLowerCase()
    const t = byName.get(key) ?? { name, m: 0, lat: 0, lng: 0, n: 0 }
    for (const path of geometry?.paths ?? []) {
      const pts = path.map(([lon, lat]) => ({ lon, lat }))
      t.m += lineLength(pts)
      for (const p of pts) [t.lat, t.lng, t.n] = [t.lat + p.lat, t.lng + p.lon, t.n + 1]
    }
    byName.set(key, t)
  }
  return [...byName.values()].map((t) => ({
    name: t.name,
    miles: Math.round((t.m / 1609.344) * 10) / 10,
    lat: t.n ? t.lat / t.n : null,
    lng: t.n ? t.lng / t.n : null,
  }))
}

/** Every park's mapped trails, cached (the raw segments are large; only the totals are kept). */
async function fetchTrails() {
  const path = join(CACHE, 'nps-trails.json')
  const cache = !REFRESH && existsSync(path) ? JSON.parse(await readFile(path, 'utf8')) : {}
  for (const p of PARKS) {
    const code = p.npsCode.toUpperCase()
    if (code in cache) continue
    cache[code] = await fetchParkTrails(code)
    console.log(`NPS trails: ${code} ${cache[code].length}`)
    await writeFile(path, JSON.stringify(cache))
  }
  return cache
}

// A Things To Do page that isn't on the trails map is kept only if its title names a hike.
const NAMES_A_HIKE =
  /\b(trail|trails|loop|path|walk|hike|route|trek|nature|falls?|lakes?|peak|point|overlook|vista|ridge|arch|arches|mountain|mount|mt|creek|canyon|gorge|pass|summit|dome|rim|meadows?|basin|spring|springs|cove|beach|knob|butte|bluff|hill|cave|grove|glacier|notch|gap|island|garden|wash|narrows|bald|top|view|cliffs?|rock|tower|window|bridge|river|dunes?|crater|geyser|pools?|ruins?|cabin|mine|tunnel|tree|trees|forest|marsh|swamp|bay|harbor|head|hollow|valley|landing)\b/i
// "A Day In Paradise", "Spring Recreation", "Explore …": a theme, not a hike.
const THEME =
  /^(a |an )?(half-)?(day|days|weekend|morning|afternoon|evening|night)\b|\brecreation\b|^(explore|discover|experience|visit|enjoy|see|find|plan|learn|spend)\b|\b(things to do|activities|safety|tips|guide|itinerary|ideas|hikes|walks|off the beaten path)\b|:/i
export const isTheme = (name) => THEME.test(name)
export const namesAHike = (name) => NAMES_A_HIKE.test(name) && !isTheme(name)

// "Lakes" and "Lake" are the same word when matching names.
const stems = (s) => new Set([...tokens(s)].map((w) => (w.length > 3 ? w.replace(/s$/, '') : w)))

/** The mapped trail a Things To Do hike is about: the same words first, then one name inside the other. */
function matchTrail(hike, trails) {
  const H = stems(hike.name)
  if (!H.size) return null
  const same = trails.filter((t) => {
    const T = stems(t.name)
    return T.size === H.size && [...H].every((w) => T.has(w))
  })
  if (same.length) return same[0]
  const near = (t) => (hike.lat === null || t.lat === null ? 0 : haversine({ lat: hike.lat, lon: hike.lng }, { lat: t.lat, lon: t.lng }))
  const loose = trails.filter((t) => sameName(hike.name, t.name)).sort((a, b) => near(a) - near(b))
  return loose[0] ?? null
}

// ---------- The parks' own day-hike lists ----------

// scripts/nps-day-hikes.json: each park's day hikes as listed on its nps.gov hiking pages ("Day
// Hikes", "Suggested Hikes", per-area trail pages), with the distance, time and difficulty those
// pages state, and the page each came from. Compiled by reading those pages; see its "sources".
const DAY_HIKES_PATH = join(ROOT, 'scripts', 'nps-day-hikes.json')
const DAY_HIKES = existsSync(DAY_HIKES_PATH) ? JSON.parse(readFileSync(DAY_HIKES_PATH, 'utf8')) : {}
const OSM_MIN_MI = 0.3

/**
 * Replaces a park's hikes with its day-hike list. A Things To Do page about the same hike adds its
 * link and fills in what the list leaves out (its id is kept, so hikes you checked off stay
 * checked). Things To Do hikes that aren't on the list are left out: the park's list is the list.
 */
function applyDayHikes(bucket, dayHikes) {
  const pages = []
  for (const h of bucket.hikes.values()) {
    if (isTheme(h.name) || !namesAHike(h.name)) bucket.themes.push(h.name)
    else pages.push(h)
  }
  bucket.hikes.clear()
  const unused = new Set(pages)
  for (const d of dayHikes) {
    const name = cleanName(d.name.replace(/\s+/g, ' '))
    const page = matchTrail({ name, lat: null, lng: null }, [...unused])
    if (page) unused.delete(page)
    // Shown as the whole hike: a one-way distance is doubled for the walk back.
    const stated = typeof d.distanceMi === 'number' ? Math.round(d.distanceMi * (d.distanceKind === 'one way' ? 2 : 1) * 10) / 10 : null
    let id = page?.id ?? slug(name)
    if (bucket.hikes.has(id)) id = slug(name)
    if (bucket.hikes.has(id)) continue
    bucket.hikes.set(id, {
      id,
      name,
      npsUrl: d.url ?? page?.npsUrl ?? null,
      difficulty: d.difficulty ?? page?.difficulty ?? null,
      distanceMi: stated ?? page?.distanceMi ?? null,
      distanceSource: null,
      duration: d.duration ?? page?.duration ?? null,
      npsId: page?.npsId ?? null,
      lat: page?.lat ?? null,
      lng: page?.lng ?? null,
    })
  }
  bucket.notListed = [...unused].map((h) => h.name)
}

// ---------- Build ----------

const slug = (s) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/['’ʻ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

async function main() {
  await mkdir(CACHE, { recursive: true })
  const items = await fetchThingsToDo()
  console.log(`NPS Things To Do entries: ${items.length}`)
  const trails = await fetchTrails()

  const codeToParks = new Map()
  for (const p of PARKS) codeToParks.set(ttdCode(p), [...(codeToParks.get(ttdCode(p)) || []), p.id])
  const byPark = new Map(PARKS.map((p) => [p.id, { hikes: new Map(), overview: [], themes: [] }]))

  for (const t of items) {
    if (!isHike(t)) continue
    const parkIds = new Set()
    for (const code of t.relatedParks) {
      if (code === 'seki') parkIds.add(sekiPark(t))
      else (codeToParks.get(code) || []).forEach((id) => parkIds.add(id))
    }
    for (const parkId of parkIds) {
      const bucket = byPark.get(parkId)
      if (isOverview(t.title)) {
        bucket.overview.push(t.title.trim())
        continue
      }
      const name = cleanName(t.title)
      const text = stripHtml(`${t.durationDescription ?? ''} ${t.shortDescription ?? ''} ${t.longDescription ?? ''}`)
      const lat = Number(t.latitude)
      const lng = Number(t.longitude)
      bucket.hikes.set(slug(name), {
        id: slug(name),
        name,
        npsUrl: t.url,
        difficulty: parseDifficulty(t.tags, text),
        distanceMi: parseDistanceMi(text),
        distanceSource: null,
        duration: parseDuration(t.duration),
        npsId: t.id,
        lat: lat && lng ? lat : null,
        lng: lat && lng ? lng : null,
      })
    }
  }

  // A park's own day-hike list is the list where there is one; otherwise the trails map is. Either
  // way, Things To Do pages add their details to the hike they're about.
  for (const park of PARKS) {
    const bucket = byPark.get(park.id)
    if (DAY_HIKES[park.id]) {
      applyDayHikes(bucket, DAY_HIKES[park.id].hikes)
      continue
    }
    const mapped = trails[park.npsCode.toUpperCase()] ?? []
    const used = new Set()
    for (const [id, h] of bucket.hikes) {
      const trail = mapped.length ? matchTrail(h, mapped) : null
      if (isTheme(h.name)) {
        bucket.hikes.delete(id)
        bucket.themes.push(h.name)
      } else if (trail) {
        used.add(trail)
      } else if (!namesAHike(h.name)) {
        bucket.hikes.delete(id)
        bucket.themes.push(h.name)
      }
    }
    for (const t of mapped) {
      // Too short to be a hike of its own: a stub of a longer trail, or a few yards of path.
      if (used.has(t) || t.miles < 0.1 || bucket.hikes.has(slug(t.name))) continue
      bucket.hikes.set(slug(t.name), {
        id: slug(t.name),
        name: t.name,
        npsUrl: null,
        difficulty: null,
        distanceMi: null,
        distanceSource: null,
        duration: null,
        npsId: null,
        lat: null,
        lng: null,
      })
    }
  }

  // Distances NPS doesn't state: the same-named trail's length in OpenStreetMap. (The NPS trails
  // map's own lengths aren't used: many parks have only parts of their trails drawn.)
  const all = PARKS.flatMap((p) => [...byPark.get(p.id).hikes.values()])
  for (const h of all) if (h.distanceMi !== null) h.distanceSource = 'nps'
  if (USE_OSM) {
    const osmPath = join(CACHE, 'osm-park-trails.json')
    const osmCache = existsSync(osmPath) && !REFRESH ? JSON.parse(await readFile(osmPath, 'utf8')) : {}
    for (const park of PARKS) {
      // A park's own day-hike list gives NPS's distances or none; a mapped trail's length would
      // often be a different route (Angels Landing's 0.4 mi of mapped trail is not the hike).
      if (DAY_HIKES[park.id]) continue
      const hikes = [...byPark.get(park.id).hikes.values()].filter((h) => h.distanceMi === null)
      if (!hikes.length) continue
      if (!(park.id in osmCache)) {
        const lengths = await osmParkLengths(park)
        if (lengths === null) continue
        osmCache[park.id] = lengths
        await writeFile(osmPath, JSON.stringify(osmCache))
        console.log(`OpenStreetMap: ${park.name} ${Object.keys(lengths).length} named trails`)
      }
      for (const h of hikes) {
        const miles = osmCache[park.id][[...tokens(h.name)].sort().join(' ')]
        // Shorter than this, the match is usually a stub of the trail, not the hike.
        if (miles >= OSM_MIN_MI) Object.assign(h, { distanceMi: miles, distanceSource: 'osm' })
      }
    }
  }

  const out = {}
  for (const park of PARKS)
    out[park.id] = [...byPark.get(park.id).hikes.values()]
      // Hikes with an nps.gov page first: those are the ones the park features.
      .sort((a, b) => Number(!a.npsUrl) - Number(!b.npsUrl) || a.name.localeCompare(b.name))
      .map(({ npsId: _npsId, lat: _lat, lng: _lng, ...h }) => h)
  await writeFile(OUT, JSON.stringify(out, null, 1) + '\n')

  const total = Object.values(out).reduce((n, h) => n + h.length, 0)
  const empty = PARKS.filter((p) => out[p.id].length === 0).map((p) => p.name)
  const lines = [
    '# Park hikes build report',
    '',
    `Generated ${new Date().toISOString().slice(0, 10)} by \`scripts/build-park-hikes.mjs\` from the parks' nps.gov day-hike pages, NPS Things To Do and the NPS trails map.`,
    '',
    `- **${total} hikes** across ${PARKS.length} parks; ${all.filter((h) => h.npsUrl).length} have an nps.gov page`,
    `- Difficulty known for ${all.filter((h) => h.difficulty).length}; distance for ${all.filter((h) => h.distanceMi !== null).length} (${all.filter((h) => h.distanceSource === 'nps').length} from NPS, ${all.filter((h) => h.distanceSource === 'osm').length} from OpenStreetMap); time for ${all.filter((h) => h.duration).length}`,
    `- Parks with no hikes listed by NPS (${empty.length}): ${empty.join(', ') || 'none'}`,
    `- From the park's own day-hike list (${PARKS.filter((p) => DAY_HIKES[p.id]).length} parks); the rest from the NPS trails map`,
    '',
    '| Park | Hikes |',
    '|---|---|',
    ...PARKS.map((p) => `| ${p.name} | ${out[p.id].length} |`),
    '',
  ]
  for (const park of PARKS) {
    const { overview, themes } = byPark.get(park.id)
    lines.push(`## ${park.name} (${out[park.id].length})`, '')
    const day = DAY_HIKES[park.id]
    lines.push(day ? (day.hikes.length ? `From the park's day-hike list: ${day.sources.join(', ')}` : `No day hikes: ${day.note}`) : 'From the NPS trails map', '')
    for (const h of out[park.id]) {
      const facts = [h.difficulty, h.distanceMi !== null && `${h.distanceSource === 'nps' ? '' : '≈'}${h.distanceMi} mi`, h.duration].filter(Boolean).join(' · ')
      lines.push(`- ${h.npsUrl ? `[${h.name}](${h.npsUrl})` : h.name}${facts ? ` — ${facts}` : ''}`)
    }
    if (overview.length) lines.push('', `Skipped overview pages: ${overview.join('; ')}`)
    if (themes.length) lines.push('', `Skipped pages that aren't one hike: ${themes.join('; ')}`)
    const { notListed } = byPark.get(park.id)
    if (notListed?.length) lines.push('', `Things To Do hikes not on the park's day-hike list (left out): ${notListed.join('; ')}`)
    lines.push('')
  }
  await writeFile(REPORT, lines.join('\n'))
  console.log(`Wrote ${OUT}\nWrote ${REPORT}\n${total} hikes; no hikes listed for ${empty.length} parks`)
}

// Build only when run as a script; tests import the parsers above.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
