import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { describeRef, type ChosenPlace } from '../lib/chosenPlace.ts'
import { comparePartialDates, dayLabel, formatDateRange, todayIso, yearOf } from '../lib/partialDate.ts'
import { addPerson, saveTrip, type PlaceInput, type TripInput } from '../lib/travelActions.ts'
import { followTraveledBends, legPaths, type RoutePoint } from '../lib/route.ts'
import { achievementStatus, newlyEarned, TIER_NAMES } from '../lib/achievements.ts'
import { loadWorldCities } from '../lib/gazetteer.ts'
import { endOfHome, homeLeg, legMemory, stopLegs, type Leg, type LegEnd } from '../lib/legs.ts'
import { type LegMode, type LngLat, type PartialDate, type Place, type TravelData, type Trip, type TripHike, type TripStart } from '../lib/types.ts'
import { newId, useStore, useTravelState } from '../store/useTravel.ts'
import { DateRangeField } from './DateRangeField.tsx'
import { HikesField } from './HikesField.tsx'
import { PeoplePicker } from './PeoplePicker.tsx'
import { ParkSuggestion, PinGlyph, PlacePicker } from './PlacePicker.tsx'
import { Sheet } from './Sheet.tsx'
import { StopDates } from './StopDates.tsx'
import { TagsField } from './TagsField.tsx'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { HomeGlyph, LegRow } from './LegRow.tsx'
import { RAIL, railStyle } from './timeline.ts'
import { useToast } from './toastContext.ts'

interface DestinationDraft {
  key: string
  place: ChosenPlace
  isMain: boolean
  /** Null when you haven't said when you were here; the trip's dates are used. */
  startDate: PartialDate | null
  endDate: PartialDate | null
  note: string
  /** Bends in the route from the previous destination. */
  via: LngLat[]
  /** How you got here from the previous destination; null is guessed. */
  legMode: LegMode | null
  open: boolean
}

/** One end of a route leg being shaped on the map. */
export interface RouteEnd {
  name: string
  lng: number
  lat: number
}

/**
 * Asks the app to let you shape a leg on the map; resolves with its bends, or null if cancelled.
 * `follow` is the bends that would make it follow the way you came (null when there's none), and
 * `context` the rest of the trip's lines, drawn faintly behind it.
 */
export type RequestShape = (from: RouteEnd, to: RouteEnd, via: LngLat[], follow: LngLat[] | null, context: LngLat[][]) => Promise<LngLat[] | null>

/** Where a chosen place is on the map. */
function endOf(place: ChosenPlace, data: TravelData): RouteEnd | null {
  const ref = place.ref
  if ('place' in ref) return { name: place.label, lng: ref.place.lng, lat: ref.place.lat }
  const p = data.places.find((x) => x.id === ref.placeId)
  return p ? { name: place.label, lng: p.lng, lat: p.lat } : null
}

/** A destination as one end of a leg. Places not saved yet get an id of their own, so they're never remembered. */
function legEndOf(d: DestinationDraft, data: TravelData): LegEnd | null {
  const end = endOf(d.place, data)
  return end && { id: 'placeId' in d.place.ref ? d.place.ref.placeId : `new:${d.key}`, ...end }
}

const STEPS = ['Details', 'Route', 'Notes'] as const
type Step = 0 | 1 | 2

/** Compares partial dates at the coarser of the two precisions ("2024-05" contains "2024-05-03"). */
const compareLoose = (a: PartialDate, b: PartialDate) => {
  const n = Math.min(a.length, b.length)
  return comparePartialDates(a.slice(0, n), b.slice(0, n))
}

/**
 * Add or edit a trip in three steps: Details (title, dates, who went), Route (destinations in
 * order, any of them main, each with its own dates; how you went between them; travel to and from
 * home), and Notes (hikes, description, rating, tags). On the Route step the trip so far is drawn
 * on the map. `inline`: in the Trips panel beside the map (wider screens), which stays open while
 * you shape a leg; otherwise a sheet that hides (keeping everything you've entered) while you do.
 */
export function TripForm({
  trip,
  initialMain,
  initialStep,
  hidden,
  requestShape,
  onClose,
  onSaved,
  inline = false,
  onDraftRoute,
  shapeLegAt,
}: {
  trip: Trip | null
  initialMain: PlaceInput | null
  /** Open on this step (e.g. Edit next to a trip's stops opens Route). */
  initialStep?: (typeof STEPS)[number]
  hidden: boolean
  requestShape: RequestShape
  onClose: () => void
  onSaved: (mainPlaceId: string, tripId: string) => void
  inline?: boolean
  /** The route so far while the Route step is open (null otherwise), for drawing on the map. */
  onDraftRoute?: (route: RoutePoint[] | null) => void
  /** A leg tapped on the map: shape the leg arriving at this point of the draft route. */
  shapeLegAt?: { at: number; token: number } | null
}) {
  const store = useStore()
  const { data } = useTravelState()
  const toast = useToast()

  const [title, setTitle] = useState(trip?.title ?? '')
  const [startDate, setStartDate] = useState<PartialDate>(trip?.startDate ?? todayIso())
  const [endDate, setEndDate] = useState<PartialDate>(trip?.endDate ?? trip?.startDate ?? todayIso())
  // On a new trip, destination dates fill in the trip's dates until you set them yourself.
  const [datesTouched, setDatesTouched] = useState(!!trip)
  // No longer asked; kept as it was on trips that have it.
  const approximate = trip?.approximate ?? false
  const [destinations, setDestinations] = useState<DestinationDraft[]>(() => {
    if (trip)
      return trip.destinations.map((d) => ({
        key: newId(),
        place: describeRef({ placeId: d.placeId }, data),
        isMain: d.isMain,
        startDate: d.startDate,
        endDate: d.endDate,
        note: d.note,
        via: d.via,
        legMode: d.legMode,
        open: false,
      }))
    if (initialMain)
      return [
        { key: newId(), place: describeRef({ place: initialMain }, data), isMain: true, startDate: null, endDate: null, note: '', via: [], legMode: null, open: false },
      ]
    return []
  })
  const [step, setStep] = useState<Step>(() => Math.max(0, STEPS.indexOf(initialStep ?? 'Details')) as Step)
  // Where the trip started and ended: new trips start at Home; a trip keeps its own copy, so
  // changing Home later doesn't move it. Trips saved before that follow Home until saved.
  const homeNow: TripStart | null = data.home && !data.home.deleted ? { name: data.home.name, lat: data.home.lat, lng: data.home.lng } : null
  const [start, setStart] = useState<TripStart | null>(() => (trip && trip.start !== undefined ? trip.start : homeNow))
  // Which end of the route is showing the place search to change where the trip started.
  const [changingStart, setChangingStart] = useState<'top' | 'bottom' | null>(null)
  const [startMode, setStartMode] = useState<LegMode>(trip?.startMode ?? 'flight')
  const [endMode, setEndMode] = useState<LegMode>(trip?.endMode ?? 'flight')
  // Bends on the way there and back, for the first and last place and the start they were shaped
  // for: once either changes, they were for a different leg and no longer apply.
  const startKey = (s: TripStart | null) => (s ? `${s.lat},${s.lng}` : '')
  const [startShape, setStartShape] = useState(() => ({ key: destinations[0]?.key, at: startKey(start), via: trip?.startVia ?? [] }))
  const [endShape, setEndShape] = useState(() => ({ key: destinations.at(-1)?.key, at: startKey(start), via: trip?.endVia ?? [] }))
  const startVia = startShape.key === destinations[0]?.key && startShape.at === startKey(start) ? startShape.via : []
  const endVia = endShape.key === destinations.at(-1)?.key && endShape.at === startKey(start) ? endShape.via : []
  const [companions, setCompanions] = useState<string[]>(trip?.companions ?? [])
  const [description, setDescription] = useState(trip?.description ?? '')
  const [highlights, setHighlights] = useState(trip?.highlights ?? '')
  const [rating, setRating] = useState<number | null>(trip?.rating ?? null)
  const [tags, setTags] = useState<string[]>(trip?.tags ?? [])
  // Tags offered as chips: the ones on your other trips, most used first, and your group names.
  const usedTags = useMemo(() => {
    const count = new Map<string, number>()
    for (const t of data.trips) if (!t.deleted) for (const tag of t.tags) count.set(tag, (count.get(tag) ?? 0) + 1)
    for (const g of data.groups) if (!g.deleted && !count.has(g.name)) count.set(g.name, 0)
    return [...count].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([tag]) => tag)
  }, [data.trips, data.groups])
  const [hikes, setHikes] = useState<TripHike[]>(trip?.hikes ?? [])
  const [error, setError] = useState<string | null>(null)
  // Continents by country, for telling a save that earns "Continents" (the place search loads the same file).
  const [continents, setContinents] = useState<Record<string, string> | undefined>()
  useEffect(() => {
    void loadWorldCities().then((w) => setContinents(w.continents))
  }, [])
  // The stop whose dates are open for picking (one at a time).
  const [datesFor, setDatesFor] = useState<string | null>(null)

  const mains = destinations.filter((d) => d.isMain)

  // Modes you picked on your other trips, so a route you've corrected before is guessed right.
  const memory = useMemo(() => legMemory({ ...data, trips: data.trips.filter((t) => t.id !== trip?.id) }), [data, trip?.id])
  const home = start ? endOfHome(start) : null
  const ends = destinations.map((d) => legEndOf(d, data))
  // Guessed in order, so a leg right after a drive knows it (see guessMode).
  const stopsLegs = ends.every((e) => e)
    ? stopLegs(
        destinations.map((d, i) => ({ end: ends[i]!, via: d.via, picked: d.legMode })),
        memory,
        !!start && startMode === 'drive',
      )
    : []
  const legBefore = (i: number) => stopsLegs[i - 1] ?? null
  const first = ends[0]
  const end = ends.at(-1)
  const toLeg: Leg | null = home && first ? homeLeg(home, first, startMode, startVia) : null
  const backLeg: Leg | null = home && end ? homeLeg(end, home, endMode, endVia) : null
  // National parks on this trip: their hikes can be checked off.
  const parkIds = [...new Set(destinations.map((d) => d.place.parkId).filter((id): id is string => !!id))]

  // New destinations search near the first main destination first.
  const near = useMemo(() => {
    const ref = (mains[0] ?? destinations[0])?.place.ref
    if (!ref) return null
    if ('place' in ref) return { lat: ref.place.lat, lng: ref.place.lng }
    const p = data.places.find((x) => x.id === ref.placeId)
    return p ? { lat: p.lat, lng: p.lng } : null
  }, [mains, destinations, data.places])

  const suggestedTitle = useMemo(
    () => (mains.length ? `${mains.map((m) => m.place.label.replace(/ National Park$/, '')).join(' & ')} ${yearOf(startDate)}` : ''),
    [mains, startDate],
  )

  /**
   * Destination edits. A leg's bends and mode are dropped when the place before it changes
   * (reordered or removed), since they were for a different leg. On a new trip whose dates you haven't set, the
   * trip spans the destinations' dates.
   */
  const updateDestinations = (fn: (d: DestinationDraft[]) => DestinationDraft[]) =>
    setDestinations((current) => {
      const before = new Map(current.map((d, i) => [d.key, current[i - 1]?.key]))
      const next = fn(current).map((d, i, all) => (before.get(d.key) !== all[i - 1]?.key ? { ...d, via: [], legMode: null } : d))
      if (!datesTouched) {
        const starts = next.map((d) => d.startDate).filter((d): d is string => !!d)
        const ends = next.map((d) => d.endDate ?? d.startDate).filter((d): d is string => !!d)
        if (starts.length) {
          setStartDate(starts.sort(comparePartialDates)[0])
          setEndDate(ends.sort(comparePartialDates).at(-1)!)
        }
      }
      return next
    })

  const addDestination = (place: ChosenPlace) =>
    updateDestinations((d) => [...d, { key: newId(), place, isMain: d.length === 0, startDate: null, endDate: null, note: '', via: [], legMode: null, open: false }])

  /** Hides the form while you tap out the way you went from the previous destination to this one. */
  /**
   * Hides the form while you shape the leg arriving at draftPoints()[at] on the map, with the rest of
   * the trip faintly behind it and "Follow the way you came" when there's a way to follow.
   */
  const shape = async (at: number, from: RouteEnd | null, to: RouteEnd | null, via: LngLat[], save: (via: LngLat[]) => void) => {
    if (!from || !to) return
    const points = draftPoints()
    const context = legPaths(points).filter((line, k): line is LngLat[] => !!line && k !== at)
    const shaped = await requestShape(from, to, via, followTraveledBends(points, at), context)
    if (shaped) save(shaped)
  }
  /** The leg from destination i − 1 to i. */
  const shapeLeg = (i: number) => {
    const latest = store.getState().data
    const key = destinations[i].key
    void shape(i + (home && toLeg ? 1 : 0), endOf(destinations[i - 1].place, latest), endOf(destinations[i].place, latest), destinations[i].via, (via) =>
      patch(key, { via }),
    )
  }
  /** The way from the start to the first place, or back from the last. */
  const shapeHome = (which: 'start' | 'end') => {
    if (!start) return
    const latest = store.getState().data
    const home = { name: start.name, lat: start.lat, lng: start.lng }
    if (which === 'start') {
      const key = destinations[0]?.key
      return void shape(1, home, destinations[0] ? endOf(destinations[0].place, latest) : null, startVia, (via) => setStartShape({ key, at: startKey(start), via }))
    }
    const key = destinations.at(-1)?.key
    const last = destinations.at(-1)
    void shape(draftPoints().length - 1, last ? endOf(last.place, latest) : null, home, endVia, (via) => setEndShape({ key, at: startKey(start), via }))
  }

  /** The route as it stands now (unsaved edits included), as points for working out its lines. */
  const draftPoints = (): RoutePoint[] => {
    const point = (lng: number, lat: number, via: LngLat[], leg: Leg | null): RoutePoint =>
      ({ place: { lng, lat } as Place, role: 'stop', number: null, via, leg }) as RoutePoint
    return [
      ...(home && toLeg ? [point(home.lng, home.lat, [], null)] : []),
      ...destinations.map((d, k) => point(ends[k]?.lng ?? 0, ends[k]?.lat ?? 0, k ? d.via : toLeg ? toLeg.via : [], k ? legBefore(k) : toLeg)),
      ...(home && backLeg ? [point(home.lng, home.lat, backLeg.via, backLeg)] : []),
    ]
  }

  /**
   * The route so far, for the map: the start, the destinations (places you haven't saved yet get a
   * ★, since they have no pin), and the way back; points line up with draftPoints().
   */
  const draftRoute = (): RoutePoint[] => {
    const at = (id: string, name: string, lng: number, lat: number) => ({ id, name, lng, lat }) as Place
    let n = 0
    return [
      ...(home && toLeg ? [{ place: at('draft-start', start!.name, home.lng, home.lat), role: 'home' as const, number: null, via: [], leg: null }] : []),
      ...destinations.map((d, k) => ({
        place: at(`draft-${d.key}`, d.place.label, ends[k]?.lng ?? 0, ends[k]?.lat ?? 0),
        role: d.isMain ? ('main' as const) : ('stop' as const),
        number: d.isMain ? null : ++n,
        ...(d.isMain && 'place' in d.place.ref ? { marker: '★' } : {}),
        via: k ? d.via : toLeg ? toLeg.via : [],
        leg: k ? legBefore(k) : toLeg,
      })),
      ...(home && backLeg ? [{ place: at('draft-end', start!.name, home.lng, home.lat), role: 'home' as const, number: null, via: backLeg.via, leg: backLeg }] : []),
    ]
  }
  // Drawn on the map while the Route step is open; told again only when it changes.
  const draft = step === 1 ? draftRoute() : null
  const draftKey = draft ? JSON.stringify(draft.map((r) => [r.place.lng, r.place.lat, r.role, r.number, r.marker, r.via, r.leg?.mode])) : ''
  const draftRef = useRef(draft)
  useLayoutEffect(() => {
    draftRef.current = draft
  })
  useEffect(() => {
    onDraftRoute?.(draftRef.current)
  }, [draftKey, onDraftRoute])
  useEffect(() => () => onDraftRoute?.(null), [onDraftRoute])

  /** Swaps a destination's place, keeping its dates, note and pin; the legs to and from it start over. */
  const changePlace = (key: string, place: ChosenPlace) =>
    updateDestinations((ds) =>
      ds.map((x, i) => (x.key === key ? { ...x, place, via: [], legMode: null } : ds[i - 1]?.key === key ? { ...x, via: [], legMode: null } : x)),
    )

  const move = (i: number, by: -1 | 1) =>
    updateDestinations((d) => {
      const next = [...d]
      ;[next[i], next[i + by]] = [next[i + by], next[i]]
      return next
    })
  const patch = (key: string, change: Partial<DestinationDraft>) => updateDestinations((d) => d.map((x) => (x.key === key ? { ...x, ...change } : x)))
  const remove = (key: string) =>
    updateDestinations((d) => {
      const next = d.filter((x) => x.key !== key)
      // There's always a main destination while there are destinations.
      if (next.length && !next.some((x) => x.isMain)) next[0] = { ...next[0], isMain: true }
      return next
    })

  // A leg tapped on the map (wider screens): shape it, as its Shape button would.
  const shapeAt = (at: number) => {
    const offset = home && toLeg ? 1 : 0
    if (offset && at === 1 && startMode !== 'flight') return shapeHome('start')
    if (home && backLeg && at === draftPoints().length - 1 && endMode !== 'flight') return shapeHome('end')
    const i = at - offset
    if (i > 0 && i < destinations.length && legBefore(i)?.mode !== 'flight') shapeLeg(i)
  }
  const shapeAtRef = useRef(shapeAt)
  useLayoutEffect(() => {
    shapeAtRef.current = shapeAt
  })
  useEffect(() => {
    if (shapeLegAt) shapeAtRef.current(shapeLegAt.at)
  }, [shapeLegAt])

  /** Shows a problem on the step where it can be fixed. */
  const fail = (at: Step, message: string) => {
    setStep(at)
    setError(message)
  }
  const goTo = (next: Step) => {
    if (next > 0 && compareLoose(endDate, startDate) < 0) return fail(0, 'The end date is before the start date.')
    if (next > 1 && destinations.length === 0) return fail(1, 'Add where the trip went.')
    setError(null)
    setStep(next)
  }

  const save = () => {
    if (compareLoose(endDate, startDate) < 0) return fail(0, 'The end date is before the start date.')
    if (destinations.length === 0) return fail(1, 'Add where the trip went.')
    for (const d of destinations) {
      if (!d.startDate) continue
      const end = d.endDate ?? d.startDate
      if (compareLoose(end, d.startDate) < 0) return fail(1, `${d.place.label}: you left before you arrived.`)
      if (compareLoose(d.startDate, startDate) < 0 || compareLoose(end, endDate) > 0) return fail(1, `${d.place.label}'s dates are outside the trip's dates.`)
    }
    const input: TripInput = {
      title: title.trim() || suggestedTitle,
      startDate,
      endDate,
      approximate,
      destinations: destinations.map((d) => ({
        place: d.place.ref,
        isMain: d.isMain,
        startDate: d.startDate,
        endDate: d.endDate,
        note: d.note,
        via: d.via,
        legMode: d.legMode,
      })),
      companions,
      start,
      startMode,
      endMode,
      startVia,
      endVia,
      description,
      highlights,
      rating,
      tags,
      // Hikes in parks that are no longer on the trip are dropped.
      hikes: hikes.filter((h) => parkIds.includes(h.parkId)),
    }
    const before = achievementStatus(store.getState().data, { continents })
    const undoId = store.apply((d, c) => saveTrip(d, c, input, trip?.id), trip ? `Edited ${input.title}` : `Added ${input.title}`)
    if (undoId === null) return setError(store.getState().error ?? "Couldn't save the trip.")
    const saved = trip ? store.getState().data.trips.find((t) => t.id === trip.id)! : store.getState().data.trips.at(-1)!
    // A tier this save earned rides along on the same message, so Undo stays one tap away.
    const won = newlyEarned(before, achievementStatus(store.getState().data, { continents }))
    const prize = won.length
      ? ` · 🏅 ${won[0].status.achievement.tiers.length > 1 ? `${TIER_NAMES[won[0].tier.level]} · ` : ''}${won[0].status.achievement.name}${won.length > 1 ? ` (+${won.length - 1} more)` : ''}`
      : ''
    toast(`${trip ? 'Trip updated' : `Added ${saved.title}`}${prize}`, [{ label: 'Undo', onClick: () => store.undo(undoId) }])
    onSaved(saved.destinations.find((d) => d.isMain)!.placeId, saved.id)
  }

  const input = 'w-full rounded-lg border border-line bg-bg px-3 text-base'
  const secondary = 'min-h-11 rounded-lg px-4 font-bold text-muted hover:text-fg'
  const primary = 'min-h-11 rounded-lg bg-primary px-5 font-bold text-on-primary'
  const saveLabel = trip ? 'Save' : 'Add trip'
  // Editing saves from any step; a new trip once it has somewhere to go. Notes are optional.
  const canSave = !!trip || step > 0 || destinations.length > 0
  let stopNumber = 0
  /** "Days 2–3 · May 2 – 3" (the day numbers when the dates are whole days). */
  const stopDates = (d: DestinationDraft) =>
    d.startDate ? [dayLabel(startDate, d.startDate, d.endDate), formatDateRange(d.startDate, d.endDate)].filter(Boolean).join(' · ') : ''
  /** Where a stop's day strip opens: the day the stop before it ended, else the trip's first day. */
  const suggestedStart = (i: number) => {
    const before = destinations.slice(0, i).findLast((x) => x.startDate)
    return before ? (before.endDate ?? before.startDate) : startDate
  }
  const pickStart = (p: ChosenPlace | null) => {
    const at = p && endOf(p, data)
    if (!at) return
    setStart({ name: at.name, lat: at.lat, lng: at.lng })
    setChangingStart(null)
  }
  /** "Shape on map" and "Straighten" for the way there or back, unless it's a flight. */
  const homeShaping = (leg: Leg, via: LngLat[], onShape: () => void, onStraighten: () => void) =>
    leg.mode !== 'flight' && (
      <>
        <button
          type="button"
          onClick={onShape}
          aria-label={`Shape the route from ${leg.from.name} to ${leg.to.name} on the map`}
          className="min-h-11 rounded-md px-1.5 font-bold text-[var(--route)] hover:bg-raised"
        >
          {via.length ? `Bends ${via.length}× · Edit` : 'Shape on map'}
        </button>
        {via.length > 0 && (
          <button type="button" onClick={onStraighten} className="min-h-11 rounded-md px-1.5 hover:bg-raised hover:text-fg">
            Straighten
          </button>
        )}
      </>
    )
  /** Where the trip started, at the top and again at the end, on the timeline: tap it to pick another place. */
  const startRow = (where: 'top' | 'bottom') => {
    const changing = changingStart === where || (!start && where === 'top')
    if (!changing && !start) return null
    return (
      <TimelineRow
        marker={<HomeGlyph className="size-6" />}
        above={where === 'bottom' ? backLeg?.mode : undefined}
        below={where === 'top' ? toLeg?.mode : undefined}
      >
        {changing ? (
          <div className="flex flex-col gap-1.5 py-1">
            <PlacePicker
              label={start ? `Change where the trip started (${start.name})` : 'Where the trip started'}
              data={data}
              value={null}
              onChange={pickStart}
              autoFocus={!!start && !matchMedia('(pointer: coarse)').matches}
            />
            <div className="flex flex-wrap gap-1 text-sm empty:hidden">
              {homeNow && (homeNow.lat !== start?.lat || homeNow.lng !== start?.lng) && (
                <button
                  type="button"
                  onClick={() => {
                    setStart(homeNow)
                    setChangingStart(null)
                  }}
                  className="min-h-10 rounded-lg px-2 font-bold text-primary hover:bg-raised"
                >
                  Use home ({homeNow.name})
                </button>
              )}
              {changingStart && (
                <button type="button" onClick={() => setChangingStart(null)} className="min-h-10 rounded-lg px-2 text-muted hover:bg-raised hover:text-fg">
                  Keep {start?.name}
                </button>
              )}
            </div>
            {!homeNow && !start && <p className="text-xs text-muted">Set your home in Settings and new trips will start and end there.</p>}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setChangingStart(where)}
            aria-label={`Change where the trip ${where === 'top' ? 'started' : 'ended'} (${start!.name})`}
            className="flex min-h-10 w-full items-center gap-2 rounded-lg pr-2 text-left hover:bg-raised"
          >
            <span className="min-w-0 truncate font-bold">{start!.name}</span>
            <span className="ml-auto text-xs text-muted">{where === 'top' ? 'Start' : 'End'}</span>
          </button>
        )}
      </TimelineRow>
    )
  }

  const heading = trip ? 'Edit trip' : 'Add trip'
  // In the panel, the form takes the keyboard focus when it opens (as the sheet does), unless a field already has it.
  const panel = useRef<HTMLElement>(null)
  useEffect(() => {
    if (inline && !panel.current?.contains(document.activeElement)) panel.current?.focus({ preventScroll: true })
  }, [inline])
  const footer = (
    <div className="flex flex-wrap items-center gap-2">
      {error && (
        <p role="alert" className="mr-auto text-sm text-danger">
          {error}
        </p>
      )}
      {step === 0 ? (
        <button type="button" onClick={onClose} className={`ml-auto ${secondary}`}>
          Cancel
        </button>
      ) : (
        <button type="button" onClick={() => goTo((step - 1) as Step)} className={`ml-auto ${secondary}`}>
          Back
        </button>
      )}
      {step < 2 && (
        <button type="button" onClick={() => goTo((step + 1) as Step)} className={canSave ? secondary : primary}>
          Next: {STEPS[step + 1]}
        </button>
      )}
      {canSave && (
        <button type="button" onClick={save} className={primary}>
          {saveLabel}
        </button>
      )}
    </div>
  )
  const form = (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault()
        if (!canSave) goTo((step + 1) as Step)
        else save()
      }}
    >
      {step === 0 && (
        <>
          <label className="block">
            <span className="mb-1.5 block text-sm font-bold">Title</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={suggestedTitle || 'e.g. Utah Parks 2023'} className={`${input} h-11`} />
            {!title && !suggestedTitle && <span className="mt-1 block text-xs text-muted">Leave it empty to name it after where you went.</span>}
          </label>

          <DateRangeField
            label="Trip dates"
            start={startDate}
            end={endDate}
            onChange={(s, e) => {
              setDatesTouched(true)
              setStartDate(s)
              setEndDate(e)
            }}
          />

          <PeoplePicker
            data={data}
            value={companions}
            onChange={setCompanions}
            onAddPerson={(name, groupIds) => {
              const id = newId()
              const ok = store.apply((d, c) => addPerson(d, c, id, { name, groupIds }), `Added ${name}`)
              return ok === null ? null : id
            }}
          />
        </>
      )}

      {step === 1 && (
        <section aria-label="Where you went">
          <h3 className="text-sm font-bold">Where you went</h3>
          <p className="mb-3 text-xs text-muted">Main places get a pin on the map. Tap a leg to change how you went.</p>
          {startRow('top')}
          {toLeg && (
            <LegRow leg={toLeg} allowGuess={false} onPick={(mode) => mode && setStartMode(mode)}>
              {homeShaping(toLeg, startVia, () => shapeHome('start'), () => setStartShape({ key: destinations[0]?.key, at: startKey(start), via: [] }))}
            </LegRow>
          )}
          {destinations.length > 0 && (
            <ol className="flex flex-col">
              {destinations.map((d, i) => {
                const number = d.isMain ? null : ++stopNumber
                const onlyMain = d.isMain && mains.length === 1
                const leg = i > 0 ? legBefore(i) : null
                const into = i === 0 ? toLeg : leg
                const out = i < destinations.length - 1 ? legBefore(i + 1) : backLeg
                return (
                  <li key={d.key} aria-label={d.place.label}>
                    {leg && (
                      <LegRow leg={leg} onPick={(legMode) => patch(d.key, { legMode })}>
                        {leg.mode !== 'flight' && (
                          <button
                            type="button"
                            onClick={() => shapeLeg(i)}
                            aria-label={`Shape the route from ${destinations[i - 1].place.label} to ${d.place.label} on the map`}
                            className="min-h-10 rounded-md px-1.5 font-bold text-[var(--route)] hover:bg-raised"
                          >
                            {d.via.length ? `Bends ${d.via.length}× · Edit` : 'Shape on map'}
                          </button>
                        )}
                        {d.via.length > 0 && (
                          <button type="button" onClick={() => patch(d.key, { via: [] })} className="min-h-10 rounded-md px-1.5 hover:bg-raised hover:text-fg">
                            Straighten
                          </button>
                        )}
                      </LegRow>
                    )}
                    <TimelineRow
                      above={into?.mode}
                      below={out?.mode ?? (i < destinations.length - 1 ? 'unknown' : undefined)}
                      marker={
                        d.isMain ? (
                          <PinGlyph park={d.place.isPark} className="size-7" />
                        ) : (
                          <span className="grid size-7 place-items-center rounded-full bg-[var(--route)] text-xs font-bold text-[var(--route-text)]">{number}</span>
                        )
                      }
                    >
                      <div className="flex items-start gap-1">
                        <div className="min-w-0 flex-1 py-1">
                          <button
                            type="button"
                            onClick={() => patch(d.key, { open: !d.open })}
                            aria-expanded={d.open}
                            aria-label={`${d.place.label}: change place, name or note`}
                            className="block max-w-full text-left leading-snug break-words hover:underline"
                          >
                            <span className={d.isMain ? 'font-bold' : ''}>{d.place.label}</span>
                            {d.place.detail && <span className="ml-1.5 text-xs text-muted">{d.place.detail}</span>}
                          </button>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <button
                              type="button"
                              aria-label={d.isMain ? `${d.place.label} is a main destination` : `Make ${d.place.label} a main destination`}
                              aria-pressed={d.isMain}
                              disabled={onlyMain}
                              title={onlyMain ? 'A trip needs at least one main destination' : d.isMain ? 'Tap to make it a stop' : 'Tap to give it a pin'}
                              onClick={() => patch(d.key, { isMain: !d.isMain })}
                              className={`min-h-7 rounded-full border px-2.5 text-xs font-bold disabled:cursor-default ${d.isMain ? 'border-primary/40 bg-primary/10 text-primary' : 'border-line text-muted hover:text-fg'}`}
                            >
                              {d.isMain ? 'Main' : 'Stop'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setDatesFor(datesFor === d.key ? null : d.key)}
                              aria-expanded={datesFor === d.key}
                              aria-label={d.startDate ? `Dates at ${d.place.label}: ${stopDates(d)}` : `Add dates at ${d.place.label}`}
                              className={`flex min-h-7 min-w-0 items-center gap-1 rounded-full px-2 text-left text-xs hover:bg-raised ${d.startDate ? 'text-fg' : 'font-bold text-primary'}`}
                            >
                              <svg viewBox="0 0 20 20" className="size-3.5 shrink-0" aria-hidden>
                                <rect x="3" y="4.5" width="14" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
                                <path d="M3 8.5h14M7 3v3M13 3v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                              </svg>
                              <span>{d.startDate ? stopDates(d) : 'Add dates'}</span>
                            </button>
                            {d.note && <span className="min-w-0 truncate text-xs text-muted">{d.note}</span>}
                          </div>
                        </div>
                        <StopMenu
                          place={d.place.label}
                          first={i === 0}
                          last={i === destinations.length - 1}
                          onMove={(by) => move(i, by)}
                          onEdit={() => patch(d.key, { open: true })}
                          onRemove={() => remove(d.key)}
                        />
                      </div>
                      <div className="empty:hidden">
                        <ParkSuggestion
                          value={d.place}
                          onLink={(park) =>
                            'place' in d.place.ref &&
                            patch(d.key, { place: describeRef({ place: { ...d.place.ref.place, parkId: park.id, name: park.fullName } }, data) })
                          }
                        />
                      </div>
                      {datesFor === d.key && (
                        <div className="mt-1 mb-2 overflow-hidden rounded-xl border border-line bg-bg">
                          <StopDates
                            place={d.place.label}
                            tripStart={startDate}
                            tripEnd={endDate}
                            start={d.startDate}
                            end={d.endDate}
                            suggested={suggestedStart(i)}
                            calendarOnly={!datesTouched}
                            onChange={(start, end) => patch(d.key, { startDate: start, endDate: end })}
                            onDone={() => setDatesFor(null)}
                          />
                        </div>
                      )}
                      {d.open && (
                        <div className="mt-1 mb-2 flex flex-col gap-3 rounded-xl border border-line bg-bg p-3">
                          <PlacePicker label="Change to another place" data={data} near={near} value={null} onChange={(p) => p && changePlace(d.key, p)} />
                          {'place' in d.place.ref && !d.place.ref.place.parkId && (
                            <label className="block">
                              <span className="mb-1 block text-sm font-bold">Name</span>
                              <input
                                aria-label={`${d.place.label} name`}
                                value={d.place.label}
                                onChange={(e) =>
                                  'place' in d.place.ref &&
                                  patch(d.key, { place: { ...d.place, label: e.target.value, ref: { place: { ...d.place.ref.place, name: e.target.value } } } })
                                }
                                className={`${input} h-10`}
                              />
                            </label>
                          )}
                          <label className="block">
                            <span className="mb-1 block text-sm font-bold">Note</span>
                            <input value={d.note} onChange={(e) => patch(d.key, { note: e.target.value })} className={`${input} h-10`} />
                          </label>
                          <button type="button" onClick={() => patch(d.key, { open: false })} className="min-h-9 self-end rounded-lg px-3 text-sm font-bold text-primary hover:bg-raised">
                            Done
                          </button>
                        </div>
                      )}
                    </TimelineRow>
                  </li>
                )
              })}
            </ol>
          )}
          {/* Adding a place: a node on the timeline after the last place, before the way back. */}
          <TimelineRow
            above={destinations.length ? backLeg?.mode : undefined}
            below={destinations.length ? backLeg?.mode : undefined}
            marker={
              <span className="grid size-7 place-items-center rounded-full border-2 border-dashed border-muted bg-surface text-muted">
                <svg viewBox="0 0 20 20" className="size-3.5" aria-hidden>
                  <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
                </svg>
              </span>
            }
          >
            <div className="py-0.5">
              <PlacePicker
                label={destinations.length ? 'Add another destination' : 'Add a destination'}
                hideLabel
                placeholder={destinations.length ? 'Add another place' : 'Where did you go?'}
                data={data}
                near={near}
                value={null}
                onChange={(p) => {
                  if (p) addDestination(p)
                  setError(null)
                }}
                autoFocus={destinations.length === 0 && !matchMedia('(pointer: coarse)').matches}
              />
            </div>
          </TimelineRow>
          {backLeg && (
            <>
              <LegRow leg={backLeg} allowGuess={false} onPick={(mode) => mode && setEndMode(mode)}>
                {homeShaping(backLeg, endVia, () => shapeHome('end'), () => setEndShape({ key: destinations.at(-1)?.key, at: startKey(start), via: [] }))}
              </LegRow>
              {startRow('bottom')}
            </>
          )}
        </section>
      )}

      {step === 2 && (
        <>
          <HikesField parkIds={parkIds} data={data} value={hikes} onChange={setHikes} />
          <label className="block">
            <span className="mb-1 block text-sm font-bold">Description</span>
            <GrowingTextarea value={description} onChange={setDescription} className={`${input} py-2`} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold">Highlights</span>
            <GrowingTextarea value={highlights} onChange={setHighlights} className={`${input} py-2`} />
          </label>
          <fieldset>
            <legend className="mb-1 text-sm font-bold">Rating</legend>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-label={`${n} star${n > 1 ? 's' : ''}`}
                  aria-pressed={rating !== null && n <= rating}
                  onClick={() => setRating(rating === n ? null : n)}
                  className={`grid size-10 place-items-center rounded-lg text-2xl ${rating !== null && n <= rating ? 'text-[#e0a526]' : 'text-line'}`}
                >
                  ★
                </button>
              ))}
            </div>
          </fieldset>
          <TagsField value={tags} suggestions={usedTags} onChange={setTags} />
        </>
      )}
      <button type="submit" hidden />
    </form>
  )

  if (inline)
    return (
      <section
        ref={panel}
        tabIndex={-1}
        aria-label={heading}
        className="flex min-h-0 flex-1 flex-col outline-none"
        onKeyDown={(e) => {
          // Escape closes it, like the sheet; not when it's closing a menu inside it.
          if (e.key === 'Escape' && !e.defaultPrevented && !(e.target as HTMLElement).closest('[role="menu"]')) onClose()
        }}
      >
        <div className="border-b border-line px-4 pt-3 pb-2">
          <h2 className="font-display text-2xl leading-tight font-semibold">{heading}</h2>
          <Steps step={step} onGo={goTo} />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{form}</div>
        <div className="border-t border-line px-4 py-2">{footer}</div>
      </section>
    )
  return (
    <Sheet open={!hidden} onOpenChange={(open) => !open && onClose()} title={heading} accent="var(--primary)" tall toolbar={<Steps step={step} onGo={goTo} />} footer={footer}>
      {form}
    </Sheet>
  )
}

/** The three steps as connected dots: done steps checked, the current one filled. Any step can be opened. */
function Steps({ step, onGo }: { step: Step; onGo: (step: Step) => void }) {
  return (
    <nav aria-label="Steps">
      <ol className="flex items-start">
        {STEPS.map((name, i) => {
          const done = i < step
          const current = i === step
          return (
            <li key={name} className="flex flex-1 items-start last:flex-none">
              <button
                type="button"
                aria-current={current ? 'step' : undefined}
                onClick={() => onGo(i as Step)}
                className="group flex min-h-11 min-w-16 flex-col items-center gap-1 rounded-lg px-1 pb-1"
              >
                <span
                  aria-hidden
                  className={`grid size-7 place-items-center rounded-full text-xs font-bold transition-colors ${
                    current
                      ? 'bg-primary text-on-primary ring-4 ring-primary/20'
                      : done
                        ? 'bg-primary/15 text-primary group-hover:bg-primary/25'
                        : 'border-2 border-line bg-surface text-muted group-hover:border-muted'
                  }`}
                >
                  {done ? (
                    <svg viewBox="0 0 20 20" className="size-4">
                      <path d="M5 10.5l3.2 3L15 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </span>
                <span className={`text-xs ${current ? 'font-bold text-fg' : done ? 'text-fg' : 'text-muted group-hover:text-fg'}`}>{name}</span>
              </button>
              {i < STEPS.length - 1 && (
                <span aria-hidden className={`mx-1 mt-3.5 h-0.5 flex-1 rounded-full transition-colors ${done ? 'bg-primary/50' : 'bg-line'}`} />
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

/** A text box that grows taller as you type, instead of scrolling inside itself. */
function GrowingTextarea({ value, onChange, className }: { value: string; onChange: (value: string) => void; className: string }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight + el.offsetHeight - el.clientHeight}px`
  }, [value])
  return <textarea ref={ref} value={value} onChange={(e) => onChange(e.target.value)} rows={2} className={`${className} resize-none overflow-hidden`} />
}

/**
 * A row on the Route step's timeline: its marker on the line (with the line running in from the leg
 * above and out to the leg below, styled like those legs), and its content beside it.
 */
function TimelineRow({ marker, above, below, children }: { marker: React.ReactNode; above?: LegMode; below?: LegMode; children: React.ReactNode }) {
  return (
    <div className="flex">
      <div className={`relative flex ${RAIL} shrink-0 justify-center`}>
        {above && <span aria-hidden className={`absolute top-0 left-1/2 h-5 w-0 -translate-x-1/2 border-l-2 ${railStyle(above)}`} />}
        {below && <span aria-hidden className={`absolute top-5 bottom-0 left-1/2 w-0 -translate-x-1/2 border-l-2 ${railStyle(below)}`} />}
        <span className="relative grid h-10 place-items-center rounded-full bg-surface">{marker}</span>
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

/** "⋯" on a place: move it up or down, change it (place, name, note), or remove it. */
function StopMenu({
  place,
  first,
  last,
  onMove,
  onEdit,
  onRemove,
}: {
  place: string
  first: boolean
  last: boolean
  onMove: (by: -1 | 1) => void
  onEdit: () => void
  onRemove: () => void
}) {
  const item =
    'flex min-h-10 cursor-pointer items-center rounded-lg px-3 text-sm outline-none data-[disabled]:cursor-default data-[disabled]:opacity-40 data-[highlighted]:bg-raised'
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button type="button" aria-label={`More for ${place}`} className="grid size-10 shrink-0 place-items-center rounded-lg text-muted hover:bg-raised hover:text-fg">
          <svg viewBox="0 0 20 20" className="size-5" aria-hidden>
            <circle cx="4.5" cy="10" r="1.6" fill="currentColor" />
            <circle cx="10" cy="10" r="1.6" fill="currentColor" />
            <circle cx="15.5" cy="10" r="1.6" fill="currentColor" />
          </svg>
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={4} className="z-[60] min-w-48 rounded-xl border border-line bg-surface p-1 shadow-lg">
          <DropdownMenu.Item disabled={first} onSelect={() => onMove(-1)} className={item}>
            Move up
          </DropdownMenu.Item>
          <DropdownMenu.Item disabled={last} onSelect={() => onMove(1)} className={item}>
            Move down
          </DropdownMenu.Item>
          <DropdownMenu.Item onSelect={onEdit} className={item}>
            Change place, name or note
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="my-1 h-px bg-line" />
          <DropdownMenu.Item onSelect={onRemove} className={`${item} text-danger`}>
            Remove {place}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
