import type { FeatureCollection, MultiPolygon, Point, Polygon } from 'geojson'
import { feature, mesh } from 'topojson-client'
import type { GeometryCollection, Topology } from 'topojson-specification'

export type StateProps = { name: string; code: string }
export type CountryProps = { iso: string; name: string }
export type CityProps = { name: string; pop: number; rank: number; capital: boolean }

export type OutlineData = {
  countries: FeatureCollection<Polygon | MultiPolygon, CountryProps>
  states: FeatureCollection<Polygon | MultiPolygon, StateProps>
  /** State borders drawn once (shared edges aren't doubled), without coastlines. */
  stateBorders: FeatureCollection
  lakes: FeatureCollection<Polygon | MultiPolygon>
  cities: FeatureCollection<Point, CityProps>
}

/**
 * Loads the bundled outline-map data. Each file is its own chunk, so the app shell loads first and
 * the map fills in a moment later; the service worker caches them for offline use.
 */
export async function loadOutlineData(): Promise<OutlineData> {
  const [statesMod, countriesMod, lakesMod, citiesMod] = await Promise.all([
    import('../data/us-states.json'),
    import('../data/world-countries.json'),
    import('../data/us-lakes.json'),
    import('../data/us-cities.json'),
  ])
  const statesTopo = statesMod.default as unknown as Topology<{ states: GeometryCollection<StateProps> }>
  const countriesTopo = countriesMod.default as unknown as Topology<{ countries: GeometryCollection<CountryProps> }>

  const countries = feature(countriesTopo, countriesTopo.objects.countries) as OutlineData['countries']
  // The US itself is drawn from the state shapes, which are more detailed.
  countries.features = countries.features.filter((f) => f.properties.iso !== 'US')

  return {
    countries,
    states: feature(statesTopo, statesTopo.objects.states) as OutlineData['states'],
    stateBorders: {
      type: 'FeatureCollection',
      features: [{ type: 'Feature', properties: {}, geometry: mesh(statesTopo, statesTopo.objects.states, (a, b) => a !== b) }],
    },
    lakes: lakesMod.default as unknown as OutlineData['lakes'],
    cities: citiesMod.default as unknown as OutlineData['cities'],
  }
}
