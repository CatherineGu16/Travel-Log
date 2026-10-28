import type { DestinationInput, PlaceInput, PlaceRef, TripInput } from '../lib/travelActions.ts'

type Stop = { place: PlaceRef; startDate?: string | null; endDate?: string | null; note?: string; isMain?: boolean }

/**
 * A trip for tests: a main place first, then stops in order (each can be its own main too).
 * Anything else can be overridden.
 */
export function tripInput(
  opts: Partial<Omit<TripInput, 'destinations'>> & { main?: PlaceRef | PlaceInput; stops?: Stop[]; destinations?: DestinationInput[] } = {},
): TripInput {
  const { main, stops = [], destinations, ...rest } = opts
  const mainRef: PlaceRef | undefined = main && ('placeId' in main || 'place' in main ? main : { place: main })
  const toDestination = (s: Stop, isMain: boolean): DestinationInput => ({
    place: s.place,
    isMain: s.isMain ?? isMain,
    startDate: s.startDate ?? null,
    endDate: s.endDate ?? null,
    note: s.note ?? '',
  })
  return {
    title: 'Trip',
    startDate: '2024',
    endDate: null,
    approximate: false,
    destinations: destinations ?? [...(mainRef ? [toDestination({ place: mainRef }, true)] : []), ...stops.map((s) => toDestination(s, false))],
    companions: [],
    description: '',
    highlights: '',
    rating: null,
    tags: [],
    ...rest,
  }
}
