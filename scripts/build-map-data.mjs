#!/usr/bin/env node
// Builds the public map data bundled with the app (src/data/) and the label fonts (public/fonts/).
//
//   node scripts/build-map-data.mjs            uses cached downloads when present
//   node scripts/build-map-data.mjs --refresh  re-downloads everything
//   node scripts/build-map-data.mjs --only=world-cities   rebuilds just that file
//
// Sources (all public domain or free to redistribute):
//   us-states.json        us-atlas states-10m (US Census), tagged with ISO 3166-2 region codes
//   national-parks.json   NPS boundary service for the official list, Wikipedia's list of national
//                         parks for location, established date and acreage (facts only)
//   park-boundaries.json  NPS Land Resources Division boundaries, simplified (TopoJSON)
//   us-places.json        Census Gazetteer places (cities, towns, CDPs) with 2024 population
//                         estimates (Census), for offline place search ranked by size
//   us-cities.json        Natural Earth populated places in the US, for map labels
//   us-lakes.json         Natural Earth 50m lakes in and around the US
//   world-countries.json  Natural Earth 50m countries (TopoJSON), so neighbors show as land
//   world-cities.json     GeoNames cities over 15,000 people outside the US (CC BY 4.0, credited
//                         as "GeoNames" on the map), for offline place search ranked by size
//   public/fonts/         Noto Sans glyphs (SIL OFL) so map labels render without any outside request

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import mapshaper from 'mapshaper'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CACHE = join(ROOT, 'scripts', '.cache')
const DATA = join(ROOT, 'src', 'data')
const FONTS = join(ROOT, 'public', 'fonts')
const REFRESH = process.argv.includes('--refresh')
const ONLY = process.argv.find((a) => a.startsWith('--only='))?.slice('--only='.length)

const NPS_BOUNDARIES =
  'https://services1.arcgis.com/fBc8EJBxQRMcHlei/arcgis/rest/services/NPS_Land_Resources_Division_Boundary_and_Tract_Data_Service/FeatureServer/2/query'
const WIKI =
  'https://en.wikipedia.org/w/api.php?action=parse&page=List_of_national_parks_of_the_United_States&prop=wikitext&format=json&formatversion=2'
const GAZETTEER = 'https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2024_Gazetteer/2024_Gaz_place_national.zip'
const POPULATION = 'https://www2.census.gov/programs-surveys/popest/datasets/2020-2024/cities/totals/sub-est2024.csv'
const NE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson'
const GEONAMES = 'https://download.geonames.org/export/dump'
const GLYPHS = 'https://tiles.openfreemap.org/fonts'
const FONT_STACKS = ['Noto Sans Regular', 'Noto Sans Bold', 'Noto Sans Italic']
// Basic Latin, Latin-1, Latin Extended-A (ā, ō), spacing modifiers (ʻokina), punctuation (– ’).
const GLYPH_RANGES = ['0-255', '256-511', '512-767', '8192-8447']

const EXTRA_UNITS = ['NERI', 'CHIR']

const STATE_CODES = {
  '01': 'AL', '02': 'AK', '04': 'AZ', '05': 'AR', '06': 'CA', '08': 'CO', '09': 'CT', '10': 'DE', '11': 'DC',
  '12': 'FL', '13': 'GA', '15': 'HI', '16': 'ID', '17': 'IL', '18': 'IN', '19': 'IA', '20': 'KS', '21': 'KY',
  '22': 'LA', '23': 'ME', '24': 'MD', '25': 'MA', '26': 'MI', '27': 'MN', '28': 'MS', '29': 'MO', '30': 'MT',
  '31': 'NE', '32': 'NV', '33': 'NH', '34': 'NJ', '35': 'NM', '36': 'NY', '37': 'NC', '38': 'ND', '39': 'OH',
  '40': 'OK', '41': 'OR', '42': 'PA', '44': 'RI', '45': 'SC', '46': 'SD', '47': 'TN', '48': 'TX', '49': 'UT',
  '50': 'VT', '51': 'VA', '53': 'WA', '54': 'WV', '55': 'WI', '56': 'WY',
  '60': 'AS', '66': 'GU', '69': 'MP', '72': 'PR', '78': 'VI',
}
const NAME_TO_CODE = {}

// Territories use their own ISO country codes, but "US-AS" style codes are also valid ISO 3166-2.
const regionCode = (usps) => `US-${usps}`

const round = (n, d = 4) => Math.round(n * 10 ** d) / 10 ** d

async function download(url, file, { binary = false, init } = {}) {
  const path = join(CACHE, file)
  if (!REFRESH && existsSync(path)) return binary ? readFile(path) : readFile(path, 'utf8')
  console.log(`  downloading ${url.slice(0, 110)}`)
  const res = await fetch(url, { headers: { 'User-Agent': 'Travel-Log build script' }, ...init })
  if (!res.ok) throw new Error(`${res.status} for ${url}`)
  const buf = Buffer.from(await res.arrayBuffer())
  await writeFile(path, buf)
  return binary ? buf : buf.toString('utf8')
}

async function writeJson(name, data) {
  const text = JSON.stringify(data)
  await writeFile(join(DATA, name), text + '\n')
  console.log(`  wrote src/data/${name} (${Math.round(text.length / 1024)} KB)`)
}

// ---------- States ----------

async function buildStates() {
  console.log('States')
  const topo = JSON.parse(readFileSync(join(ROOT, 'node_modules/us-atlas/states-10m.json'), 'utf8'))
  for (const g of topo.objects.states.geometries) {
    const usps = STATE_CODES[g.id]
    if (!usps) throw new Error(`No state code for FIPS ${g.id}`)
    NAME_TO_CODE[g.properties.name] = usps
    g.properties = { name: g.properties.name, code: regionCode(usps) }
    g.id = regionCode(usps)
  }
  NAME_TO_CODE['U.S. Virgin Islands'] = 'VI'
  NAME_TO_CODE['United States Virgin Islands'] = 'VI'
  await writeJson('us-states.json', topo)
}

// ---------- National parks ----------

function parseWikiParks(wikitext) {
  const table = wikitext.slice(wikitext.indexOf('{|'), wikitext.indexOf('\n|}'))
  const rows = table.split('\n|-').slice(1)
  return rows.map((row) => {
    const name = row.match(/\n!(?:scope="row"[^|\n]*\|)?\s*\[\[([^|\]]+)(?:\|([^\]]+))?\]\]/)
    const coord = row.match(/\{\{coord\|(-?[\d.]+)\|(-?[\d.]+)/)
    const date = row.match(/\n\|\s*(?:\{\{dts\|)?([A-Z][a-z]+ \d{1,2}, \d{4})/)
    const acres = row.match(/\{\{convert\|([\d,.]+)\|acre/)
    const cells = row.split('\n|')
    const locationCell = cells.find((c) => c.includes('{{coord')) || ''
    const states = [...locationCell.split('<br')[0].matchAll(/\[\[([^|\]]+)(?:\|[^\]]+)?\]\]/g)].map((m) => m[1].replace(/ \(state\)$/, '').trim())
    return {
      article: name?.[1],
      shortName: (name?.[2] || name?.[1] || '').replace(/&nbsp;/g, ' ').trim(),
      lat: coord ? Number(coord[1]) : null,
      lng: coord ? Number(coord[2]) : null,
      established: date ? new Date(`${date[1]} UTC`).toISOString().slice(0, 10) : null,
      areaAcres: acres ? Math.round(Number(acres[1].replace(/,/g, ''))) : null,
      states,
    }
  })
}

const slug = (s) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/['’ʻ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

const simplifyName = (s) => slug(s.replace(/ \([^)]*\)$/, '').replace(/national (park|monument)( (and|&) preserve)?|national and state parks|national park of/gi, '').replace(/wrangell.st\.? elias/i, 'wrangell st elias'))

async function buildParks() {
  console.log('National parks')
  // New River Gorge is filed as a "park and preserve". Parks redesignated recently may still be
  // filed under their old unit type, so they are added by code (Chiricahua: monument → park, Oct 2026).
  const where = encodeURIComponent(`UNIT_TYPE LIKE 'National Park%' OR UNIT_CODE IN (${EXTRA_UNITS.map((c) => `'${c}'`).join(',')})`)
  const listUrl = `${NPS_BOUNDARIES}?where=${where}&outFields=UNIT_CODE,UNIT_NAME,UNIT_TYPE&returnGeometry=false&f=json`
  const list = JSON.parse(await download(listUrl, 'nps-park-list.json')).features.map((f) => f.attributes)
  console.log(`  NPS boundary service: ${list.length} units`)

  const wiki = parseWikiParks(JSON.parse(await download(WIKI, 'wiki-national-parks.json')).parse.wikitext)
  console.log(`  Wikipedia list: ${wiki.length} parks`)
  if (list.length !== wiki.length) throw new Error(`Park count mismatch: NPS ${list.length}, Wikipedia ${wiki.length}`)

  const wikiByKey = new Map(wiki.map((w) => [simplifyName(w.article), w]))
  const parks = list.map((u) => {
    const w = wikiByKey.get(simplifyName(u.UNIT_NAME))
    if (!w) throw new Error(`No Wikipedia row for ${u.UNIT_NAME} (${simplifyName(u.UNIT_NAME)})`)
    const states = w.states.map((s) => {
      const code = NAME_TO_CODE[s]
      if (!code) throw new Error(`Unknown state "${s}" for ${u.UNIT_NAME}`)
      return regionCode(code)
    })
    const name = u.UNIT_CODE === 'NPSA' ? 'American Samoa' : w.shortName
    return {
      id: slug(name),
      name,
      fullName: u.UNIT_CODE === 'NPSA' ? 'National Park of American Samoa' : `${name} National Park`,
      npsCode: u.UNIT_CODE.toLowerCase(),
      states,
      lat: w.lat,
      lng: w.lng,
      established: w.established,
      areaAcres: w.areaAcres,
    }
  })
  parks.sort((a, b) => a.name.localeCompare(b.name))
  await writeJson('national-parks.json', parks)

  // Boundaries: fetch in WGS84, simplify with mapshaper, store as TopoJSON keyed by park id.
  const codes = parks.map((p) => `'${p.npsCode.toUpperCase()}'`).join(',')
  const geoUrl = `${NPS_BOUNDARIES}?where=${encodeURIComponent(`UNIT_CODE IN (${codes})`)}&outFields=UNIT_CODE&outSR=4326&geometryPrecision=5&maxAllowableOffset=0.0003&f=geojson`
  const geo = JSON.parse(await download(geoUrl, 'nps-park-boundaries.geojson'))
  const idByCode = new Map(parks.map((p) => [p.npsCode.toUpperCase(), p.id]))
  geo.features = geo.features.map((f) => ({ type: 'Feature', properties: { id: idByCode.get(f.properties.UNIT_CODE) }, geometry: f.geometry }))
  const out = await mapshaper.applyCommands(
    // Detailed enough for a crisp outline at park zoom (~z10) while staying a few hundred KB.
    '-i parks.json -dissolve id -simplify interval=60 keep-shapes -clean -o format=topojson quantization=1e6 parks-out.json',
    { 'parks.json': JSON.stringify(geo) },
  )
  const topo = JSON.parse(out['parks-out.json'])
  topo.objects = { parks: Object.values(topo.objects)[0] }
  const missing = parks.filter((p) => !topo.objects.parks.geometries.some((g) => g.properties?.id === p.id))
  if (missing.length) throw new Error(`No boundary for ${missing.map((p) => p.name).join(', ')}`)
  await writeJson('park-boundaries.json', topo)
  return parks
}

// ---------- Places (search) ----------

async function buildPlaces() {
  console.log('Places (Census Gazetteer)')
  const zipPath = join(CACHE, 'gazetteer-places.zip')
  await download(GAZETTEER, 'gazetteer-places.zip', { binary: true })
  const tsv = execFileSync('unzip', ['-p', zipPath], { maxBuffer: 64 * 1024 * 1024 }).toString('utf8')
  const [header, ...lines] = tsv.trim().split(/\r?\n/)
  const cols = header.split('\t').map((c) => c.trim())
  const col = (name) => cols.indexOf(name)
  const [iState, iGeoid, iName, iLat, iLng] = [col('USPS'), col('GEOID'), col('NAME'), col('INTPTLAT'), col('INTPTLONG')]

  // 2024 population for incorporated places, keyed like the Gazetteer's GEOID (state + place code).
  const popCsv = await download(POPULATION, 'census-population.csv', { binary: true })
  const popLines = popCsv.toString('latin1').trim().split(/\r?\n/)
  const popCols = popLines[0].split(',')
  const [pSum, pState, pPlace, pPop] = ['SUMLEV', 'STATE', 'PLACE', 'POPESTIMATE2024'].map((c) => popCols.indexOf(c))
  const population = new Map()
  for (const line of popLines.slice(1)) {
    const f = line.split(',')
    if (f[pSum] === '162') population.set(f[pState] + f[pPlace], Number(f[pPop]))
  }
  // Unincorporated places (CDPs, e.g. "Urban Honolulu") aren't in it: use Natural Earth's big cities.
  const ne = JSON.parse(await download(`${NE}/ne_10m_populated_places_simple.geojson`, 'ne-populated-places.geojson')).features.filter(
    (f) => f.properties.adm0_a3 === 'USA',
  )
  const fromNaturalEarth = (name, lat, lng) => {
    const n = name.toLowerCase().replace(/^urban /, '')
    const city = ne.find((f) => {
      const [x, y] = f.geometry.coordinates
      return f.properties.name.toLowerCase() === n && Math.abs(y - lat) < 0.4 && Math.abs(x - lng) < 0.5
    })
    return city ? city.properties.pop_max : 0
  }

  const places = lines.map((line) => {
    const f = line.split('\t')
    const name = f[iName]
      .replace(/ (city and borough|consolidated government|metropolitan government|unified government|urban county)( \(balance\))?$/i, '')
      .replace(/ \(balance\)$/i, '')
      .replace(/ (city|town|village|borough|CDP|municipality|comunidad|zona urbana)$/i, '')
      // The Census calls Honolulu's CDP "Urban Honolulu".
      .replace(/^Urban (?=Honolulu$)/, '')
    const lat = round(Number(f[iLat]))
    const lng = round(Number(f[iLng].trim()))
    return [name, f[iState], lat, lng, population.get(f[iGeoid]) ?? fromNaturalEarth(name, lat, lng)]
  })
  // Compact rows: [name, USPS state, lat, lng, population]. Region code is "US-" + state.
  await writeJson('us-places.json', places)
}

// ---------- Cities (labels) and lakes ----------

async function buildCitiesAndLakes() {
  console.log('Cities and lakes (Natural Earth)')
  const placesGeo = JSON.parse(await download(`${NE}/ne_10m_populated_places_simple.geojson`, 'ne-populated-places.geojson'))
  const cities = placesGeo.features
    .filter((f) => f.properties.adm0_a3 === 'USA' || ['ASM', 'VIR', 'PRI', 'GUM', 'MNP'].includes(f.properties.adm0_a3))
    .map((f) => ({
      name: f.properties.name,
      pop: f.properties.pop_max,
      rank: f.properties.scalerank,
      capital: f.properties.adm0cap === 1 || /capital/i.test(f.properties.featurecla),
      lng: round(f.geometry.coordinates[0], 3),
      lat: round(f.geometry.coordinates[1], 3),
    }))
    .sort((a, b) => b.pop - a.pop)
  await writeJson('us-cities.json', {
    type: 'FeatureCollection',
    features: cities.map(({ lng, lat, ...p }) => ({ type: 'Feature', properties: p, geometry: { type: 'Point', coordinates: [lng, lat] } })),
  })

  const lakes = JSON.parse(await download(`${NE}/ne_50m_lakes.geojson`, 'ne-lakes.geojson'))
  // Lower 48 + Alaska + Hawaii, generously, so border lakes (Great Lakes, Lake of the Woods) are included.
  const inUs = (f) => {
    const [x, y] = f.geometry.type === 'Polygon' ? f.geometry.coordinates[0][0] : f.geometry.coordinates[0][0][0]
    return (x > -180 && x < -52 && y > 18 && y < 72)
  }
  lakes.features = lakes.features.filter(inUs).map((f) => ({ type: 'Feature', properties: { name: f.properties.name }, geometry: f.geometry }))
  const out = await mapshaper.applyCommands('-i lakes.json -simplify 40% keep-shapes -o precision=0.001 lakes-out.json', {
    'lakes.json': JSON.stringify(lakes),
  })
  await writeJson('us-lakes.json', JSON.parse(out['lakes-out.json']))
}

// ---------- Countries ----------

async function buildCountries() {
  console.log('Countries (Natural Earth)')
  const geo = JSON.parse(await download(`${NE}/ne_50m_admin_0_countries.geojson`, 'ne-countries.geojson'))
  geo.features = geo.features.map((f) => ({
    type: 'Feature',
    properties: { iso: f.properties.ISO_A2_EH, name: f.properties.NAME },
    geometry: f.geometry,
  }))
  const out = await mapshaper.applyCommands(
    '-i countries.json -simplify 20% keep-shapes -clean -o format=topojson quantization=1e5 countries-out.json',
    { 'countries.json': JSON.stringify(geo) },
  )
  const topo = JSON.parse(out['countries-out.json'])
  topo.objects = { countries: Object.values(topo.objects)[0] }
  await writeJson('world-countries.json', topo)
}

// ---------- World cities (search) ----------

// The US and its territories come from the Census list instead.
const US_AND_TERRITORIES = new Set(['US', 'PR', 'GU', 'VI', 'AS', 'MP', 'UM'])
// Parts of a city (neighborhoods) and places that no longer exist clutter the search.
const SKIP_FEATURES = new Set(['PPLX', 'PPLH', 'PPLQ', 'PPLW'])

async function buildWorldCities() {
  console.log('World cities (GeoNames)')
  const zipPath = join(CACHE, 'geonames-cities15000.zip')
  await download(`${GEONAMES}/cities15000.zip`, 'geonames-cities15000.zip', { binary: true })
  const tsv = execFileSync('unzip', ['-p', zipPath], { maxBuffer: 64 * 1024 * 1024 }).toString('utf8')
  const countries = {}
  for (const line of (await download(`${GEONAMES}/countryInfo.txt`, 'geonames-countries.txt')).split('\n')) {
    if (!line || line.startsWith('#')) continue
    const cols = line.split('\t')
    countries[cols[0]] = cols[4]
  }
  const regions = new Map()
  for (const line of (await download(`${GEONAMES}/admin1CodesASCII.txt`, 'geonames-admin1.txt')).split('\n')) {
    const [code, name] = line.split('\t')
    if (code) regions.set(code, name)
  }
  // [name, region (state / province), country code, lat, lng, population], biggest first.
  const cities = []
  for (const line of tsv.split('\n')) {
    const c = line.split('\t')
    if (c.length < 15 || US_AND_TERRITORIES.has(c[8]) || SKIP_FEATURES.has(c[7]) || !countries[c[8]]) continue
    cities.push([c[1], regions.get(`${c[8]}.${c[10]}`) ?? '', c[8], round(Number(c[4])), round(Number(c[5])), Number(c[14]) || 0])
  }
  cities.sort((a, b) => b[5] - a[5])
  const used = new Set(cities.map((c) => c[2]))
  const names = Object.fromEntries(Object.entries(countries).filter(([code]) => used.has(code) || code === 'US'))
  await writeJson('world-cities.json', { countries: names, cities })
  console.log(`  ${cities.length} cities in ${used.size} countries`)
}

// ---------- Fonts ----------

async function buildFonts() {
  console.log('Label fonts')
  for (const stack of FONT_STACKS) {
    await mkdir(join(FONTS, stack), { recursive: true })
    for (const range of GLYPH_RANGES) {
      const buf = await download(`${GLYPHS}/${encodeURIComponent(stack)}/${range}.pbf`, `font-${slug(stack)}-${range}.pbf`, { binary: true })
      await writeFile(join(FONTS, stack, `${range}.pbf`), buf)
    }
  }
  console.log(`  wrote public/fonts/ (${FONT_STACKS.length} fonts × ${GLYPH_RANGES.length} ranges)`)
}

await mkdir(CACHE, { recursive: true })
await mkdir(DATA, { recursive: true })
if (ONLY === 'world-cities') {
  await buildWorldCities()
  process.exit(0)
}
await buildStates()
const parks = await buildParks()
await buildPlaces()
await buildCitiesAndLakes()
await buildCountries()
await buildWorldCities()
await buildFonts()
console.log(`\nDone. ${parks.length} national parks.`)
