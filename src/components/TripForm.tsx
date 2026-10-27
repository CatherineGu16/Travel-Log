import { useMemo, useState } from 'react'
import { describeRef, type ChosenPlace } from '../lib/chosenPlace.ts'
import { comparePartialDates, formatDateRange, todayIso, yearOf } from '../lib/partialDate.ts'
import { addPerson, saveTrip, type PlaceInput, type TripInput } from '../lib/travelActions.ts'
import { endOfHome, homeLeg, legMemory, makeLeg, returnLegs, type Leg, type LegEnd } from '../lib/legs.ts'
import { FAMILY_GROUP_ID, type HomeMode, type LegMode, type LngLat, type PartialDate, type TravelData, type Trip, type TripHike, type TripStart } from '../lib/types.ts'
import { newId, useStore, useTravelState } from '../store/useTravel.ts'
import { DateRangeField } from './DateRangeField.tsx'
import { HikesField } from './HikesField.tsx'
import { PeoplePicker } from './PeoplePicker.tsx'
import { ParkSuggestion, PinGlyph, PlacePicker } from './PlacePicker.tsx'
import { Sheet } from './Sheet.tsx'
import { HomeGlyph, LegRow, ReturnRow } from './LegRow.tsx'
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

/** Asks the app to let you shape a leg on the map; resolves with its bends, or null if cancelled. */
export type RequestShape = (from: RouteEnd, to: RouteEnd, via: LngLat[]) => Promise<LngLat[] | null>

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
 * home), and Notes (hikes, description, rating, tags). The sheet hides (keeping everything you've
 * entered) while you shape a route on the map.
 */
export function TripForm({
  trip,
  initialMain,
  hidden,
  requestShape,
  onClose,
  onSaved,
}: {
  trip: Trip | null
  initialMain: PlaceInput | null
  hidden: boolean
  requestShape: RequestShape
  onClose: () => void
  onSaved: (mainPlaceId: string, tripId: string) => void
}) {
  const store = useStore()
  const { data } = useTravelState()
  const toast = useToast()

  const [title, setTitle] = useState(trip?.title ?? '')
  const [startDate, setStartDate] = useState<PartialDate>(trip?.startDate ?? todayIso())
  const [endDate, setEndDate] = useState<PartialDate>(trip?.endDate ?? trip?.startDate ?? todayIso())
  // On a new trip, destination dates fill in the trip's dates until you set them yourself.
  const [datesTouched, setDatesTouched] = useState(!!trip)
  const [approximate, setApproximate] = useState(trip?.approximate ?? false)
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
  const [step, setStep] = useState<Step>(0)
  // Where the trip started and ended: new trips start at Home; a trip keeps its own copy, so
  // changing Home later doesn't move it. Trips saved before that follow Home until saved.
  const homeNow: TripStart | null = data.home && !data.home.deleted ? { name: data.home.name, lat: data.home.lat, lng: data.home.lng } : null
  const [start, setStart] = useState<TripStart | null>(() => (trip && trip.start !== undefined ? trip.start : homeNow))
  const [changingStart, setChangingStart] = useState(false)
  const [homeMode, setHomeMode] = useState<HomeMode>(trip?.homeMode ?? 'flight')
  const [returnSameWay, setReturnSameWay] = useState(trip?.returnSameWay ?? false)
  const [companions, setCompanions] = useState<string[]>(trip?.companions ?? [])
  const [companionGroupIds, setCompanionGroupIds] = useState<string[]>(trip?.companionGroupIds ?? [])
  const [description, setDescription] = useState(trip?.description ?? '')
  const [highlights, setHighlights] = useState(trip?.highlights ?? '')
  const [rating, setRating] = useState<number | null>(trip?.rating ?? null)
  const [tags, setTags] = useState((trip?.tags ?? []).join(', '))
  const [hikes, setHikes] = useState<TripHike[]>(trip?.hikes ?? [])
  const [error, setError] = useState<string | null>(null)

  const mains = destinations.filter((d) => d.isMain)

  // Modes you picked on your other trips, so a route you've corrected before is guessed right.
  const memory = useMemo(() => legMemory({ ...data, trips: data.trips.filter((t) => t.id !== trip?.id) }), [data, trip?.id])
  const home = start ? endOfHome(start) : null
  const ends = destinations.map((d) => legEndOf(d, data))
  const legBefore = (i: number) => {
    const [from, to] = [ends[i - 1], ends[i]]
    return from && to ? makeLeg(from, to, destinations[i].via, destinations[i].legMode, memory) : null
  }
  // Coming back the same way needs somewhere to come back through.
  const comesBack = returnSameWay && destinations.length > 1
  const backThrough = comesBack ? returnLegs(destinations.slice(1).flatMap((_, k) => legBefore(k + 1) ?? [])) : []
  const first = ends[0]
  const end = comesBack ? first : ends.at(-1)
  const toLeg: Leg | null = home && first ? homeLeg(home, first, homeMode) : null
  const backLeg: Leg | null = home && end ? homeLeg(end, home, homeMode) : null
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
  const shapeLeg = async (i: number) => {
    const latest = store.getState().data
    const from = endOf(destinations[i - 1].place, latest)
    const to = endOf(destinations[i].place, latest)
    if (!from || !to) return
    const key = destinations[i].key
    const via = await requestShape(from, to, destinations[i].via)
    if (via) patch(key, { via })
  }

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
      companionGroupIds,
      start,
      homeMode,
      returnSameWay: comesBack,
      description,
      highlights,
      rating,
      tags: tags.split(','),
      // Hikes in parks that are no longer on the trip are dropped.
      hikes: hikes.filter((h) => parkIds.includes(h.parkId)),
    }
    const undoId = store.apply((d, c) => saveTrip(d, c, input, trip?.id), trip ? `Edited ${input.title}` : `Added ${input.title}`)
    if (undoId === null) return setError(store.getState().error ?? "Couldn't save the trip.")
    const saved = trip ? store.getState().data.trips.find((t) => t.id === trip.id)! : store.getState().data.trips.at(-1)!
    toast(trip ? 'Trip updated' : `Added ${saved.title}`, [{ label: 'Undo', onClick: () => store.undo(undoId) }])
    onSaved(saved.destinations.find((d) => d.isMain)!.placeId, saved.id)
  }

  const input = 'w-full rounded-lg border border-line bg-bg px-3 text-base'
  const secondary = 'min-h-11 rounded-lg px-4 font-bold text-muted hover:text-fg'
  const primary = 'min-h-11 rounded-lg bg-primary px-5 font-bold text-on-primary'
  const saveLabel = trip ? 'Save' : 'Add trip'
  // Editing saves from any step; a new trip once it has somewhere to go. Notes are optional.
  const canSave = !!trip || step > 0 || destinations.length > 0
  let stopNumber = 0

  return (
    <Sheet
      open={!hidden}
      onOpenChange={(open) => !open && onClose()}
      title={trip ? 'Edit trip' : 'Add trip'}
      accent="var(--primary)"
      footer={
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
      }
    >
      <nav aria-label="Steps" className="-mt-1 mb-4 flex gap-1">
        {STEPS.map((name, i) => (
          <button
            key={name}
            type="button"
            aria-current={step === i ? 'step' : undefined}
            onClick={() => goTo(i as Step)}
            className={`flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg border-b-2 text-sm ${step === i ? 'border-primary font-bold text-fg' : 'border-line text-muted hover:text-fg'}`}
          >
            <span
              aria-hidden
              className={`grid size-5 place-items-center rounded-full text-xs font-bold ${step === i ? 'bg-primary text-on-primary' : 'bg-raised text-muted'}`}
            >
              {i + 1}
            </span>
            {name}
          </button>
        ))}
      </nav>
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
            <label className="-mt-2 flex min-h-9 items-center gap-2 text-sm">
              <input type="checkbox" checked={approximate} onChange={(e) => setApproximate(e.target.checked)} className="size-4" />
              Dates are approximate
            </label>

            <fieldset>
              <legend className="mb-1.5 text-sm font-bold">Started and ended at</legend>
              {start && !changingStart ? (
                <div className="flex min-h-11 items-center gap-2">
                  <HomeGlyph className="size-5" />
                  <span className="min-w-0 truncate font-bold">{start.name}</span>
                  <button
                    type="button"
                    onClick={() => setChangingStart(true)}
                    aria-label={`Change where the trip started (${start.name})`}
                    className="min-h-10 rounded-lg px-2 text-sm font-bold text-primary hover:bg-raised"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <PlacePicker
                    label="Where the trip started"
                    data={data}
                    value={null}
                    onChange={(p) => {
                      const at = p && endOf(p, data)
                      if (!at) return
                      setStart({ name: at.name, lat: at.lat, lng: at.lng })
                      setChangingStart(false)
                    }}
                  />
                  <div className="flex flex-wrap gap-1 text-sm">
                    {homeNow && (homeNow.lat !== start?.lat || homeNow.lng !== start?.lng) && (
                      <button
                        type="button"
                        onClick={() => {
                          setStart(homeNow)
                          setChangingStart(false)
                        }}
                        className="min-h-10 rounded-lg px-2 font-bold text-primary hover:bg-raised"
                      >
                        Use home ({homeNow.name})
                      </button>
                    )}
                    {changingStart && (
                      <button type="button" onClick={() => setChangingStart(false)} className="min-h-10 rounded-lg px-2 text-muted hover:bg-raised hover:text-fg">
                        Keep {start?.name}
                      </button>
                    )}
                  </div>
                  {!homeNow && <p className="text-xs text-muted">Set your home in Settings and new trips will start there.</p>}
                </div>
              )}
              {start && (
                <div role="radiogroup" aria-label="How you got there and back" className="mt-1 flex w-fit rounded-lg bg-bg p-0.5">
                  {(
                    [
                      ['flight', '✈️ Flew'],
                      ['drive', '🚗 Drove'],
                    ] as const
                  ).map(([mode, label]) => (
                    <button
                      key={mode}
                      type="button"
                      role="radio"
                      aria-checked={homeMode === mode}
                      onClick={() => setHomeMode(mode)}
                      className={`min-h-10 rounded-md px-3 text-sm ${homeMode === mode ? 'bg-raised font-bold text-fg' : 'text-muted hover:text-fg'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </fieldset>

            <PeoplePicker
              data={data}
              value={companions}
              onChange={setCompanions}
              groupIds={companionGroupIds}
              onGroupsChange={setCompanionGroupIds}
              onAddPerson={(name, inFamily) => {
                const id = newId()
                const ok = store.apply((d, c) => addPerson(d, c, id, { name, groupIds: inFamily ? [FAMILY_GROUP_ID] : [] }), `Added ${name}`)
                return ok === null ? null : id
              }}
            />
          </>
        )}

        {step === 1 && (
          <section aria-label="Where you went">
            <h3 className="text-sm font-bold">Where you went</h3>
            <p className="mb-2 text-xs text-muted">
              In order. Choose <b>Main</b> for each place that gets a pin on the map; the rest are stops along the way. Between two places, tap how you went to
              change it, and shape a drive to follow the road.
            </p>
            {toLeg && (
              <div aria-label={`From ${start?.name}`}>
                <div className="flex min-h-11 items-center gap-2 pl-2">
                  <HomeGlyph className="size-6" />
                  <span className="font-bold">{start?.name}</span>
                </div>
                <LegRow leg={toLeg} />
              </div>
            )}
            {destinations.length > 0 && (
              <ol className="mb-2 flex flex-col">
                {destinations.map((d, i) => {
                  const number = d.isMain ? null : ++stopNumber
                  const onlyMain = d.isMain && mains.length === 1
                  const leg = i > 0 ? legBefore(i) : null
                  return (
                    <li key={d.key} aria-label={d.place.label}>
                      {leg && (
                        <LegRow leg={leg} onPick={(legMode) => patch(d.key, { legMode })}>
                          {leg.mode !== 'flight' && (
                            <button
                              type="button"
                              onClick={() => void shapeLeg(i)}
                              aria-label={`Shape the route from ${destinations[i - 1].place.label} to ${d.place.label} on the map`}
                              className="min-h-11 rounded-md px-1.5 font-bold text-[var(--route)] hover:bg-raised"
                            >
                              {d.via.length ? `Bends ${d.via.length}× · Edit` : 'Shape on map'}
                            </button>
                          )}
                          {d.via.length > 0 && (
                            <button type="button" onClick={() => patch(d.key, { via: [] })} className="min-h-11 rounded-md px-1.5 hover:bg-raised hover:text-fg">
                              Straighten
                            </button>
                          )}
                        </LegRow>
                      )}
                      <div className="rounded-lg border border-line bg-bg">
                        <div className="flex items-center gap-1 py-1 pr-1 pl-1">
                          <button
                            type="button"
                            aria-label={d.isMain ? `${d.place.label} is a main destination` : `Make ${d.place.label} a main destination`}
                            aria-pressed={d.isMain}
                            disabled={onlyMain}
                            title={
                              onlyMain
                                ? 'A trip needs at least one main destination'
                                : d.isMain
                                  ? 'Main destination: tap to make it a stop'
                                  : 'Stop: tap to make it a main destination'
                            }
                            onClick={() => patch(d.key, { isMain: !d.isMain })}
                            className={`flex h-10 shrink-0 items-center gap-1 rounded-full border py-1 pr-2.5 pl-1 text-xs font-bold disabled:cursor-default ${d.isMain ? 'border-primary/50 bg-primary/10 text-fg' : 'border-line text-muted hover:bg-raised hover:text-fg'}`}
                          >
                            {d.isMain ? (
                              <PinGlyph park={d.place.isPark} className="size-6" />
                            ) : (
                              <span className="grid size-6 place-items-center rounded-full bg-[var(--route)] text-xs font-bold text-[var(--route-text)]">
                                {number}
                              </span>
                            )}
                            <span aria-hidden>{d.isMain ? 'Main' : 'Stop'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => patch(d.key, { open: !d.open })}
                            aria-expanded={d.open}
                            className="min-h-10 min-w-0 flex-1 px-1 text-left"
                          >
                            <span className="block truncate">
                              <span className={d.isMain ? 'font-bold' : ''}>{d.place.label}</span>
                              {d.place.detail && <span className="ml-1.5 text-xs text-muted">{d.place.detail}</span>}
                            </span>
                            <span className="block text-xs text-muted">
                              {d.startDate ? formatDateRange(d.startDate, d.endDate) : 'Add dates'}
                              {d.note && ` · ${d.note}`}
                            </span>
                          </button>
                          <IconButton label={`Move ${d.place.label} up`} disabled={i === 0} onClick={() => move(i, -1)} d="M6 12l4-4 4 4" />
                          <IconButton label={`Move ${d.place.label} down`} disabled={i === destinations.length - 1} onClick={() => move(i, 1)} d="M6 8l4 4 4-4" />
                          <IconButton label={`Remove ${d.place.label}`} onClick={() => remove(d.key)} d="M6 6l8 8M14 6l-8 8" />
                        </div>
                        <div className="px-2 empty:hidden">
                          <ParkSuggestion
                            value={d.place}
                            onLink={(park) =>
                              'place' in d.place.ref &&
                              patch(d.key, { place: describeRef({ place: { ...d.place.ref.place, parkId: park.id, name: park.fullName } }, data) })
                            }
                          />
                        </div>
                        {d.open && (
                          <div className="flex flex-col gap-3 border-t border-line p-3">
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
                            <label className="flex min-h-9 items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={!!d.startDate}
                                onChange={(e) =>
                                  patch(
                                    d.key,
                                    e.target.checked
                                      ? { startDate: startDate, endDate: endDate === startDate ? null : endDate }
                                      : { startDate: null, endDate: null },
                                  )
                                }
                                className="size-4"
                              />
                              I know when I was here
                            </label>
                            {d.startDate && (
                              <DateRangeField
                                label={`Dates at ${d.place.label}`}
                                start={d.startDate}
                                end={d.endDate ?? d.startDate}
                                onChange={(startDate, endDate) => patch(d.key, { startDate, endDate })}
                              />
                            )}
                            <label className="block">
                              <span className="mb-1 block text-sm font-bold">Note</span>
                              <input value={d.note} onChange={(e) => patch(d.key, { note: e.target.value })} className={`${input} h-10`} />
                            </label>
                          </div>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ol>
            )}
            {destinations.length > 1 && (
              <label className="flex min-h-11 items-center gap-2 text-sm">
                <input type="checkbox" checked={returnSameWay} onChange={(e) => setReturnSameWay(e.target.checked)} className="size-4" />
                Came back the same way
              </label>
            )}
            {comesBack && <ReturnRow legs={backThrough} />}
            {backLeg && (
              <div aria-label={`Back to ${start?.name}`}>
                <LegRow leg={backLeg} />
                <div className="mb-2 flex min-h-11 items-center gap-2 pl-2">
                  <HomeGlyph className="size-6" />
                  <span className="font-bold">{start?.name}</span>
                </div>
              </div>
            )}
            <PlacePicker
              label={destinations.length ? 'Add another destination' : 'Add a destination'}
              data={data}
              near={near}
              value={null}
              onChange={(p) => {
                if (p) addDestination(p)
                setError(null)
              }}
              autoFocus={destinations.length === 0 && !matchMedia('(pointer: coarse)').matches}
            />
          </section>
        )}

        {step === 2 && (
          <>
            <HikesField parkIds={parkIds} data={data} value={hikes} onChange={setHikes} />
            <label className="block">
              <span className="mb-1 block text-sm font-bold">Description</span>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={`${input} py-2`} />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-bold">Highlights</span>
              <textarea value={highlights} onChange={(e) => setHighlights(e.target.value)} rows={2} className={`${input} py-2`} />
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
            <label className="block">
              <span className="mb-1 block text-sm font-bold">Tags</span>
              <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="camping, beach" className={`${input} h-10`} />
              <span className="mt-1 block text-xs text-muted">Separate with commas. Filter the map and lists by a tag.</span>
            </label>
          </>
        )}
        <button type="submit" hidden />
      </form>
    </Sheet>
  )
}

function IconButton({ label, onClick, disabled, d }: { label: string; onClick: () => void; disabled?: boolean; d: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-10 shrink-0 place-items-center rounded-md text-muted hover:bg-raised hover:text-fg disabled:opacity-30"
    >
      <svg viewBox="0 0 20 20" className="size-4" aria-hidden>
        <path d={d} stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )
}
