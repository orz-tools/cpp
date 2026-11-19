import { describe, expect, it } from 'vitest'
import { BackGuardEvent, BackGuardState, initialBackGuard, stepBackGuard } from './phoneBack'

/** 依次喂进去，返回每一步的动作和最后的状态 */
function run(events: BackGuardEvent[], from: BackGuardState = initialBackGuard) {
  let state = from
  const steps = events.map((event) => {
    const r = stepBackGuard(state, event)
    state = r.state
    return r.actions
  })
  return { state, steps }
}

const settled = (depth: number): BackGuardEvent => ({ type: 'settled', depth })
const pop = (depth: number): BackGuardEvent => ({ type: 'pop', depth })

describe('stepBackGuard', () => {
  it('pushes a guard for a layer that opens', () => {
    const { state, steps } = run([settled(1)])
    expect(steps).toEqual([[{ type: 'push', count: 1 }]])
    expect(state).toEqual({ guards: 1, expectPops: 0 })
  })

  it('pushes two guards when one tap opens two layers, a window over the dossier', () => {
    const { state, steps } = run([settled(2)])
    expect(steps).toEqual([[{ type: 'push', count: 2 }]])
    expect(state.guards).toBe(2)
  })

  it('does nothing while the number of layers stays the same', () => {
    const { state, steps } = run([settled(1), settled(1), settled(1)])
    expect(steps.slice(1)).toEqual([[], []])
    expect(state).toEqual({ guards: 1, expectPops: 0 })
  })

  it('takes back the guard of a layer closed by its ✕, and swallows the popstate that causes', () => {
    const { state, steps } = run([settled(1), settled(0), pop(0)])
    expect(steps[1]).toEqual([{ type: 'go', delta: -1 }])
    expect(steps[2]).toEqual([])
    expect(state).toEqual({ guards: 0, expectPops: 0 })
  })

  it('takes back two guards at once when two layers close together, swallowing one popstate', () => {
    const { state, steps } = run([settled(2), settled(0), pop(0), pop(0)])
    expect(steps[1]).toEqual([{ type: 'go', delta: -2 }])
    expect(steps[2]).toEqual([])
    // the next one is the user's own, past every guard
    expect(steps[3]).toEqual([])
    expect(state).toEqual({ guards: 0, expectPops: 0 })
  })

  it('closes the top layer on back while a layer is open', () => {
    const { state, steps } = run([settled(2), pop(2), pop(1)])
    expect(steps[1]).toEqual([{ type: 'close' }])
    expect(steps[2]).toEqual([{ type: 'close' }])
    expect(state.guards).toBe(0)
  })

  it('goes on back when its layer was closed by code before the guard was taken back', () => {
    const { state, steps } = run([settled(1), pop(0)])
    expect(steps[1]).toEqual([{ type: 'leave' }])
    expect(state.guards).toBe(0)
  })

  it('pushes no guard again for a layer that would not close', () => {
    const { state, steps } = run([settled(1), pop(1), pop(1)])
    expect(steps[1]).toEqual([{ type: 'close' }])
    expect(steps[2]).toEqual([])
    expect(
      steps
        .slice(1)
        .flat()
        .some((a) => a.type === 'push'),
    ).toBe(false)
    expect(state.guards).toBe(0)
  })

  it('ignores a popstate past its own guards', () => {
    expect(stepBackGuard(initialBackGuard, pop(0))).toEqual({ state: initialBackGuard, actions: [] })
  })
})
