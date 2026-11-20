import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDeferredCommit, createHoldRepeat, stepQuantity } from './quantityStepper'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('stepQuantity', () => {
  it('steps from what the box holds and stays at or above zero', () => {
    expect(stepQuantity('5', 1)).toBe(6)
    expect(stepQuantity('5', -1)).toBe(4)
    expect(stepQuantity('0', -1)).toBe(0)
    expect(stepQuantity('12.7', 1)).toBe(13)
    expect(stepQuantity('', 1)).toBe(1)
    expect(stepQuantity('abc', -1)).toBe(0)
  })
})

describe('createDeferredCommit', () => {
  it('commits once, a full delay after the last schedule', () => {
    const commit = vi.fn()
    const deferred = createDeferredCommit(600, commit)
    deferred.schedule()
    vi.advanceTimersByTime(300)
    deferred.schedule()
    vi.advanceTimersByTime(300)
    deferred.schedule()
    vi.advanceTimersByTime(599)
    expect(commit).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(commit).toHaveBeenCalledTimes(1)
  })

  it('commits a pending change at once on flush, and not again when the delay ends', () => {
    const commit = vi.fn()
    const deferred = createDeferredCommit(600, commit)
    deferred.schedule()
    vi.advanceTimersByTime(100)
    deferred.flush()
    expect(commit).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(1000)
    expect(commit).toHaveBeenCalledTimes(1)
  })

  it('does nothing on flush without a pending change', () => {
    const commit = vi.fn()
    const deferred = createDeferredCommit(600, commit)
    deferred.flush()
    deferred.schedule()
    vi.advanceTimersByTime(600)
    deferred.flush()
    expect(commit).toHaveBeenCalledTimes(1)
  })

  it('drops a pending change on cancel', () => {
    const commit = vi.fn()
    const deferred = createDeferredCommit(600, commit)
    deferred.schedule()
    deferred.cancel()
    vi.advanceTimersByTime(1000)
    deferred.flush()
    expect(commit).not.toHaveBeenCalled()
  })
})

describe('createHoldRepeat', () => {
  it('steps after the hold delay, then every interval', () => {
    const step = vi.fn()
    const repeat = createHoldRepeat(400, 100, step)
    repeat.start()
    vi.advanceTimersByTime(399)
    expect(step).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(step).toHaveBeenCalledTimes(1)
    // 400, 500, …, 1000
    vi.advanceTimersByTime(600)
    expect(step).toHaveBeenCalledTimes(7)
  })

  it('stops stepping on stop and says it had stepped', () => {
    const step = vi.fn()
    const repeat = createHoldRepeat(400, 100, step)
    repeat.start()
    vi.advanceTimersByTime(1000)
    expect(repeat.stop()).toBe(true)
    vi.advanceTimersByTime(1000)
    expect(step).toHaveBeenCalledTimes(7)
  })

  it('says it had not stepped when released before the hold delay', () => {
    const step = vi.fn()
    const repeat = createHoldRepeat(400, 100, step)
    repeat.start()
    vi.advanceTimersByTime(200)
    expect(repeat.stop()).toBe(false)
    vi.advanceTimersByTime(1000)
    expect(step).not.toHaveBeenCalled()
  })

  it('keeps one set of timers when started twice', () => {
    const step = vi.fn()
    const repeat = createHoldRepeat(400, 100, step)
    repeat.start()
    vi.advanceTimersByTime(500)
    repeat.start()
    vi.advanceTimersByTime(500)
    // 第一次在 400、500 各一下；重新开始后在 900、1000
    expect(step).toHaveBeenCalledTimes(4)
    expect(repeat.stop()).toBe(true)
    vi.advanceTimersByTime(1000)
    expect(step).toHaveBeenCalledTimes(4)
  })
})
