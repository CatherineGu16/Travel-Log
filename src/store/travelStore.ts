import type { TravelData } from '../lib/types.ts'
import { emptyData, revertTo } from '../lib/travelActions.ts'
import { mergeData, parseTravelData } from '../lib/travelData.ts'
import type { EditContext } from '../lib/types.ts'
import type { StorageBackend } from './storage.ts'

export type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export interface TravelState {
  status: 'loading' | 'ready' | 'error'
  data: TravelData
  saveState: SaveState
  error: string | null
  /** False when the browser blocked storage and changes only last until the tab closes. */
  durable: boolean
  /** Label of the edit Undo would revert, e.g. "Added Utah 2023". */
  undoLabel: string | null
}

export type Edit = (data: TravelData, ctx: EditContext) => TravelData

const UNDO_LIMIT = 20

export interface TravelStore {
  getState(): TravelState
  subscribe(listener: () => void): () => void
  init(): Promise<void>
  /**
   * Applies an edit right away, then saves in the background. Returns the edit's undo id, or null
   * if the edit was refused (its error is in state.error).
   */
  apply(edit: Edit, label: string): number | null
  /**
   * Reverts the latest edit, or with an id only that edit, and only while nothing has changed
   * since (so an old confirmation's Undo can't revert something else). False if refused.
   */
  undo(id?: number): boolean
  /** Import: merge keeps edits from both; replace swaps in the file as-is. */
  importData(incoming: TravelData, mode: 'merge' | 'replace'): void
  /**
   * Takes in data merged with another device. Clears undo: older snapshots don't know about the
   * incoming records, so undoing past this point would delete them.
   */
  applySynced(data: TravelData): void
  /** Resolves once everything applied so far is on disk. */
  flush(): Promise<void>
}

/** The device's working copy of your data (same design as Watchlist-Tracker's store). */
export function createTravelStore(
  backend: StorageBackend,
  clock: () => Date = () => new Date(),
  newId: () => string = () => crypto.randomUUID(),
): TravelStore {
  const ctx = (): EditContext => ({ now: clock().toISOString(), newId })
  let state: TravelState = {
    status: 'loading',
    data: emptyData(clock().toISOString()),
    saveState: 'idle',
    error: null,
    durable: backend.kind === 'indexeddb',
    undoLabel: null,
  }
  const listeners = new Set<() => void>()
  const undoStack: { id: number; label: string; data: TravelData }[] = []
  let nextUndoId = 1

  const set = (patch: Partial<TravelState>) => {
    state = { ...state, ...patch }
    listeners.forEach((l) => l())
  }

  // Saves run one at a time; a burst of edits ends with one write of the latest data.
  let writing: Promise<void> = Promise.resolve()
  let dirty = false
  const persist = () => {
    dirty = true
    set({ saveState: 'saving' })
    writing = writing.then(async () => {
      if (!dirty) return
      dirty = false
      try {
        await backend.save(state.data)
        if (!dirty) set({ saveState: 'saved', error: null })
      } catch (e) {
        set({ saveState: 'error', error: `Couldn't save on this device: ${(e as Error).message}` })
      }
    })
  }

  const commit = (data: TravelData, label: string | null): number | null => {
    let id: number | null = null
    if (label) {
      id = nextUndoId++
      undoStack.push({ id, label, data: state.data })
      if (undoStack.length > UNDO_LIMIT) undoStack.shift()
    }
    set({ data, undoLabel: undoStack.at(-1)?.label ?? null })
    persist()
    return id
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    async init() {
      try {
        const saved = await backend.load()
        // Checked and brought up to date (e.g. trips saved before destinations) on every load.
        set({ status: 'ready', data: saved ? parseTravelData(saved) : state.data })
      } catch (e) {
        set({ status: 'error', error: `Couldn't read saved data: ${(e as Error).message}` })
      }
    },
    apply(edit, label) {
      if (state.status !== 'ready') return null
      try {
        return commit(edit(state.data, ctx()), label)
      } catch (e) {
        set({ error: (e as Error).message })
        return null
      }
    },
    undo(id) {
      const last = undoStack.at(-1)
      if (!last || (id !== undefined && last.id !== id)) return false
      undoStack.pop()
      commit(revertTo(state.data, last.data, ctx()), null)
      return true
    },
    importData(incoming, mode) {
      commit(mode === 'merge' ? mergeData(state.data, incoming) : incoming, mode === 'merge' ? 'Imported backup' : 'Replaced data from backup')
    },
    applySynced(data) {
      undoStack.length = 0
      commit(data, null)
    },
    flush: () => writing,
  }
}
