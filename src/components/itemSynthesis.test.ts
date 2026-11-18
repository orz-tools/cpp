import { describe, expect, it } from 'vitest'
import { synthesisTimes } from './itemSynthesis'

describe('synthesisTimes', () => {
  it('offers a single 1 when not even one is possible', () => {
    expect(synthesisTimes(0, undefined)).toEqual([1])
    expect(synthesisTimes(0, 8)).toEqual([1])
  })

  it('adds the most that is possible in front of the steps under it', () => {
    expect(synthesisTimes(5, undefined)).toEqual([5, 3, 1])
    expect(synthesisTimes(5, 8)).toEqual([5, 3, 1])
    expect(synthesisTimes(1, undefined)).toEqual([1])
  })

  it('does not repeat a step that is the most possible', () => {
    expect(synthesisTimes(24, undefined)).toEqual([24, 12, 6, 3, 1])
    expect(synthesisTimes(3, 2)).toEqual([3, 1])
  })

  it('stops at 24 when crafting costs morale', () => {
    expect(synthesisTimes(30, 8)).toEqual([24, 12, 6, 3, 1])
  })

  it('goes past 24 when crafting is free', () => {
    expect(synthesisTimes(30, undefined)).toEqual([30, 24, 12, 6, 3, 1])
  })
})
