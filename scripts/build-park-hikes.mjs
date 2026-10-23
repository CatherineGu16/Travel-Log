#!/usr/bin/env node
// Builds src/data/park-hikes.json: the names of the hikes each national park lists in its
// nps.gov "Things To Do", with a link to each hike's nps.gov page.
//
//   node scripts/build-park-hikes.mjs            uses the cached download when present
//   node scripts/build-park-hikes.mjs --refresh  re-downloads everything
//
// Data comes from the official NPS Things To Do feed, the entries behind nps.gov/thingstodo pages
// (developer.nps.gov). Without NPS_API_KEY it uses the public DEMO_KEY, which needs no account
// but allows only ~10 requests an hour, so all parks are fetched in a few batched requests and
// cached in scripts/.cache/.

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { feature } from 'topojson-client'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CACHE = join(ROOT, 'scripts', '.cache')
const OUT = join(ROOT, 'src', 'data', 'park-hikes.json')
const REPORT = join(ROOT, 'scripts', 'park-hikes-report.md')
const REFRESH = process.argv.includes('--refresh')
const NPS_KEY = process.env.NPS_API_KEY || 'DEMO_KEY'

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
  // Older caches were a bare list of items.
  if (Array.isArray(cache)) cache = { codes: [...new Set(cache.flatMap((t) => t.relatedParks))], items: cache }
  const missing = [...new Set(PARKS.map(ttdCode))].filter((c) => !cache.codes.includes(c))
  if (missing.length) {
    console.log(`NPS: fetching ${missing.join(', ')}`)
    const seen = new Set(cache.items.map((t) => t.id))
    for (const t of await fetchThingsToDoFor(missing)) if (!seen.has(t.id)) cache.items.push(t)
    cache.codes = [...new Set([...cache.codes, ...missing])]
    await writeFile(path, JSON.stringify(cache))
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
      bucket.hikes.set(slug(name), { id: slug(name), name, npsUrl: t.url })
    }
  }

  const out = {}
  for (const park of PARKS) out[park.id] = [...byPark.get(park.id).hikes.values()].sort((a, b) => a.name.localeCompare(b.name))
  await writeFile(OUT, JSON.stringify(out, null, 1) + '\n')

  const total = Object.values(out).reduce((n, h) => n + h.length, 0)
  const empty = PARKS.filter((p) => out[p.id].length === 0).map((p) => p.name)
  const lines = [
    '# Park hikes build report',
    '',
    `Generated ${new Date().toISOString().slice(0, 10)} by \`scripts/build-park-hikes.mjs\` from NPS Things To Do.`,
    '',
    `- **${total} hikes** across ${PARKS.length} parks`,
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
    for (const h of out[park.id]) lines.push(`- [${h.name}](${h.npsUrl})`)
    if (overview.length) lines.push('', `Skipped overview pages: ${overview.join('; ')}`)
    lines.push('')
  }
  await writeFile(REPORT, lines.join('\n'))
  console.log(`Wrote ${OUT}\nWrote ${REPORT}\n${total} hikes; no hikes listed for ${empty.length} parks`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
