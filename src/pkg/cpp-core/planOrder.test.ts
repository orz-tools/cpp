import { describe, expect, it } from 'vitest'
import { followOrder, moveKeys, stepTarget } from './planOrder'

describe('moveKeys', () => {
  const order = ['a', 'b', 'c', 'd']

  it('moves a key before or after another', () => {
    expect(moveKeys(order, ['d'], { before: 'b' })).toEqual(['a', 'd', 'b', 'c'])
    expect(moveKeys(order, ['a'], { after: 'c' })).toEqual(['b', 'c', 'a', 'd'])
  })

  it('returns the order itself when nothing moves', () => {
    expect(moveKeys(order, ['b'], { before: 'c' })).toBe(order)
    expect(moveKeys(order, ['b'], { after: 'a' })).toBe(order)
    expect(moveKeys(order, ['x'], { before: 'a' })).toBe(order)
    expect(moveKeys(order, ['a'], { after: 'x' })).toBe(order)
    expect(moveKeys(order, ['b'], { before: 'b' })).toBe(order)
  })

  describe('several keys', () => {
    const order = ['a', 'b', 'c', 'd', 'e']

    it('gathers them at the anchor in their order', () => {
      expect(moveKeys(order, ['b', 'd'], { before: 'a' })).toEqual(['b', 'd', 'a', 'c', 'e'])
      expect(moveKeys(order, ['d', 'b'], { after: 'e' })).toEqual(['a', 'c', 'e', 'b', 'd'])
      expect(moveKeys(order, ['b', 'd'], { before: 'c' })).toEqual(['a', 'b', 'd', 'c', 'e'])
    })

    it('returns the order itself when a run lands where it is', () => {
      expect(moveKeys(order, ['b', 'c'], { before: 'd' })).toBe(order)
    })

    it('does not move against an anchor among the keys', () => {
      expect(moveKeys(order, ['b', 'd'], { before: 'b' })).toBe(order)
    })

    it('leaves out keys that are not in the order', () => {
      expect(moveKeys(order, ['x'], { before: 'a' })).toBe(order)
      expect(moveKeys(order, ['b', 'x'], { after: 'd' })).toEqual(['a', 'c', 'd', 'b', 'e'])
    })
  })
})

describe('stepTarget', () => {
  const order = ['a', 'b', 'c', 'd']

  it('targets the neighbours and the ends from the middle', () => {
    expect(stepTarget(order, ['b'], 'first')).toEqual({ before: 'a' })
    expect(stepTarget(order, ['b'], 'up')).toEqual({ before: 'a' })
    expect(stepTarget(order, ['b'], 'down')).toEqual({ after: 'c' })
    expect(stepTarget(order, ['b'], 'last')).toEqual({ after: 'd' })
  })

  it('goes nowhere further up from the head', () => {
    expect(stepTarget(order, ['a'], 'first')).toBeUndefined()
    expect(stepTarget(order, ['a'], 'up')).toBeUndefined()
    expect(stepTarget(order, ['a'], 'down')).toEqual({ after: 'b' })
    expect(stepTarget(order, ['a'], 'last')).toEqual({ after: 'd' })
  })

  it('goes nowhere further down from the tail', () => {
    expect(stepTarget(order, ['d'], 'first')).toEqual({ before: 'a' })
    expect(stepTarget(order, ['d'], 'up')).toEqual({ before: 'c' })
    expect(stepTarget(order, ['d'], 'down')).toBeUndefined()
    expect(stepTarget(order, ['d'], 'last')).toBeUndefined()
  })

  it('has no target for a key that is not in the order', () => {
    expect(stepTarget(order, ['x'], 'up')).toBeUndefined()
  })

  describe('several keys', () => {
    const order = ['a', 'b', 'c', 'd', 'e']

    it('gathers keys apart at the ends or beside their outer neighbours', () => {
      expect(stepTarget(order, ['b', 'd'], 'first')).toEqual({ before: 'a' })
      expect(stepTarget(order, ['b', 'd'], 'up')).toEqual({ before: 'a' })
      expect(stepTarget(order, ['b', 'd'], 'down')).toEqual({ after: 'e' })
      expect(stepTarget(order, ['b', 'd'], 'last')).toEqual({ after: 'e' })
    })

    it('steps a run by one', () => {
      expect(stepTarget(order, ['c', 'd'], 'up')).toEqual({ before: 'b' })
      expect(stepTarget(order, ['c', 'd'], 'down')).toEqual({ after: 'e' })
    })

    it('goes nowhere further up for a run at the head', () => {
      expect(stepTarget(order, ['a', 'b'], 'first')).toBeUndefined()
      expect(stepTarget(order, ['a', 'b'], 'up')).toBeUndefined()
      expect(stepTarget(order, ['a', 'b'], 'down')).toEqual({ after: 'c' })
    })

    it('gathers keys apart at the head even when the first is there already', () => {
      expect(stepTarget(order, ['a', 'c'], 'first')).toEqual({ before: 'b' })
      expect(stepTarget(order, ['a', 'c'], 'up')).toEqual({ before: 'b' })
    })

    it('goes nowhere with every key moving', () => {
      for (const step of ['first', 'up', 'down', 'last'] as const) {
        expect(stepTarget(order, order, step)).toBeUndefined()
      }
    })
  })
})

describe('followOrder', () => {
  const key = (x: string) => x

  it('reorders the items in the order into their own places and leaves the rest', () => {
    expect(followOrder(['c', 'x', 'a'], key, ['a', 'b', 'c'])).toEqual(['a', 'x', 'c'])
  })

  it('returns the items themselves when they already follow the order', () => {
    const items = ['a', 'x', 'c']
    expect(followOrder(items, key, ['a', 'b', 'c'])).toBe(items)
  })
})
