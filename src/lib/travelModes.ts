import type { TravelMode } from './types.ts'

/** How you traveled, with the icon and label shown on badges, the form and filters. */
export const TRAVEL_MODES: { id: TravelMode; label: string; icon: string }[] = [
  { id: 'road-trip', label: 'Road trip', icon: '🚗' },
  { id: 'flight', label: 'Flight', icon: '✈️' },
  { id: 'cruise', label: 'Cruise', icon: '🚢' },
]
