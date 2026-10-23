import { useMemo, useState } from 'react'
import { includesFamily } from '../lib/derive.ts'
import { todayIso, yearOf } from '../lib/partialDate.ts'
import { addPerson, saveTrip, type PlaceInput, type TripInput } from '../lib/travelActions.ts'
import { FAMILY_GROUP_ID, type PartialDate, type Trip } from '../lib/types.ts'
import { newId, useStore, useTravelState } from '../store/useTravel.ts'
import { DateField } from './DateField.tsx'
import { PeoplePicker } from './PeoplePicker.tsx'
import { describeRef, PlacePicker, PinGlyph, type ChosenPlace } from './PlacePicker.tsx'
import { Sheet } from './Sheet.tsx'
import { useToast } from './toastContext.ts'

interface StopDraft {
  key: string
  place: ChosenPlace
  startDate: PartialDate | null
  endDate: PartialDate | null
  note: string
  open: boolean
}

/** Asks the app to let you tap the map; resolves with the place you tapped, or null if cancelled. */
export type RequestPick = (label: string) => Promise<PlaceInput | null>

/**
 * Add or edit a trip: main destination, dates, key stops in order, who went, and the Family switch.
 * The sheet hides (keeping everything you've entered) while you pick a place on the map.
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
  const [endDate, setEndDate] = useState<PartialDate | null>(trip?.endDate ?? null)
  const [approximate, setApproximate] = useState(trip?.approximate ?? false)
  const [main, setMain] = useState<ChosenPlace | null>(() =>
    trip ? describeRef({ placeId: trip.mainPlaceId }, data) : initialMain ? describeRef({ place: initialMain }, data) : null,
  )
  const [stops, setStops] = useState<StopDraft[]>(() =>
    (trip?.stops ?? []).map((s) => ({ key: newId(), place: describeRef({ placeId: s.placeId }, data), startDate: s.startDate, endDate: s.endDate, note: s.note, open: false })),
  )
  const [companions, setCompanions] = useState<string[]>(trip?.companions ?? [])
  const [isFamily, setIsFamily] = useState(trip?.isFamily ?? false)
  // Once you flip the switch yourself, adding people no longer changes it.
  const [familyTouched, setFamilyTouched] = useState(!!trip)
  const [description, setDescription] = useState(trip?.description ?? '')
  const [highlights, setHighlights] = useState(trip?.highlights ?? '')
  const [rating, setRating] = useState<number | null>(trip?.rating ?? null)
  const [tags, setTags] = useState((trip?.tags ?? []).join(', '))
  const [error, setError] = useState<string | null>(null)

  const suggestedTitle = useMemo(() => (main ? `${main.label.replace(/ National Park$/, '')} ${yearOf(startDate)}` : ''), [main, startDate])

  const setWho = (ids: string[]) => {
    setCompanions(ids)
    if (!familyTouched) setIsFamily(includesFamily(store.getState().data, ids))
  }

  const pick = async (label: string, then: (p: ChosenPlace) => void) => {
    const place = await requestPick(label)
    if (place) then(describeRef({ place }, store.getState().data))
  }

  const moveStop = (i: number, by: -1 | 1) =>
    setStops((s) => {
      const next = [...s]
      ;[next[i], next[i + by]] = [next[i + by], next[i]]
      return next
    })
  const patchStop = (key: string, patch: Partial<StopDraft>) => setStops((s) => s.map((x) => (x.key === key ? { ...x, ...patch } : x)))

  const save = () => {
    if (!main) return setError('Choose where the trip went.')
    if (endDate && endDate < startDate) return setError('The end date is before the start date.')
    const input: TripInput = {
      title: title.trim() || suggestedTitle,
      startDate,
      endDate,
      approximate,
      main: main.ref,
      stops: stops.map((s) => ({ place: s.place.ref, startDate: s.startDate, endDate: s.endDate, note: s.note })),
      companions,
      isFamily,
      description,
      highlights,
      rating,
      tags: tags.split(','),
    }
    const undoId = store.apply((d, c) => saveTrip(d, c, input, trip?.id), trip ? `Edited ${input.title}` : `Added ${input.title}`)
    if (undoId === null) return setError(store.getState().error ?? "Couldn't save the trip.")
    const saved = trip ? store.getState().data.trips.find((t) => t.id === trip.id)! : store.getState().data.trips.at(-1)!
    toast(trip ? 'Trip updated' : `Added ${saved.title}`, [{ label: 'Undo', onClick: () => store.undo(undoId) }])
    onSaved(saved.mainPlaceId, saved.id)
  }

  const input = 'w-full rounded-lg border border-line bg-bg px-3 text-base'

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
        <PlacePicker
          label="Main destination"
          data={data}
          value={main}
          onChange={(p) => {
            setMain(p)
            setError(null)
          }}
          onPickOnMap={() => void pick('Tap the map to place the main destination', setMain)}
          autoFocus={!trip && !initialMain}
        />

        <label className="block">
          <span className="mb-1.5 block text-sm font-bold">Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={suggestedTitle || 'e.g. Utah Parks 2023'} className={`${input} h-11`} />
        </label>

        <div className="flex flex-col gap-4">
          <DateField label="Start" value={startDate} onChange={(v) => v && setStartDate(v)} allowUnknown={false} />
          <DateField label="End" value={endDate} onChange={setEndDate} unknownHint="Same as the start, or not sure." />
        </div>
        <label className="-mt-2 flex min-h-9 items-center gap-2 text-sm">
          <input type="checkbox" checked={approximate} onChange={(e) => setApproximate(e.target.checked)} className="size-4" />
          Dates are approximate
        </label>

        <section aria-label="Key destinations">
          <h3 className="mb-1.5 text-sm font-bold">Key destinations</h3>
          {stops.length > 0 && (
            <ol className="mb-2 flex flex-col gap-1.5">
              {stops.map((s, i) => (
                <li key={s.key} className="rounded-lg border border-line bg-bg">
                  <div className="flex items-center gap-1 py-1 pr-1 pl-2">
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-raised text-xs font-bold">{i + 1}</span>
                    <PinGlyph park={s.place.isPark} className="size-4" />
                    <button
                      type="button"
                      onClick={() => patchStop(s.key, { open: !s.open })}
                      aria-expanded={s.open}
                      className="min-h-10 min-w-0 flex-1 truncate px-1 text-left"
                    >
                      {s.place.label}
                      {s.place.detail && <span className="ml-1.5 text-xs text-muted">{s.place.detail}</span>}
                    </button>
                    <IconButton label={`Move ${s.place.label} up`} disabled={i === 0} onClick={() => moveStop(i, -1)} d="M6 12l4-4 4 4" />
                    <IconButton label={`Move ${s.place.label} down`} disabled={i === stops.length - 1} onClick={() => moveStop(i, 1)} d="M6 8l4 4 4-4" />
                    <IconButton label={`Remove ${s.place.label}`} onClick={() => setStops((x) => x.filter((y) => y.key !== s.key))} d="M6 6l8 8M14 6l-8 8" />
                  </div>
                  {s.open && (
                    <div className="flex flex-col gap-3 border-t border-line p-3">
                      <div className="flex flex-col gap-3">
                        <DateField label="Arrived" value={s.startDate} onChange={(v) => patchStop(s.key, { startDate: v })} unknownHint="Not set." />
                        <DateField label="Left" value={s.endDate} onChange={(v) => patchStop(s.key, { endDate: v })} unknownHint="Not set." />
                      </div>
                      <label className="block">
                        <span className="mb-1 block text-sm font-bold">Note</span>
                        <input value={s.note} onChange={(e) => patchStop(s.key, { note: e.target.value })} className={`${input} h-10`} />
                      </label>
                    </div>
                  )}
                </li>
              ))}
            </ol>
          )}
          <PlacePicker
            label={stops.length ? 'Add another stop' : 'Add a stop'}
            data={data}
            value={null}
            onChange={(p) => p && setStops((s) => [...s, { key: newId(), place: p, startDate: null, endDate: null, note: '', open: false }])}
            onPickOnMap={() =>
              void pick('Tap the map to add a stop', (p) => setStops((s) => [...s, { key: newId(), place: p, startDate: null, endDate: null, note: '', open: false }]))
            }
          />
        </section>

        <PeoplePicker
          data={data}
          value={companions}
          onChange={setWho}
          onAddPerson={(name, inFamily) => {
            const id = newId()
            const ok = store.apply((d, c) => addPerson(d, c, id, { name, groupIds: inFamily ? [FAMILY_GROUP_ID] : [] }), `Added ${name}`)
            return ok === null ? null : id
          }}
        />

        <label className="flex min-h-11 items-center justify-between gap-3 rounded-lg border border-line bg-bg px-3">
          <span>
            <span className="font-bold">Family trip</span>
            <span className="block text-xs text-muted">Turns on when someone from Family is added.</span>
          </span>
          <input
            type="checkbox"
            role="switch"
            checked={isFamily}
            onChange={(e) => {
              setIsFamily(e.target.checked)
              setFamilyTouched(true)
            }}
            className="size-5 accent-[var(--park)]"
          />
        </label>

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
              <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="road trip, camping" className={`${input} h-10`} />
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
