import type { LegMode } from '../lib/types.ts'

/** How the Route step's timeline line looks for a leg, like the leg on the map: dashed for flights, dotted when not sure. */
export const railStyle = (mode: LegMode) =>
  mode === 'flight' ? 'border-dashed border-primary' : mode === 'unknown' ? 'border-dotted border-[var(--route)]' : 'border-solid border-[var(--route)]'

/** The width of the timeline's left column, where the line and each stop's marker sit. */
export const RAIL = 'w-10'
