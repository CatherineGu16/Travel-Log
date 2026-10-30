import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FilterButton, FilterSheet } from './components/FilterSheet.tsx'
import { TabBar, TopBar } from './components/Navigation.tsx'
import { ParkSheet } from './components/ParkSheet.tsx'
import { ParksLayerControl } from './components/ParksLayerControl.tsx'
import { SyncChip } from './components/SyncChip.tsx'
import { PinCard } from './components/PinCard.tsx'
import { ToastProvider } from './components/Toast.tsx'
import { useToast } from './components/toastContext.ts'
import { TripDetail, type TripStep } from './components/TripDetail.tsx'
import { TripForm, type RequestShape, type RouteEnd } from './components/TripForm.tsx'
import { TripList } from './components/TripList.tsx'
import { PEEK_PX, ShowTripsButton, TripsPanel, TripsSheet, type Crumb, type SheetSize } from './components/TripsPanel.tsx'
import { ProfileAvatar, YouPage } from './components/YouPage.tsx'
import parks from './data/national-parks.json'
import { mainPlaceIds, parksVisited, pinsOf, tripsPerRegion } from './lib/derive.ts'
import { filterData, NO_FILTER, reviveFilter, type TripFilter } from './lib/filters.ts'
import { placeAt } from './lib/gazetteer.ts'
import { parkInput, type ParkInfo } from './lib/placeSearch.ts'
import { legMemory } from './lib/legs.ts'
import { addBend, routeOf, type RoutePoint } from './lib/route.ts'
import { live, type PlaceInput } from './lib/travelActions.ts'
import type { LngLat, Place, Trip } from './lib/types.ts'
import { loadServices, ServicesContext, useStore, useTravelState, type AppServices } from './store/useTravel.ts'
import type { ParksMode } from './map/MapView.tsx'
import { useMapDetail } from './ui/mapDetail.ts'
import { pageHref, parseHash, placeHref, tripHref, useRoute, youHref } from './ui/route.ts'
import { usePersistentState } from './ui/usePersistentState.ts'
import { usePhone } from './ui/usePhone.ts'

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

type FormState = { trip: Trip | null; initialMain: PlaceInput | null; step?: TripStep }
/** Shaping one leg of a route on the map: the bends tapped so far, and earlier versions for Undo. */
type ShapeRequest = {
  from: RouteEnd
  to: RouteEnd
  via: LngLat[]
  follow: LngLat[] | null
  /** The rest of the trip, drawn faintly behind the leg. */
  context: LngLat[][]
  history: LngLat[][]
  resolve: (via: LngLat[] | null) => void
}

function Shell() {
  const store = useStore()
  const { data, error } = useTravelState()
  const { page, placeId: routePlaceId, tripId: detailTripId, section, stat, achievementId, goTo, navigate, close } = useRoute()
  const phone = usePhone()
  const toast = useToast()
  const detailed = useMapDetail() === 'detailed'

  // Filters are shared by the map and the lists, and remembered on this device.
  const [filter, setFilter] = usePersistentState<TripFilter>('travel.filter.v1', NO_FILTER, reviveFilter)
  const [filterOpen, setFilterOpen] = useState(false)
  const shown = useMemo(() => filterData(data, filter), [data, filter])

  const pins = useMemo(() => pinsOf(shown), [shown])
  const perRegion = useMemo(() => tripsPerRegion(shown), [shown])
  // Parks you've been to count everything, whatever the filter.
  const visitedParks = useMemo(() => parksVisited(data), [data])
  const [parksMode, setParksMode] = usePersistentState<ParksMode>('travel.parksLayer', 'off', (v) =>
    v === 'all' || v === 'visited' || v === 'not-visited' ? v : 'off',
  )
  const [parkSheetId, setParkSheetId] = useState<string | null>(null)

  // Which visit to a place is on the map (Trips › Moab): the one you picked or last opened, else the newest.
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState | null>(null)
  const [shape, setShape] = useState<ShapeRequest | null>(null)
  const [focus, setFocus] = useState<{ lng: number; lat: number; token: number } | null>(null)
  const focusToken = useRef(0)
  // Trips over the map: a panel on wider screens (open, or hidden for the full map), a sheet on phones.
  const [panelOpen, setPanelOpen] = useState(true)
  const [sheetSize, setSheetSize] = useState<SheetSize>('peek')

  // The map page shows Trips too: "#/trips…" is the map with the list, a place or a trip open.
  const onMap = page === 'map' || page === 'trips'
  const detailTrip = data.trips.find((t) => t.id === detailTripId && !t.deleted) ?? null
  const placePin = (routePlaceId && pins.find((p) => p.place.id === routePlaceId)) || null
  const placeTrip = placePin ? (placePin.trips.find((t) => t.id === selectedTripId) ?? placePin.trips[0]) : null
  // The trip whose route the map draws: the one open, else the one picked at the place open.
  const drawnTrip = detailTrip ?? placeTrip
  const selectedPlaceId = routePlaceId ?? (detailTrip ? (mainPlaceIds(detailTrip)[0] ?? null) : null)
  const tripRoute = useMemo(() => (drawnTrip ? routeOf(drawnTrip, data.places, { home: data.home, memory: legMemory(data) }) : []), [drawnTrip, data])
  // While you shape a leg, the map shows just that leg, from A to B.
  const shapeRoute = useMemo<RoutePoint[]>(() => {
    if (!shape) return []
    const end = (e: RouteEnd, id: string) => ({ id, name: e.name, lat: e.lat, lng: e.lng }) as Place
    return [
      { place: end(shape.from, 'shape-from'), role: 'stop', number: null, marker: 'A', via: [], leg: null },
      { place: end(shape.to, 'shape-to'), role: 'stop', number: null, marker: 'B', via: shape.via, leg: null },
    ]
  }, [shape])
  // While you edit a trip's route, the map shows it as it stands (the form tells us).
  const [draft, setDraft] = useState<RoutePoint[] | null>(null)
  const editingRoute = form !== null && draft !== null
  const route = shape ? shapeRoute : editingRoute ? draft : tripRoute
  // A leg tapped on the map while editing (wider screens): the form shapes it.
  const [legRequest, setLegRequest] = useState<{ at: number; token: number } | null>(null)
  // Wider screens: the trip form sits in the Trips panel beside the map.
  const formInPanel = form !== null && !phone

  /** Moves the map to a trip: a trip with several places is fitted to its route, otherwise centered on its pin. */
  const focusTrip = (tripId: string) => {
    const latest = store.getState().data
    const trip = latest.trips.find((t) => t.id === tripId)
    const place = latest.places.find((p) => p.id === trip?.destinations[0]?.placeId)
    if (place && trip && trip.destinations.length === 1) setFocus({ lng: place.lng, lat: place.lat, token: ++focusToken.current })
  }
  // Opening a place or a trip (a pin, a link, Back) brings Trips into view; a trip you open is the
  // one shown when you go back to its place. Phones: the bare map lets the sheet drop to peeking.
  const routeKey = `${page}|${routePlaceId}|${detailTrip?.id}`
  const [seenRoute, setSeenRoute] = useState<string | null>(null)
  if (routeKey !== seenRoute) {
    setSeenRoute(routeKey)
    if (detailTrip) setSelectedTripId(detailTrip.id)
    if (page === 'trips') {
      setPanelOpen(true)
      if (sheetSize === 'peek') setSheetSize('half')
    } else if (page === 'map') setSheetSize('peek')
  }
  /** The phone sheet's size; at the list, peeking is the bare map ("#/") and taller is "#/trips". */
  const sizeSheet = (size: SheetSize) => {
    setSheetSize(size)
    if (routePlaceId || detailTrip) return
    if (size === 'peek' && page === 'trips') navigate(pageHref('map'), { replace: true })
    if (size !== 'peek' && page === 'map') navigate(pageHref('trips'), { replace: true })
  }

  /** Shows a trip open over the map, and the map moved to it. */
  const showOnMap = (trip: Trip) => {
    navigate(tripHref(trip.id))
    focusTrip(trip.id)
  }
  /** A place from Most visited: its trips open over the map, and the map moved there. */
  const openPlace = (place: Place) => {
    navigate(placeHref(place.id))
    setFocus({ lng: place.lng, lat: place.lat, token: ++focusToken.current })
  }
  /** A map pin opens its place's trips; tapping the bare map on a phone lowers the sheet. */
  const choosePin = (placeId: string | null) => {
    if (placeId) navigate(placeHref(placeId))
    else if (phone && sheetSize !== 'peek') sizeSheet('peek')
  }

  /** A trip's details, at its own address. */
  const openTrip = (trip: Trip) => navigate(tripHref(trip.id))
  // Closing a trip goes back up: to its place when you came from a pin, else to the list.
  const closeTrip = () => close(routePlaceId ? placeHref(routePlaceId) : pageHref('trips'))
  /** Opens the trip form: in the Trips panel over the map on wider screens, a sheet on phones. */
  const openForm = (next: FormState) => {
    finishShape(null)
    if (!phone) {
      if (page === 'you') navigate(pageHref('trips'))
      setPanelOpen(true)
    }
    setForm(next)
  }
  const addTrip = () => openForm({ trip: null, initialMain: null })
  /** "Log a visit" to a park: Add trip with the park as the main destination. */
  const logParkVisit = (park: ParkInfo) => {
    setParkSheetId(null)
    openForm({ trip: null, initialMain: parkInput(park) })
  }

  const requestShape = useCallback<RequestShape>(
    (from, to, via, follow, context) =>
      new Promise((resolve) => {
        // Trips are on the map too, so an open trip stays open behind the shaping.
        const { page } = parseHash(window.location.hash)
        if (page !== 'map' && page !== 'trips') goTo('map')
        // Shaping another leg first lets go of the one you were on.
        setShape((prev) => {
          prev?.resolve(null)
          return { from, to, via, follow, context, history: [], resolve }
        })
      }),
    [goTo],
  )
  const finishShape = (via: LngLat[] | null) => {
    shape?.resolve(via)
    setShape(null)
  }
  const changeShape = (via: LngLat[]) => setShape((s) => s && { ...s, via, history: [...s.history, s.via] })
  // Dragging a bend: it moves as you drag, and Undo puts back where it was before the drag.
  const dragStart = useRef<LngLat[] | null>(null)
  const dragBend = (index: number, point: LngLat, done: boolean) => {
    if (!shape) return
    dragStart.current ??= shape.via
    const before = dragStart.current
    if (done) dragStart.current = null
    setShape((s) => s && { ...s, via: s.via.map((v, k) => (k === index ? point : v)), history: done ? [...s.history, before] : s.history })
  }

  // Where you are in Trips: Trips › Moab › Moab 2021.
  const crumbPlace = routePlaceId ? data.places.find((p) => p.id === routePlaceId) : undefined
  const crumbs: Crumb[] = [{ label: 'Trips', href: routePlaceId || detailTrip ? pageHref('trips') : undefined }]
  if (crumbPlace) crumbs.push({ label: crumbPlace.name, href: detailTrip ? placeHref(crumbPlace.id) : undefined })
  if (detailTrip) crumbs.push({ label: detailTrip.title })
  // The form in the panel: Trips › Add trip, or Trips › Utah 2023 › Edit trip (no links while it's open).
  const formCrumbs: Crumb[] = form ? [{ label: 'Trips' }, ...(form.trip ? [{ label: form.trip.title }] : []), { label: form.trip ? 'Edit trip' : 'Add trip' }] : []

  const filterButton = <FilterButton filter={filter} onClick={() => setFilterOpen(true)} />
  const tripForm = form && (
    <TripForm
      key={form.trip?.id ?? 'new'}
      trip={form.trip}
      initialMain={form.initialMain}
      initialStep={form.step}
      inline={!phone}
      hidden={phone && shape !== null}
      onDraftRoute={setDraft}
      shapeLegAt={legRequest}
      requestShape={requestShape}
      onClose={() => {
        finishShape(null)
        setForm(null)
      }}
      onSaved={(mainPlaceId, tripId) => {
        setForm(null)
        setSelectedTripId(tripId)
        // The trip stays open if it was; otherwise its place's trips open, with it on the map.
        if (detailTripId !== tripId) navigate(placeHref(mainPlaceId))
        focusTrip(tripId)
      }}
    />
  )
  // What's in the Trips panel or sheet: a trip, a place's trips (a pin), or every trip.
  const tripsView = detailTrip ? (
    <TripDetail
      trip={detailTrip}
      data={data}
      onOpenTrip={openTrip}
      onEdit={(trip: Trip, step?: TripStep) => setForm({ trip, initialMain: null, step })}
      onTag={(tag) => {
        setFilter({ ...filter, tag })
        navigate(pageHref('trips'), { replace: true })
      }}
      onOpenPark={setParkSheetId}
      onClose={closeTrip}
    />
  ) : routePlaceId ? (
    placePin && placeTrip ? (
      <PinCard
        pin={placePin}
        trip={placeTrip}
        data={data}
        onSelectTrip={setSelectedTripId}
        onDetails={(trip) => navigate(placeHref(placePin.place.id, trip.id))}
        onEdit={(trip) => setForm({ trip, initialMain: null })}
        onClose={() => navigate(pageHref('trips'))}
      />
    ) : (
      <p className="p-4 text-sm text-muted">No trips here match the filter.</p>
    )
  ) : (
    <div className="min-h-0 flex-1 overflow-y-auto p-3">
      <TripList data={shown} onOpenTrip={showOnMap} />
    </div>
  )

  return (
    <div className="flex h-full w-full flex-col">
      <TopBar
        page={page}
        sync={<SyncChip onSettings={() => navigate(youHref('settings'))} />}
        you={
          <a
            href={youHref('profile')}
            aria-label="Your profile"
            aria-current={page === 'you' ? 'page' : undefined}
            className={`hidden rounded-full ring-offset-2 ring-offset-surface sm:block ${page === 'you' ? 'ring-2 ring-primary' : 'hover:ring-2 hover:ring-line'}`}
          >
            <ProfileAvatar data={data} size={36} />
          </a>
        }
      />
      <main className="relative min-h-0 flex-1 overflow-hidden">
        {/* Phones: the map ends where the peeking Trips sheet starts, so its buttons stay above it. */}
        <div className="absolute inset-x-0 top-0 bottom-[var(--peek)] sm:bottom-0" style={{ '--peek': `${PEEK_PX}px` } as React.CSSProperties}>
        <Suspense fallback={<div className="h-full w-full bg-bg" />}>
          <MapView
            pins={pins}
            tripsPerRegion={perRegion}
            selectedPlaceId={selectedPlaceId}
            route={route}
            // A draft refits when a place is added or removed.
            routeTripId={shape ? 'shaping' : editingRoute ? `draft:${draft.length}` : (drawnTrip?.id ?? null)}
            showBends={shape !== null}
            onDragBend={dragBend}
            contextLines={shape?.context}
            onSelectPin={choosePin}
            onAddAt={(lng, lat) => {
              void placeAt(lng, lat).then((initialMain) => {
                setForm({ trip: null, initialMain })
              })
            }}
            picking={shape !== null}
            onPick={(lng, lat) => shape && changeShape(addBend([shape.from.lng, shape.from.lat], shape.via, [shape.to.lng, shape.to.lat], [lng, lat]))}
            parksMode={parksMode}
            visitedParks={visitedParks}
            onSelectPark={setParkSheetId}
            detailed={detailed}
            onDetailedFailed={() => toast("The detailed map couldn't load (offline?). Showing the outline map.")}
            focus={focus}
            onPickLeg={formInPanel && editingRoute && !shape ? (at) => setLegRequest({ at, token: Date.now() }) : undefined}
            leftInset={!phone && onMap && panelOpen ? 428 : 0}
          />
        </Suspense>
        </div>

        {page === 'you' && (
          <div className="absolute inset-0 z-10 overflow-y-auto bg-bg">
            <YouPage
              data={data}
              section={section}
              stat={stat}
              achievementId={achievementId}
              onOpenPlace={openPlace}
              onOpenTrip={showOnMap}
              onClose={close}
              onSection={(s) => navigate(youHref(s))}
              onOpenPark={setParkSheetId}
              onLogVisit={logParkVisit}
            />
          </div>
        )}

        {error && (
          <p role="alert" className="absolute inset-x-3 top-3 z-30 mx-auto max-w-md rounded-lg bg-surface p-3 text-center text-sm text-danger shadow">
            {error}
          </p>
        )}

        {shape && (
          <div
            role="region"
            aria-label="Shape the route"
            // Wider screens with the trip form in the panel: centered over the map beside it.
            className={`absolute inset-x-3 top-3 z-30 mx-auto flex max-w-md flex-col gap-2.5 rounded-2xl border border-line bg-surface p-3 text-sm shadow-[0_8px_30px_rgb(0_0_0/0.25)] ${formInPanel && panelOpen ? 'sm:left-[27.5rem]' : ''}`}
          >
            <div className="flex min-w-0 items-center gap-1.5">
              <RouteBadge>A</RouteBadge>
              <b className="min-w-0 truncate">{shape.from.name}</b>
              <svg viewBox="0 0 20 20" className="size-4 shrink-0 text-muted" aria-hidden>
                <path d="M4 10h11m-4-4 4 4-4 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <RouteBadge>B</RouteBadge>
              <b className="min-w-0 truncate">{shape.to.name}</b>
            </div>
            <p className="-mt-1 text-xs text-muted">Tap the map to add a bend · drag a dot to move it</p>
            {shape.follow && (
              <button
                onClick={() => changeShape(shape.follow!)}
                className="flex items-center gap-2.5 rounded-xl border border-[var(--route)]/40 bg-[var(--route)]/10 px-3 py-2 text-left hover:bg-[var(--route)]/15"
              >
                <svg viewBox="0 0 20 20" className="size-5 shrink-0 text-[var(--route)]" aria-hidden>
                  <path d="M8 5 4 9l4 4M4 9h7a5 5 0 0 1 0 10H9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="min-w-0">
                  <span className="block font-bold text-[var(--route)]">Follow the way you came</span>
                  <span className="block text-xs text-muted">Along your route, then off where it’s nearest B</span>
                </span>
              </button>
            )}
            <div className="flex items-center gap-1 border-t border-line pt-2">
              <button
                onClick={() => setShape((s) => s && { ...s, via: s.history.at(-1) ?? [], history: s.history.slice(0, -1) })}
                disabled={shape.history.length === 0}
                className="flex min-h-10 items-center gap-1 rounded-lg px-2 font-bold text-fg hover:bg-raised disabled:opacity-35"
              >
                <svg viewBox="0 0 20 20" className="size-4" aria-hidden>
                  <path d="M7 4 3 8l4 4M3 8h9a5 5 0 0 1 0 10h-2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Undo
              </button>
              <button
                onClick={() => changeShape([])}
                disabled={shape.via.length === 0}
                className="flex min-h-10 items-center gap-1 rounded-lg px-2 font-bold text-fg hover:bg-raised disabled:opacity-35"
              >
                <svg viewBox="0 0 20 20" className="size-4" aria-hidden>
                  <path d="M3 15 17 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                Straighten
              </button>
              <button onClick={() => finishShape(null)} className="ml-auto min-h-10 rounded-lg px-3 font-bold text-muted hover:bg-raised hover:text-fg">
                Cancel
              </button>
              <button onClick={() => finishShape(shape.via)} className="min-h-10 rounded-lg bg-primary px-4 font-bold text-on-primary">
                Done
              </button>
            </div>
          </div>
        )}

        {onMap && !shape && (
          <>
            <ShadeLegend show={perRegion.size > 0 || pins.length > 0} />
            <div className="absolute top-3 left-3 z-10 flex gap-2 sm:right-3 sm:left-auto">
              {filterButton}
              <ParksLayerControl mode={parksMode} onChange={setParksMode} visited={visitedParks.size} total={parks.length} />
            </div>
          </>
        )}

        {/* The trip form stays in the panel (hidden off the map) until you save or cancel, so nothing typed is lost. */}
        {!phone && (formInPanel || (onMap && panelOpen && !shape)) && (
          <TripsPanel
            crumbs={formInPanel ? formCrumbs : crumbs}
            onAdd={formInPanel ? undefined : addTrip}
            onCollapse={formInPanel ? undefined : () => setPanelOpen(false)}
            hidden={!onMap}
          >
            {formInPanel ? tripForm : tripsView}
          </TripsPanel>
        )}
        {onMap && !shape && !phone && !panelOpen && !formInPanel && <ShowTripsButton onClick={() => setPanelOpen(true)} />}
        {onMap && !shape && phone && (
          <TripsSheet crumbs={crumbs} size={sheetSize} onSize={sizeSheet}>
            {tripsView}
          </TripsSheet>
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

      {phone && tripForm}

      <FilterSheet
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        data={data}
        filter={filter}
        onChange={setFilter}
        resultCount={live(shown.trips).length}
      />
    </div>
  )
}

/** The A / B marker of a leg being shaped, like the dots on the map. */
function RouteBadge({ children }: { children: string }) {
  return (
    <span aria-hidden className="grid size-5 shrink-0 place-items-center rounded-full bg-[var(--route)] text-[0.7rem] font-bold text-[var(--route-text)]">
      {children}
    </span>
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
