import { setHome } from '../lib/travelActions.ts'
import { useStore, useTravelState } from '../store/useTravel.ts'
import { PlacePicker } from './PlacePicker.tsx'
import { useToast } from './toastContext.ts'

/** Where your trips start and end, for the optional legs from and back to home. Synced with your trips. */
export function HomePanel() {
  const store = useStore()
  const { data } = useTravelState()
  const toast = useToast()
  const home = data.home && !data.home.deleted ? data.home : null
  return (
    <section aria-label="Home" className="rounded-xl border border-line p-4">
      <h2 className="font-display text-xl font-semibold">Home</h2>
      <p className="mt-1 text-sm text-muted">
        {home ? (
          <>
            Trips can start and end at <b className="text-fg">{home.name}</b>. Turn it on per trip in its Route step.
          </>
        ) : (
          'Pick your town so trips can show the way there and back. A town is enough; it stays in your private data.'
        )}
      </p>
      <div className="mt-3 flex flex-col gap-2">
        <PlacePicker
          label={home ? 'Change home' : 'Set home'}
          data={data}
          value={null}
          onChange={(chosen) => {
            if (!chosen) return
            const ref = chosen.ref
            const at = 'place' in ref ? ref.place : data.places.find((p) => p.id === ref.placeId)
            if (!at) return
            const undoId = store.apply((d, c) => setHome(d, c, { name: chosen.label, lat: at.lat, lng: at.lng }), 'Set home')
            if (undoId !== null) toast(`Home set to ${chosen.label}`, [{ label: 'Undo', onClick: () => store.undo(undoId) }])
          }}
        />
        {home && (
          <button
            type="button"
            onClick={() => {
              const undoId = store.apply((d, c) => setHome(d, c, null), 'Cleared home')
              if (undoId !== null) toast('Home cleared', [{ label: 'Undo', onClick: () => store.undo(undoId) }])
            }}
            className="min-h-10 w-fit rounded-lg px-3 text-sm font-bold text-muted hover:bg-raised hover:text-danger"
          >
            Clear home
          </button>
        )}
      </div>
    </section>
  )
}
