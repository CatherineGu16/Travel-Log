#!/usr/bin/env node
// Builds src/data/park-hikes.json: the hikes each national park lists in its nps.gov "Things To
// Do", with a link to each hike's page, its difficulty, distance and time where known.
//
// Difficulty and time come from NPS (tags, descriptions, its duration field). Distance comes from
// the NPS description when it states one; otherwise from the matching named trail in
// OpenStreetMap near the hike's NPS location (Overpass API, free, no key), marked "osm" because
// it's the mapped trail's length rather than a stated hike distance.
//
//   node scripts/build-park-hikes.mjs            uses cached downloads when present
//   node scripts/build-park-hikes.mjs --refresh  re-downloads everything
//   node scripts/build-park-hikes.mjs --no-osm   skips the OpenStreetMap distance lookups
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

/** Length in miles of the named trail matching this hike within a few km of its NPS location. */
async function osmDistance(hike, osmCache) {
  if (hike.lat == null) return null
  if (hike.npsId in osmCache) return osmCache[hike.npsId]
  await sleep(1100)
  const data = await overpass(`[out:json][timeout:60];
(
  way["highway"~"^(path|footway|track|bridleway|steps)$"]["name"](around:4000,${hike.lat},${hike.lng});
  relation["route"~"^(hiking|foot)$"]["name"](around:4000,${hike.lat},${hike.lng});
);
out tags geom;`)
  if (!data) return null // not cached, so a later run retries
  const matches = data.elements.filter((e) => sameName(hike.name, e.tags.name))
  let miles = null
  const relation = matches.find((e) => e.type === 'relation')
  if (relation) miles = (relation.members ?? []).filter((m) => m.geometry).reduce((sum, m) => sum + lineLength(m.geometry), 0) / 1609.344
  else if (matches.length) {
    // OSM splits a trail into many ways; add up the ones sharing the matched name.
    const name = matches[0].tags.name
    miles = data.elements.filter((e) => e.type === 'way' && e.tags.name === name).reduce((sum, e) => sum + lineLength(e.geometry), 0) / 1609.344
  }
  osmCache[hike.npsId] = miles && miles > 0.05 && miles < 60 ? Math.round(miles * 10) / 10 : null
  return osmCache[hike.npsId]
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

// ---------- Build ----------

const slug = (s) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/['’ʻ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

async function main() {
  await mkdir(CACHE, { recursive: true })
  const items = await fetchThingsToDo()
  console.log(`NPS Things To Do entries: ${items.length}`)

  const codeToParks = new Map()
  for (const p of PARKS) codeToParks.set(ttdCode(p), [...(codeToParks.get(ttdCode(p)) || []), p.id])
  const byPark = new Map(PARKS.map((p) => [p.id, { hikes: new Map(), overview: [] }]))

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

  // Distances NPS doesn't state: the matching trail's length in OpenStreetMap.
  const osmPath = join(CACHE, 'osm-hike-lengths.json')
  const osmCache = existsSync(osmPath) && !REFRESH ? JSON.parse(await readFile(osmPath, 'utf8')) : {}
  const all = PARKS.flatMap((p) => [...byPark.get(p.id).hikes.values()])
  for (const h of all) if (h.distanceMi !== null) h.distanceSource = 'nps'
  if (USE_OSM) {
    const missing = all.filter((h) => h.distanceMi === null && h.lat !== null)
    console.log(`OpenStreetMap: looking up ${missing.length} trail lengths`)
    for (const [i, h] of missing.entries()) {
      const miles = await osmDistance(h, osmCache)
      if (miles !== null) Object.assign(h, { distanceMi: miles, distanceSource: 'osm' })
      if (i % 5 === 4) {
        await writeFile(osmPath, JSON.stringify(osmCache))
        console.log(`  ${i + 1} / ${missing.length}`)
      }
    }
    await writeFile(osmPath, JSON.stringify(osmCache))
  }

  const out = {}
  for (const park of PARKS)
    out[park.id] = [...byPark.get(park.id).hikes.values()]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(({ npsId: _npsId, lat: _lat, lng: _lng, ...h }) => h)
  await writeFile(OUT, JSON.stringify(out, null, 1) + '\n')

  const total = Object.values(out).reduce((n, h) => n + h.length, 0)
  const empty = PARKS.filter((p) => out[p.id].length === 0).map((p) => p.name)
  const lines = [
    '# Park hikes build report',
    '',
    `Generated ${new Date().toISOString().slice(0, 10)} by \`scripts/build-park-hikes.mjs\` from NPS Things To Do.`,
    '',
    `- **${total} hikes** across ${PARKS.length} parks`,
    `- Difficulty known for ${all.filter((h) => h.difficulty).length}; distance for ${all.filter((h) => h.distanceMi !== null).length} (${all.filter((h) => h.distanceSource === 'nps').length} from NPS, ${all.filter((h) => h.distanceSource === 'osm').length} from OpenStreetMap); time for ${all.filter((h) => h.duration).length}`,
    `- Parks with no hikes listed by NPS (${empty.length}): ${empty.join(', ') || 'none'}`,
    '',
    '| Park | Hikes |',
    '|---|---|',
    ...PARKS.map((p) => `| ${p.name} | ${out[p.id].length} |`),
    '',
  ]
  for (const park of PARKS) {
    const { overview } = byPark.get(park.id)
    lines.push(`## ${park.name} (${out[park.id].length})`, '')
    for (const h of out[park.id]) {
      const facts = [h.difficulty, h.distanceMi !== null && `${h.distanceSource === 'osm' ? '≈' : ''}${h.distanceMi} mi`, h.duration].filter(Boolean).join(' · ')
      lines.push(`- [${h.name}](${h.npsUrl})${facts ? ` — ${facts}` : ''}`)
    }
    if (overview.length) lines.push('', `Skipped overview pages: ${overview.join('; ')}`)
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
