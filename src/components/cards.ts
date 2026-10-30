/**
 * Cards you can press look it: a border and shadow, lifting with a stronger border on hover, the
 * hand cursor and a focus ring. Cards that only show something are flat (no border, no shadow).
 */
export const PRESSABLE_CARD =
  'group cursor-pointer rounded-xl border border-line bg-surface text-left shadow-sm transition hover:-translate-y-px hover:border-primary/50 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:translate-y-0'
export const FLAT_CARD = 'rounded-xl bg-raised/60'
/** Rows in a list you can press (inside a bordered list). */
export const PRESSABLE_ROW = 'group flex w-full cursor-pointer items-center gap-3 px-3 text-left hover:bg-raised focus-visible:bg-raised focus-visible:outline-none'
