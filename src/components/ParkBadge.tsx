import { useId } from 'react'
import { badgeArt } from './parkBadgeArt.ts'

/** "Black Canyon of the Gunnison" → "BC", "Zion" → "Z": the placeholder's letters. */
const initials = (name: string) =>
  name
    .split(/[\s–-]+/)
    .filter((w) => w && !/^(of|the)$/i.test(w))
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')

/**
 * A national park's badge, like an Apple Watch award: in color with a sheen once you've been
 * (`earned`), outlined and faded until then. Your art from src/assets/park-badges/ when the park
 * has it (its "-outline" file for the not-yet look, else the art grayed in a ring); otherwise a
 * placeholder frame with the park's initials. Decorative: whatever holds it says what it is.
 */
export function ParkBadge({ parkId, name, earned, size }: { parkId: string; name: string; earned: boolean; size: number }) {
  const art = badgeArt(parkId)
  const gradient = useId()
  const box = { width: size, height: size }

  if (art.color) {
    const src = earned ? art.color : (art.outline ?? art.color)
    // No outline file: the colored art, gray and faded, in a dashed ring.
    const faded = !earned && !art.outline
    return (
      <span aria-hidden className={`relative block shrink-0 ${earned ? 'drop-shadow-[0_4px_6px_rgb(0_0_0/0.25)]' : ''}`} style={box}>
        <img src={src} alt="" draggable={false} loading="lazy" className={`size-full object-contain ${faded ? 'scale-[0.82] opacity-35 grayscale' : ''}`} />
        {faded && <span className="absolute inset-0 rounded-full border-2 border-dashed border-muted/60" />}
        {/* The sheen, cut to the art's own shape. */}
        {earned && <span className="badge-sheen absolute inset-0" style={{ maskImage: `url(${src})`, WebkitMaskImage: `url(${src})` }} />}
      </span>
    )
  }

  const letters = initials(name)
  return (
    <span aria-hidden className={`relative block shrink-0 ${earned ? 'drop-shadow-[0_4px_6px_rgb(0_0_0/0.25)]' : ''}`} style={box}>
      <svg viewBox="0 0 100 100" className="size-full">
        {earned ? (
          <>
            <defs>
              <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="color-mix(in srgb, var(--park) 70%, white)" />
                <stop offset="1" stopColor="var(--park)" />
              </linearGradient>
            </defs>
            <circle cx="50" cy="50" r="47" fill={`url(#${gradient})`} />
            <circle cx="50" cy="50" r="40" fill="none" stroke="white" strokeOpacity="0.45" strokeWidth="1.5" />
            <path d="M24 64 40 42l8 10 10-15 18 27Z" fill="white" fillOpacity="0.9" />
            <text x="50" y="80" textAnchor="middle" fontSize="15" fontWeight="700" fill="white" fontFamily="var(--font-display)">
              {letters}
            </text>
          </>
        ) : (
          <>
            <circle cx="50" cy="50" r="46" fill="var(--raised)" stroke="var(--muted)" strokeOpacity="0.55" strokeWidth="2" />
            <circle cx="50" cy="50" r="40" fill="none" stroke="var(--muted)" strokeOpacity="0.35" strokeWidth="1.5" strokeDasharray="3 4" />
            <path d="M24 64 40 42l8 10 10-15 18 27Z" fill="none" stroke="var(--muted)" strokeOpacity="0.6" strokeWidth="2" strokeLinejoin="round" />
            <text x="50" y="80" textAnchor="middle" fontSize="15" fontWeight="700" fill="var(--muted)" fillOpacity="0.7" fontFamily="var(--font-display)">
              {letters}
            </text>
          </>
        )}
      </svg>
      {earned && <span className="badge-sheen absolute inset-0 rounded-full" />}
    </span>
  )
}
