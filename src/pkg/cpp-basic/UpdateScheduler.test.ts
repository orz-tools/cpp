import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { UpdateScheduler } from './UpdateScheduler'

function fakeDocument() {
  const listeners = new Set<() => void>()
  return {
    visibilityState: 'visible' as DocumentVisibilityState,
    addEventListener: (_: string, listener: () => void) => void listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => void listeners.delete(listener),
    show() {
      this.visibilityState = 'visible'
      listeners.forEach((x) => x())
    },
    hide() {
      this.visibilityState = 'hidden'
      listeners.forEach((x) => x())
    },
  }
}

const MINUTE = 60_000

describe('UpdateScheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: 0 })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  function create(check = vi.fn(() => Promise.resolve())) {
    const doc = fakeDocument()
    const onVisible = vi.fn()
    const scheduler = new UpdateScheduler({
      check,
      onVisible,
      interval: 60 * MINUTE,
      minGap: 10 * MINUTE,
      doc: doc as unknown as Document,
    })
    return { scheduler, doc, check, onVisible }
  }

  it('checks once on start', () => {
    const { scheduler, check } = create()
    scheduler.start()
    expect(check).toHaveBeenCalledOnce()
  })

  it('checks on coming back into view only once the gap has passed, and always calls onVisible', async () => {
    const { scheduler, doc, check, onVisible } = create()
    scheduler.start()
    await vi.advanceTimersByTimeAsync(5 * MINUTE)
    doc.hide()
    doc.show()
    expect(onVisible).toHaveBeenCalledOnce()
    expect(check).toHaveBeenCalledOnce()

    await vi.advanceTimersByTimeAsync(5 * MINUTE)
    doc.hide()
    doc.show()
    expect(onVisible).toHaveBeenCalledTimes(2)
    expect(check).toHaveBeenCalledTimes(2)
  })

  it('checks every interval while visible', async () => {
    const { scheduler, doc, check } = create()
    scheduler.start()
    await vi.advanceTimersByTimeAsync(60 * MINUTE)
    expect(check).toHaveBeenCalledTimes(2)

    doc.visibilityState = 'hidden'
    await vi.advanceTimersByTimeAsync(60 * MINUTE)
    expect(check).toHaveBeenCalledTimes(2)
  })

  it('does not start a check while the last one is still running', async () => {
    let finish!: () => void
    const check = vi.fn(() => new Promise<void>((r) => (finish = r)))
    const { scheduler, doc } = create(check)
    scheduler.start()
    await vi.advanceTimersByTimeAsync(60 * MINUTE)
    doc.hide()
    doc.show()
    expect(check).toHaveBeenCalledOnce()

    finish()
    await vi.advanceTimersByTimeAsync(60 * MINUTE)
    expect(check).toHaveBeenCalledTimes(2)
  })

  it('keeps scheduling after a check fails', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const check = vi.fn(() => Promise.reject(new Error('offline')))
    const { scheduler } = create(check)
    scheduler.start()
    await vi.advanceTimersByTimeAsync(60 * MINUTE)
    expect(check).toHaveBeenCalledTimes(2)
    expect(console.warn).toHaveBeenCalled()
  })

  it('stops everything on stop', async () => {
    const { scheduler, doc, check, onVisible } = create()
    scheduler.start()
    scheduler.stop()
    await vi.advanceTimersByTimeAsync(120 * MINUTE)
    doc.hide()
    doc.show()
    expect(check).toHaveBeenCalledOnce()
    expect(onVisible).not.toHaveBeenCalled()
  })
})
