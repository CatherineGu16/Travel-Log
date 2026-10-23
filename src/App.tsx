import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FilterButton, FilterSheet } from './components/FilterSheet.tsx'
import { PageLinks, TabBar } from './components/Navigation.tsx'
import { ParkSheet } from './components/ParkSheet.tsx'
import { ParksLayerControl } from './components/ParksLayerControl.tsx'
import { ParksPage } from './components/ParksPage.tsx'
import { PeopleSheet } from './components/PeopleSheet.tsx'
import { Settings } from './components/Settings.tsx'
import { SyncChip } from './components/SyncChip.tsx'
import { PinCard } from './components/PinCard.tsx'
import { PlacesPage } from './components/PlacesPage.tsx'
import { ToastProvider } from './components/Toast.tsx'
import { useToast } from './components/toastContext.ts'
import { TripDetail } from './components/TripDetail.tsx'
import { TripForm } from './components/TripForm.tsx'
import { TripsPage } from './components/TripsPage.tsx'
import parks from './data/national-parks.json'
import { mainPlaceIds, parksVisited, pinsOf, statesVisited, tripsPerRegion } from './lib/derive.ts'
import { filterData, NO_FILTER, reviveFilter, type TripFilter } from './lib/filters.ts'
import { placeAt } from './lib/gazetteer.ts'
import { parkInput, type ParkInfo } from './lib/placeSearch.ts'
import { routeOf } from './lib/route.ts'
import { live, type PlaceInput } from './lib/travelActions.ts'
import { todayIso, yearOf } from './lib/partialDate.ts'
import type { Trip } from './lib/types.ts'
import { loadServices, ServicesContext, useStore, useTravelState, type AppServices } from './store/useTravel.ts'
import type { ParksMode } from './map/MapView.tsx'
import { useMapDetail } from './ui/mapDetail.ts'
import { usePage } from './ui/route.ts'
import { usePersistentState } from './ui/usePersistentState.ts'

// MapLibre is most of the app's code, so it loads as its own chunk after the shell.
const MapView = lazy(() => import('./map/MapView.tsx').then((m) => ({ default: m.MapView })))

export default function App() {
  const [services, setServices] = useState<AppServices | null>(null)
  useEffect(() => {
    void loadServices().then(setServices)
  }, [])
  if (!services) return <div className="h-full w-full bg-bg" />
  return (
    <ServicesContext.Provider value={services}>
      <ToastProvider>
        <Shell />
      </ToastProvider>
    </ServicesContext.Provider>
  )
}

type FormState = { trip: Trip | null; initialMain: PlaceInput | null }
type PickRequest = { label: string; resolve: (p: PlaceInput | null) => void }

function Shell() {
  const store = useStore()
  const { data, error } = useTravelState()
  const { page, goTo } = usePage()
  const toast = useToast()
  const detailed = useMapDetail() === 'detailed'

  // Filters are shared by the map and the lists, and remembered on this device.
  const [filter, setFilter] = usePersistentState<TripFilter>('travel.filter.v1', NO_FILTER, reviveFilter)
  const [filterOpen, setFilterOpen] = useState(false)
  const shown = useMemo(() => filterData(data, filter), [data, filter])

  const pins = useMemo(() => pinsOf(shown), [shown])
  const perRegion = useMemo(() => tripsPerRegion(shown), [shown])
  // Header totals always count everything, whatever the filter.
  const visitedParks = useMemo(() => parksVisited(data), [data])
  const thisYear = yearOf(todayIso())
  const totals = useMemo(
    () => ({
      states: statesVisited(tripsPerRegion(data)),
      parks: visitedParks.size,
      thisYear: live(data.trips).filter((t) => yearOf(t.startDate) === thisYear).length,
    }),
    [data, visitedParks, thisYear],
  )
  const [parksMode, setParksMode] = usePersistentState<ParksMode>('travel.parksLayer', 'off', (v) =>
    v === 'all' || v === 'visited' || v === 'not-visited' ? v : 'off',
  )
  const [parkSheetId, setParkSheetId] = useState<string | null>(null)

  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null)
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null)
  const [detailTripId, setDetailTripId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState | null>(null)
  const [pick, setPick] = useState<PickRequest | null>(null)
  const [peopleOpen, setPeopleOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [focus, setFocus] = useState<{ lng: number; lat: number; token: number } | null>(null)
  const focusToken = useRef(0)

  const onMap = page === 'map'
  const selectedPin = pins.find((p) => p.place.id === selectedPlaceId) ?? null
  // The visit shown on the pin card: the one you picked, else the newest.
  const selectedTrip = selectedPin ? (selectedPin.trips.find((t) => t.id === selectedTripId) ?? selectedPin.trips[0]) : null
  const route = useMemo(() => (selectedTrip ? routeOf(selectedTrip, data.places) : []), [selectedTrip, data.places])
  const detailTrip = data.trips.find((t) => t.id === detailTripId && !t.deleted) ?? null

  const selectPin = (placeId: string | null, tripId: string | null = null) => {
    setSelectedPlaceId(placeId)
    setSelectedTripId(tripId ?? pins.find((p) => p.place.id === placeId)?.trips[0]?.id ?? null)
  }
  /** Moves the map to a trip: a trip with several places is fitted to its route, otherwise centered on its pin. */
  const focusTrip = (tripId: string) => {
    const latest = store.getState().data
    const trip = latest.trips.find((t) => t.id === tripId)
    const place = latest.places.find((p) => p.id === trip?.destinations[0]?.placeId)
    if (place && trip && trip.destinations.length === 1) setFocus({ lng: place.lng, lat: place.lat, token: ++focusToken.current })
  }
  /** Shows a trip on the map: the pin of its (first) main destination selected, and the map moved to it. */
  const showOnMap = (trip: Trip, placeId = mainPlaceIds(trip)[0]) => {
    goTo('map')
    selectPin(placeId, trip.id)
    focusTrip(trip.id)
  }
  const openTrip = (trip: Trip) => {
    selectPin(mainPlaceIds(trip)[0], trip.id)
    setDetailTripId(trip.id)
  }
  const addTrip = () => {
    selectPin(null)
    setForm({ trip: null, initialMain: null })
  }
  /** "Log a visit" to a park: Add trip with the park as the main destination. */
  const logParkVisit = (park: ParkInfo) => {
    setParkSheetId(null)
    selectPin(null)
    setForm({ trip: null, initialMain: parkInput(park) })
  }

  const requestPick = useCallback(
    (label: string) =>
      new Promise<PlaceInput | null>((resolve) => {
        goTo('map')
        setPick({ label, resolve })
      }),
    [goTo],
  )
  const cancelPick = () => {
    pick?.resolve(null)
    setPick(null)
  }

  const filterButton = <FilterButton filter={filter} onClick={() => setFilterOpen(true)} />

  return (
    <div className="flex h-full w-full flex-col">
      <main className="relative min-h-0 flex-1 overflow-hidden">
        <Suspense fallback={<div className="h-full w-full bg-bg" />}>
          <MapView
            pins={pins}
            tripsPerRegion={perRegion}
            selectedPlaceId={selectedPin ? selectedPlaceId : null}
            route={route}
            routeTripId={selectedTrip?.id ?? null}
            onSelectPin={(placeId) => selectPin(placeId)}
            onAddAt={(lng, lat) => {
              void placeAt(lng, lat).then((initialMain) => {
                selectPin(null)
                setForm({ trip: null, initialMain })
              })
            }}
            picking={pick !== null}
            onPick={(lng, lat) => {
              const request = pick
              setPick(null)
              void placeAt(lng, lat).then((p) => request?.resolve(p))
            }}
            parksMode={parksMode}
            visitedParks={visitedParks}
            onSelectPark={setParkSheetId}
            detailed={detailed}
            onDetailedFailed={() => toast("The detailed map couldn't load (offline?). Showing the outline map.")}
            focus={focus}
          />
        </Suspense>

        {page === 'trips' && (
          <div className="absolute inset-0 z-10 overflow-y-auto bg-bg">
            <TripsPage data={shown} toolbar={filterButton} onOpenTrip={showOnMap} />
          </div>
        )}
        {page === 'parks' && (
          <div className="absolute inset-0 z-10 overflow-y-auto bg-bg">
            <ParksPage data={data} onOpenPark={setParkSheetId} onLogVisit={logParkVisit} />
          </div>
        )}
        {page === 'places' && (
          <div className="absolute inset-0 z-10 overflow-y-auto bg-bg">
            <PlacesPage data={shown} toolbar={filterButton} onOpenTrip={showOnMap} />
          </div>
        )}

        <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-center px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <div className="pointer-events-auto flex items-center gap-2 rounded-xl border border-line bg-surface/95 py-1.5 pr-1 pl-3 whitespace-nowrap shadow-md sm:gap-3 sm:pl-4">
            <h1 className="font-display text-xl font-semibold tracking-wide sm:text-2xl">Travel Log</h1>
            <PageLinks page={page} onAdd={addTrip} />
            <dl className="flex gap-2 text-sm text-muted sm:hidden sm:gap-3 lg:flex">
              <div className="flex gap-1">
                <dt className="sr-only">States visited</dt>
                <dd>
                  <span className="font-bold text-fg">{totals.states}</span> / 50 states
                </dd>
              </div>
              <div className="flex gap-1">
                <dt className="sr-only">National parks visited</dt>
                <dd>
                  <span className="font-bold text-park">{totals.parks}</span> / {parks.length} parks
                </dd>
              </div>
              <div className="hidden gap-1 xl:flex">
                <dt className="sr-only">Trips this year</dt>
                <dd>
                  <span className="font-bold text-fg">{totals.thisYear}</span> {totals.thisYear === 1 ? 'trip' : 'trips'} in {thisYear}
                </dd>
              </div>
            </dl>
            <button
              onClick={() => setPeopleOpen(true)}
              aria-label="People & groups"
              title="People & groups"
              className="grid size-10 place-items-center rounded-lg text-muted hover:bg-raised hover:text-fg"
            >
              <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
                <circle cx="9" cy="8" r="3.5" fill="none" stroke="currentColor" strokeWidth="2" />
                <path d="M2.5 20c.6-3.6 3.3-5.5 6.5-5.5s5.9 1.9 6.5 5.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <circle cx="17" cy="9" r="2.5" fill="none" stroke="currentColor" strokeWidth="2" />
                <path d="M17 14.5c2.4 0 4 1.5 4.5 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
            <SyncChip onSettings={() => setSettingsOpen(true)} />
            <button
              onClick={() => setSettingsOpen(true)}
              aria-label="Settings"
              title="Settings"
              className="-ml-2 grid size-10 place-items-center rounded-lg text-muted hover:bg-raised hover:text-fg"
            >
              <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
                <path
                  fill="currentColor"
                  d="M12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Zm7.4-2.5a7.6 7.6 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7.4 7.4 0 0 0-1.7-1L15 3h-4l-.4 2.6a7.4 7.4 0 0 0-1.7 1l-2.5-1-2 3.5L6.6 11a7.6 7.6 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1a7.4 7.4 0 0 0 1.7 1L11 21h4l.4-2.6a7.4 7.4 0 0 0 1.7-1l2.5 1 2-3.5Z"
                />
              </svg>
            </button>
          </div>
        </header>

        {error && (
          <p role="alert" className="absolute inset-x-3 top-20 z-30 mx-auto max-w-md rounded-lg bg-surface p-3 text-center text-sm text-danger shadow">
            {error}
          </p>
        )}

        {pick && (
          <div className="absolute inset-x-3 top-20 z-30 mx-auto flex max-w-md items-center gap-2 rounded-xl bg-toast py-2 pr-2 pl-4 text-sm text-white shadow-lg">
            <span className="mr-auto">{pick.label}</span>
            <button onClick={cancelPick} className="min-h-10 rounded-lg px-3 font-bold text-[var(--toast-action)] hover:bg-white/10">
              Cancel
            </button>
          </div>
        )}

        {onMap && !pick && (
          <>
            <ShadeLegend show={perRegion.size > 0 || pins.length > 0} />
            <div className="absolute top-[calc(max(0.75rem,env(safe-area-inset-top))+4.25rem)] left-3 z-10 flex gap-2 sm:top-20 sm:right-3 sm:left-auto">
              {filterButton}
              <ParksLayerControl mode={parksMode} onChange={setParksMode} visited={visitedParks.size} total={parks.length} />
            </div>
          </>
        )}

        {onMap && selectedPin && selectedTrip && !form && !pick && (
          <div className="pointer-events-none absolute inset-x-3 bottom-[0.75rem] z-20 flex sm:inset-x-auto sm:top-20 sm:bottom-auto sm:left-3">
            <PinCard
              pin={selectedPin}
              trip={selectedTrip}
              route={route}
              data={data}
              onSelectTrip={setSelectedTripId}
              onDetails={(trip) => setDetailTripId(trip.id)}
              onEdit={(trip) => setForm({ trip, initialMain: null })}
              onClose={() => selectPin(null)}
            />
          </div>
        )}

      </main>

      <TabBar page={page} onAdd={addTrip} />

      {parkSheetId && !form && (
        <ParkSheet
          parkId={parkSheetId}
          data={data}
          onLogVisit={logParkVisit}
          onShowTrip={(trip) => {
            setParkSheetId(null)
            showOnMap(trip)
          }}
          onClose={() => setParkSheetId(null)}
        />
      )}

      {detailTrip && !form && (
        <TripDetail
          trip={detailTrip}
          data={data}
          onOpenTrip={openTrip}
          onEdit={(trip) => {
            setDetailTripId(null)
            setForm({ trip, initialMain: null })
          }}
          onClose={() => setDetailTripId(null)}
        />
      )}

      {form && (
        <TripForm
          key={form.trip?.id ?? 'new'}
          trip={form.trip}
          initialMain={form.initialMain}
          hidden={pick !== null}
          requestPick={requestPick}
          onClose={() => {
            cancelPick()
            setForm(null)
          }}
          onSaved={(mainPlaceId, tripId) => {
            setForm(null)
            goTo('map')
            setSelectedPlaceId(mainPlaceId)
            setSelectedTripId(tripId)
            focusTrip(tripId)
          }}
        />
      )}

      <FilterSheet
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        data={data}
        filter={filter}
        onChange={setFilter}
        resultCount={live(shown.trips).length}
      />
      <PeopleSheet open={peopleOpen} onClose={() => setPeopleOpen(false)} />
      <Settings open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  )
}

/** What the pin colors and state shades mean. */
function ShadeLegend({ show }: { show: boolean }) {
  if (!show) return null
  const swatch = (v: string) => <span className="inline-block size-3 rounded-sm border border-line" style={{ background: `var(${v})` }} />
  return (
    <aside
      aria-label="Map legend"
      className="pointer-events-none absolute right-3 bottom-[calc(0.75rem+2.25rem)] z-10 mr-14 hidden rounded-lg border border-line bg-surface/90 px-3 py-2 text-xs text-muted shadow sm:block"
    >
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1">
          <span className="size-2.5 rounded-full bg-primary" /> Place
        </span>
        <span className="flex items-center gap-1">
          <span className="size-2.5 rounded-full bg-park" /> National park
        </span>
      </div>
      <div className="mt-1.5 flex items-center gap-1.5">
        Trips per state
        {swatch('--shade-1')}1{swatch('--shade-2')}2–3{swatch('--shade-3')}4–6{swatch('--shade-4')}7+
      </div>
    </aside>
  )
}
