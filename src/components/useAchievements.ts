import { useEffect, useMemo, useState } from 'react'
import { achievementStatus } from '../lib/achievements.ts'
import { loadWorldCities } from '../lib/gazetteer.ts'
import type { TravelData } from '../lib/types.ts'

/** Every achievement's tier and progress, worked out from your trips (continents load in the background). */
export function useAchievements(data: TravelData) {
  const [continents, setContinents] = useState<Record<string, string> | undefined>()
  useEffect(() => {
    void loadWorldCities().then((w) => setContinents(w.continents))
  }, [])
  return useMemo(() => achievementStatus(data, { continents }), [data, continents])
}

