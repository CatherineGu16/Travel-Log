import { useRef, type PointerEvent } from 'react'
import type { Place, TravelData } from '../lib/types.ts'
import { youHref, type Page, type YouSection } from '../ui/route.ts'
import type { ParkInfo } from '../lib/placeSearch.ts'
import { ParksSection } from './ParksSection.tsx'
import { PeoplePanel } from './PeoplePanel.tsx'
import { Settings } from './Settings.tsx'
import { AchievementsSection, ProfileSection } from './YouSections.tsx'

const SECTIONS: { id: YouSection; label: string; short?: string }[] = [
  { id: 'profile', label: 'Profile' },
  { id: 'achievements', label: 'Achievements' },
  { id: 'parks', label: 'Parks' },
  { id: 'people', label: 'People & groups', short: 'People' },
  { id: 'settings', label: 'Settings' },
]

/**
 * You: Profile, Achievements, People & groups and Settings, each at its own address. A menu down
 * the left on wider screens; tabs across the top on phones, where a sideways swipe moves between them.
 */
export function YouPage({
  data,
  section,
  onGoTo,
  onOpenPlace,
  onSection,
  onOpenPark,
  onLogVisit,
}: {
  data: TravelData
  section: YouSection
  onGoTo: (page: Page | 'parks') => void
  onOpenPlace: (place: Place) => void
  onSection: (section: YouSection) => void
  onOpenPark: (parkId: string) => void
  onLogVisit: (park: ParkInfo) => void
}) {
  // A sideways swipe on a phone: to the next section on the left, the previous on the right.
  const swipe = useRef<{ x: number; y: number } | null>(null)
  const startSwipe = (e: PointerEvent) => {
    const target = e.target as HTMLElement
    swipe.current = e.pointerType === 'touch' && !target.closest('input, textarea, select, [data-noswipe]') ? { x: e.clientX, y: e.clientY } : null
  }
  const endSwipe = (e: PointerEvent) => {
    const start = swipe.current
    swipe.current = null
    if (!start) return
    const dx = e.clientX - start.x
    const dy = e.clientY - start.y
    if (Math.abs(dx) < 60 || Math.abs(dx) < 2 * Math.abs(dy)) return
    const next = SECTIONS.findIndex((s) => s.id === section) + (dx < 0 ? 1 : -1)
    if (next >= 0 && next < SECTIONS.length) onSection(SECTIONS[next].id)
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-3 pt-6 pb-10 sm:px-6">
      <h1 className="mb-3 font-display text-3xl font-semibold">You</h1>
      <div className="sm:flex sm:items-start sm:gap-6">
        <nav aria-label="You sections" className="-mx-3 mb-4 border-b border-line px-3 sm:sticky sm:top-24 sm:mx-0 sm:mb-0 sm:w-48 sm:shrink-0 sm:border-0 sm:px-0">
          <ul className="flex sm:flex-col sm:gap-0.5">
            {SECTIONS.map((s) => {
              const current = s.id === section
              return (
                <li key={s.id} className="flex-1 sm:flex-none">
                  <a
                    href={youHref(s.id)}
                    aria-current={current ? 'page' : undefined}
                    aria-label={s.label}
                    className={`flex min-h-11 items-center justify-center border-b-2 px-1 text-sm font-bold whitespace-nowrap sm:justify-start sm:rounded-lg sm:border-0 sm:px-3 ${
                      current ? 'border-primary text-primary sm:bg-raised sm:text-fg' : 'border-transparent text-muted hover:text-fg sm:hover:bg-raised'
                    }`}
                  >
                    <span className="sm:hidden">{s.short ?? s.label}</span>
                    <span className="hidden sm:inline">{s.label}</span>
                  </a>
                </li>
              )
            })}
          </ul>
        </nav>
        <div className="min-w-0 flex-1 touch-pan-y" onPointerDown={startSwipe} onPointerUp={endSwipe} onPointerCancel={() => (swipe.current = null)}>
          {section === 'profile' && <ProfileSection data={data} onGoTo={onGoTo} onOpenPlace={onOpenPlace} />}
          {section === 'achievements' && <AchievementsSection data={data} />}
          {section === 'parks' && <ParksSection data={data} onOpenPark={onOpenPark} onLogVisit={onLogVisit} />}
          {section === 'people' && <PeoplePanel />}
          {section === 'settings' && <Settings />}
        </div>
      </div>
    </div>
  )
}
