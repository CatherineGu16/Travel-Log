import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PeopleSheet } from './components/PeopleSheet.tsx'
import { PinCard } from './components/PinCard.tsx'
import { ToastProvider } from './components/Toast.tsx'
import { TripForm } from './components/TripForm.tsx'
import parks from './data/national-parks.json'
import { parksVisited, pinsOf, statesVisited, tripsPerRegion } from './lib/derive.ts'
import { placeAt } from './lib/gazetteer.ts'
import type { PlaceInput } from './lib/travelActions.ts'
import type { Trip } from './lib/types.ts'
import { loadStore, StoreContext, useStore, useTravelState } from './store/useTravel.ts'
import type { TravelStore } from './store/travelStore.ts'

// MapLibre is most of the app's code, so it loads as its own chunk after the shell.
const MapView = lazy(() => import('./map/MapView.tsx').then((m) => ({ default: m.MapView })))

export default function App() {
  const [store, setStore] = useState<TravelStore | null>(null)
  useEffect(() => {
    void loadStore().then(setStore)
  }, [])
  if (!store) return <div className="h-full w-full bg-bg" />
  return (
    <StoreContext.Provider value={store}>
      <ToastProvider>
        <Shell />
      </ToastProvider>
    </StoreContext.Provider>
  )
}

type FormState = { trip: Trip | null; initialMain: PlaceInput | null }
type PickRequest = { label: string; resolve: (p: PlaceInput | null) => void }

function Shell() {
  const store = useStore()
  const { data, error } = useTravelState()
  const pins = useMemo(() => pinsOf(data), [data])
  const perRegion = useMemo(() => tripsPerRegion(data), [data])
  const parkCount = useMemo(() => parksVisited(data).size, [data])

  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState | null>(null)
  const [pick, setPick] = useState<PickRequest | null>(null)
  const [peopleOpen, setPeopleOpen] = useState(false)
  const [focus, setFocus] = useState<{ lng: number; lat: number; token: number } | null>(null)
  const focusToken = useRef(0)

  const selectedPin = pins.find((p) => p.place.id === selectedPlaceId) ?? null

  const requestPick = useCallback(
    (label: string) =>
      new Promise<PlaceInput | null>((resolve) => {
        setPick({ label, resolve })
      }),
    [],
  )
  const cancelPick = () => {
    pick?.resolve(null)
    setPick(null)
  }

  return (
    <div className="relative h-full w-full overflow-hidden">
      <Suspense fallback={<div className="h-full w-full bg-bg" />}>
        <MapView
          pins={pins}
          tripsPerRegion={perRegion}
          selectedPlaceId={selectedPlaceId}
          onSelectPin={setSelectedPlaceId}
          onAddAt={(lng, lat) => {
            void placeAt(lng, lat).then((initialMain) => {
              setSelectedPlaceId(null)
              setForm({ trip: null, initialMain })
            })
          }}
          picking={pick !== null}
          onPick={(lng, lat) => {
            const request = pick
            setPick(null)
            void placeAt(lng, lat).then((p) => request?.resolve(p))
          }}
          focus={focus}
        />
      </Suspense>

      <header className="pointer-events-none absolute inset-x-0 top-0 flex justify-center px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="pointer-events-auto flex items-center gap-3 rounded-xl border border-line bg-surface/95 py-1.5 pr-1.5 pl-4 shadow-md">
          <h1 className="font-display text-2xl font-semibold tracking-wide">Travel Log</h1>
          <dl className="flex gap-3 text-sm text-muted">
            <div className="flex gap-1">
              <dt className="sr-only">States visited</dt>
              <dd>
                <span className="font-bold text-fg">{statesVisited(perRegion)}</span> / 50 states
              </dd>
            </div>
            <div className="flex gap-1">
              <dt className="sr-only">National parks visited</dt>
              <dd>
                <span className="font-bold text-park">{parkCount}</span> / {parks.length} parks
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
        </div>
      </header>

      {error && (
        <p role="alert" className="absolute inset-x-3 top-20 mx-auto max-w-md rounded-lg bg-surface p-3 text-center text-sm text-danger shadow">
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

      {!pick && <ShadeLegend show={perRegion.size > 0 || pins.length > 0} />}

      {selectedPin && !form && !pick && (
        <div className="pointer-events-none absolute inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-20 flex sm:inset-x-auto sm:top-20 sm:bottom-auto sm:left-3">
          <PinCard
            pin={selectedPin}
            data={data}
            onEdit={(trip) => setForm({ trip, initialMain: null })}
            onClose={() => setSelectedPlaceId(null)}
          />
        </div>
      )}

      {/* On phones the pin card covers the bottom, so the button waits until it closes; from 640px both fit. */}
      {!pick && (
        <button
          onClick={() => {
            setSelectedPlaceId(null)
            setForm({ trip: null, initialMain: null })
          }}
          className={`absolute bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+5.75rem)] left-1/2 z-10 ${selectedPin ? 'hidden sm:flex' : 'flex'} min-h-12 -translate-x-1/2 items-center gap-2 rounded-full bg-primary px-5 font-bold text-on-primary shadow-lg sm:right-3 sm:bottom-auto sm:left-auto sm:top-[max(0.75rem,env(safe-area-inset-top))] sm:translate-x-0`}
        >
          <span aria-hidden className="text-xl leading-none">+</span> Add trip
        </button>
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
          onSaved={(mainPlaceId) => {
            setForm(null)
            setSelectedPlaceId(mainPlaceId)
            const place = store.getState().data.places.find((p) => p.id === mainPlaceId)
            if (place) setFocus({ lng: place.lng, lat: place.lat, token: ++focusToken.current })
          }}
        />
      )}

      <PeopleSheet open={peopleOpen} onClose={() => setPeopleOpen(false)} />
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
      className="pointer-events-none absolute top-[4.25rem] right-3 hidden rounded-lg border border-line bg-surface/90 px-3 py-2 text-xs text-muted shadow sm:top-20 sm:block"
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
