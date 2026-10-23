import { lazy, Suspense } from 'react'
import parks from './data/national-parks.json'

// MapLibre is most of the app's code, so it loads as its own chunk after the shell.
const MapView = lazy(() => import('./map/MapView.tsx').then((m) => ({ default: m.MapView })))

const STATE_COUNT = 50

export default function App() {
  return (
    <div className="relative h-full w-full overflow-hidden">
      <Suspense fallback={<div className="h-full w-full bg-bg" />}>
        <MapView />
      </Suspense>
      <header className="pointer-events-none absolute inset-x-0 top-0 flex justify-center px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="pointer-events-auto flex items-center gap-4 rounded-xl border border-line bg-surface/95 px-4 py-2 shadow-md">
          <h1 className="font-display text-2xl font-semibold tracking-wide">Travel Log</h1>
          <dl className="flex gap-3 text-sm text-muted">
            <div className="flex gap-1">
              <dt className="sr-only">States visited</dt>
              <dd>
                <span className="font-bold text-fg">0</span> / {STATE_COUNT} states
              </dd>
            </div>
            <div className="flex gap-1">
              <dt className="sr-only">National parks visited</dt>
              <dd>
                <span className="font-bold text-park">0</span> / {parks.length} parks
              </dd>
            </div>
          </dl>
        </div>
      </header>
    </div>
  )
}
