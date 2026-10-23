// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useKeyboardArea } from './useKeyboardInset.ts'

/** A stand-in for window.visualViewport that tests can resize and pan. */
function fakeViewport(height: number) {
  const listeners = new Set<() => void>()
  const vv = {
    height,
    offsetTop: 0,
    addEventListener: (_: string, l: () => void) => listeners.add(l),
    removeEventListener: (_: string, l: () => void) => listeners.delete(l),
    fire() {
      listeners.forEach((l) => l())
    },
  }
  return vv
}

describe('useKeyboardArea', () => {
  it('reports the visible area while the keyboard is open, following iOS panning, and null when closed', () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame'] })
    Object.defineProperty(window, 'innerHeight', { value: 844, configurable: true })
    const vv = fakeViewport(844)
    const { result } = renderHook(() => useKeyboardArea(true, vv as unknown as VisualViewport))
    act(() => void vi.runAllTimers())
    expect(result.current).toBeNull()

    // Keyboard opens; Safari pans the page up 120px to show the focused field.
    Object.assign(vv, { height: 480, offsetTop: 120 })
    act(() => {
      vv.fire()
      vi.runAllTimers()
    })
    expect(result.current).toEqual({ top: 120, height: 480 })

    // Keyboard closes.
    Object.assign(vv, { height: 844, offsetTop: 0 })
    act(() => {
      vv.fire()
      vi.runAllTimers()
    })
    expect(result.current).toBeNull()
    vi.useRealTimers()
  })

  it('ignores small changes like the address bar showing', () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame'] })
    Object.defineProperty(window, 'innerHeight', { value: 844, configurable: true })
    const vv = fakeViewport(790)
    const { result } = renderHook(() => useKeyboardArea(true, vv as unknown as VisualViewport))
    act(() => void vi.runAllTimers())
    expect(result.current).toBeNull()
    vi.useRealTimers()
  })
})
