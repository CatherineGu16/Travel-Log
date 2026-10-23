import { useMemo, useState } from 'react'
import { describeRef, type ChosenPlace } from '../lib/chosenPlace.ts'
import { comparePartialDates, formatDateRange, todayIso, yearOf } from '../lib/partialDate.ts'
import { addPerson, saveTrip, type PlaceInput, type TripInput } from '../lib/travelActions.ts'
import { FAMILY_GROUP_ID, type PartialDate, type TravelMode, type Trip, type TripHike } from '../lib/types.ts'
import { newId, useStore, useTravelState } from '../store/useTravel.ts'
import { DateRangeField } from './DateRangeField.tsx'
import { HikesField } from './HikesField.tsx'
import { PeoplePicker } from './PeoplePicker.tsx'
import { ParkSuggestion, PinGlyph, PlacePicker } from './PlacePicker.tsx'
import { Sheet } from './Sheet.tsx'
import { useToast } from './toastContext.ts'
import { TRAVEL_MODES } from '../lib/travelModes.ts'

interface DestinationDraft {
  key: string
  place: ChosenPlace
  isMain: boolean
  /** Null when you haven't said when you were here; the trip's dates are used. */
  startDate: PartialDate | null
  endDate: PartialDate | null
  note: string
  open: boolean
}

/** Asks the app to let you tap the map; resolves with the place you tapped, or null if cancelled. */
export type RequestPick = (label: string) => Promise<PlaceInput | null>

/** Compares partial dates at the coarser of the two precisions ("2024-05" contains "2024-05-03"). */
const compareLoose = (a: PartialDate, b: PartialDate) => {
  const n = Math.min(a.length, b.length)
  return comparePartialDates(a.slice(0, n), b.slice(0, n))
}

/**
 * Add or edit a trip: where it went (destinations in order, any of them main, each with its own
 * dates), the trip's dates, how you traveled, who went, and the Family switch. The sheet hides
 * (keeping everything you've entered) while you pick a place on the map.
 */
export function TripForm({
  trip,
  initialMain,
  hidden,
  requestPick,
  onClose,
  onSaved,
}: {
  trip: Trip | null
  initialMain: PlaceInput | null
  hidden: boolean
  requestPick: RequestPick
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
        open: false,
      }))
    if (initialMain)
      return [{ key: newId(), place: describeRef({ place: initialMain }, data), isMain: true, startDate: null, endDate: null, note: '', open: false }]
    return []
  })
  const [travelMode, setTravelMode] = useState<TravelMode | null>(trip?.travelMode ?? null)
  const [companions, setCompanions] = useState<string[]>(trip?.companions ?? [])
  const [companionGroupIds, setCompanionGroupIds] = useState<string[]>(trip?.companionGroupIds ?? [])
  const [description, setDescription] = useState(trip?.description ?? '')
  const [highlights, setHighlights] = useState(trip?.highlights ?? '')
  const [rating, setRating] = useState<number | null>(trip?.rating ?? null)
  const [tags, setTags] = useState((trip?.tags ?? []).join(', '))
  const [hikes, setHikes] = useState<TripHike[]>(trip?.hikes ?? [])
  const [error, setError] = useState<string | null>(null)

  const mains = destinations.filter((d) => d.isMain)
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

  /** Destination edits; on a new trip whose dates you haven't set, the trip spans the destinations' dates. */
  const updateDestinations = (fn: (d: DestinationDraft[]) => DestinationDraft[]) =>
    setDestinations((current) => {
      const next = fn(current)
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
    updateDestinations((d) => [...d, { key: newId(), place, isMain: d.length === 0, startDate: null, endDate: null, note: '', open: false }])

  const pick = async (label: string, then: (p: ChosenPlace) => void) => {
    const place = await requestPick(label)
    if (place) then(describeRef({ place }, store.getState().data))
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

  const save = () => {
    if (destinations.length === 0) return setError('Add where the trip went.')
    if (compareLoose(endDate, startDate) < 0) return setError('The end date is before the start date.')
    for (const d of destinations) {
      if (!d.startDate) continue
      const end = d.endDate ?? d.startDate
      if (compareLoose(end, d.startDate) < 0) return setError(`${d.place.label}: you left before you arrived.`)
      if (compareLoose(d.startDate, startDate) < 0 || compareLoose(end, endDate) > 0)
        return setError(`${d.place.label}'s dates are outside the trip's dates.`)
    }
    const input: TripInput = {
      title: title.trim() || suggestedTitle,
      startDate,
      endDate,
      approximate,
      destinations: destinations.map((d) => ({ place: d.place.ref, isMain: d.isMain, startDate: d.startDate, endDate: d.endDate, note: d.note })),
      companions,
      companionGroupIds,
      travelMode,
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
  let stopNumber = 0

  return (
    <Sheet
      open={!hidden}
      onOpenChange={(open) => !open && onClose()}
      title={trip ? 'Edit trip' : 'Add trip'}
      accent="var(--primary)"
      footer={
        <div className="flex items-center gap-2">
          {error && (
            <p role="alert" className="mr-auto text-sm text-danger">
              {error}
            </p>
          )}
          <button type="button" onClick={onClose} className="ml-auto min-h-11 rounded-lg px-4 font-bold text-muted hover:text-fg">
            Cancel
          </button>
          <button type="button" onClick={save} className="min-h-11 rounded-lg bg-primary px-5 font-bold text-on-primary">
            {trip ? 'Save' : 'Add trip'}
          </button>
        </div>
      }
    >
      <form
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        <section aria-label="Where you went">
          <h3 className="text-sm font-bold">Where you went</h3>
          <p className="mb-2 text-xs text-muted">In order. Tap a pin to make that place a main destination; each main destination gets a pin on the map.</p>
          {destinations.length > 0 && (
            <ol className="mb-2 flex flex-col gap-1.5">
              {destinations.map((d, i) => {
                const number = d.isMain ? null : ++stopNumber
                const onlyMain = d.isMain && mains.length === 1
                return (
                  <li key={d.key} className="rounded-lg border border-line bg-bg" aria-label={d.place.label}>
                    <div className="flex items-center gap-1 py-1 pr-1 pl-1">
                      <button
                        type="button"
                        aria-label={d.isMain ? `${d.place.label} is a main destination` : `Make ${d.place.label} a main destination`}
                        aria-pressed={d.isMain}
                        disabled={onlyMain}
                        title={onlyMain ? 'A trip needs at least one main destination' : d.isMain ? 'Main destination: tap to make it a stop' : 'Stop: tap to make it a main destination'}
                        onClick={() => patch(d.key, { isMain: !d.isMain })}
                        className="grid size-10 shrink-0 place-items-center rounded-md hover:bg-raised disabled:cursor-default disabled:hover:bg-transparent"
                      >
                        {d.isMain ? (
                          <PinGlyph park={d.place.isPark} className="size-6" />
                        ) : (
                          <span className="grid size-6 place-items-center rounded-full bg-[var(--route)] text-xs font-bold text-[var(--route-text)]">{number}</span>
                        )}
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
                              patch(d.key, e.target.checked ? { startDate: startDate, endDate: endDate === startDate ? null : endDate } : { startDate: null, endDate: null })
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
                  </li>
                )
              })}
            </ol>
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
            onPickOnMap={() => void pick('Tap the map to add a destination', addDestination)}
            autoFocus={!trip && !initialMain && !matchMedia('(pointer: coarse)').matches}
          />
        </section>

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
          <legend className="mb-1.5 text-sm font-bold">How you traveled</legend>
          <div className="flex flex-wrap gap-2">
            {TRAVEL_MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                aria-pressed={travelMode === m.id}
                onClick={() => setTravelMode(travelMode === m.id ? null : m.id)}
                className={`flex min-h-10 items-center gap-1.5 rounded-full border px-3 text-sm ${travelMode === m.id ? 'border-primary bg-primary font-bold text-on-primary' : 'border-line hover:bg-raised'}`}
              >
                <span aria-hidden>{m.icon}</span>
                {m.label}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="block">
          <span className="mb-1.5 block text-sm font-bold">Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={suggestedTitle || 'e.g. Utah Parks 2023'} className={`${input} h-11`} />
        </label>

        <HikesField parkIds={parkIds} value={hikes} onChange={setHikes} />

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

        <details className="group rounded-lg border border-line" open={!!(trip && (description || highlights || rating || tags))}>
          <summary className="flex min-h-11 cursor-pointer items-center px-3 text-sm font-bold">Notes, rating and tags</summary>
          <div className="flex flex-col gap-4 border-t border-line p-3">
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
            </label>
          </div>
        </details>
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
