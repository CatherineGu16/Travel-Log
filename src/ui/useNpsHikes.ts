import { useEffect, useState } from 'react'
import { loadParkHikes, type NpsHike } from '../lib/gazetteer.ts'

/** A park's NPS hikes (loaded on first use): suggestions, and facts for hikes picked from them. */
export function useNpsHikes(parkId: string): NpsHike[] {
  const [all, setAll] = useState<Record<string, NpsHike[]>>({})
  useEffect(() => {
    void loadParkHikes().then(setAll)
  }, [])
  return all[parkId] ?? []
}
