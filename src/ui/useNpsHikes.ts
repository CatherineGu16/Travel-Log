import { useEffect, useMemo, useState } from 'react'
import { loadAddedHikes, type AddedHikes } from '../lib/addedHikes.ts'
import { loadParkHikes, type NpsHike } from '../lib/gazetteer.ts'
import { addedAsHike, loadPublicHikeEdits, shownHikes, type PublicHikeEdits, type ShownHike } from '../lib/hikeEdits.ts'
import type { TravelData } from '../lib/types.ts'

/**
 * A park's NPS hikes as shown: with the public corrections in this build and your own (which show
 * at once). Includes hidden ones, flagged, so a hike you did still has its facts.
 */
export function useNpsHikes(parkId: string, data: TravelData): ShownHike[] {
  const [all, setAll] = useState<Record<string, NpsHike[]>>({})
  const [published, setPublished] = useState<PublicHikeEdits>({})
  useEffect(() => {
    void loadParkHikes().then(setAll)
    void loadPublicHikeEdits().then(setPublished)
  }, [])
  const mine = useMemo(() => data.hikeEdits.filter((e) => e.parkId === parkId), [data.hikeEdits, parkId])
  return useMemo(() => shownHikes(all[parkId] ?? [], published[parkId], mine), [all, published, parkId, mine])
}

/**
 * A park's hikes that people added (the shared list), as shown: with corrections, like NPS hikes
 * (renamed, given a distance, or hidden from the suggestions). Includes hidden ones, flagged.
 */
export function useAddedHikes(parkId: string, data: TravelData): ShownHike[] {
  const [added, setAdded] = useState<AddedHikes>({})
  const [published, setPublished] = useState<PublicHikeEdits>({})
  useEffect(() => {
    void loadAddedHikes().then(setAdded)
    void loadPublicHikeEdits().then(setPublished)
  }, [])
  const mine = useMemo(() => data.hikeEdits.filter((e) => e.parkId === parkId), [data.hikeEdits, parkId])
  return useMemo(() => shownHikes((added[parkId] ?? []).map((h) => addedAsHike(h.name)), published[parkId], mine), [added, published, parkId, mine])
}
