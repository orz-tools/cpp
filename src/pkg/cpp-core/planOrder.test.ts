import { describe, expect, it } from 'vitest'
import { followOrder, moveKey, stepTarget } from './planOrder'

describe('moveKey', () => {
  const order = ['a', 'b', 'c', 'd']

  it('moves a key before or after another', () => {
    expect(moveKey(order, 'd', { before: 'b' })).toEqual(['a', 'd', 'b', 'c'])
    expect(moveKey(order, 'a', { after: 'c' })).toEqual(['b', 'c', 'a', 'd'])
  })

  it('returns the order itself when nothing moves', () => {
    expect(moveKey(order, 'b', { before: 'c' })).toBe(order)
    expect(moveKey(order, 'b', { after: 'a' })).toBe(order)
    expect(moveKey(order, 'x', { before: 'a' })).toBe(order)
    expect(moveKey(order, 'a', { after: 'x' })).toBe(order)
    expect(moveKey(order, 'b', { before: 'b' })).toBe(order)
  })
})

describe('stepTarget', () => {
  const order = ['a', 'b', 'c', 'd']

  it('targets the neighbours and the ends from the middle', () => {
    expect(stepTarget(order, 'b', 'first')).toEqual({ before: 'a' })
    expect(stepTarget(order, 'b', 'up')).toEqual({ before: 'a' })
    expect(stepTarget(order, 'b', 'down')).toEqual({ after: 'c' })
    expect(stepTarget(order, 'b', 'last')).toEqual({ after: 'd' })
  })

  it('goes nowhere further up from the head', () => {
    expect(stepTarget(order, 'a', 'first')).toBeUndefined()
    expect(stepTarget(order, 'a', 'up')).toBeUndefined()
    expect(stepTarget(order, 'a', 'down')).toEqual({ after: 'b' })
    expect(stepTarget(order, 'a', 'last')).toEqual({ after: 'd' })
  })

  it('goes nowhere further down from the tail', () => {
    expect(stepTarget(order, 'd', 'first')).toEqual({ before: 'a' })
    expect(stepTarget(order, 'd', 'up')).toEqual({ before: 'c' })
    expect(stepTarget(order, 'd', 'down')).toBeUndefined()
    expect(stepTarget(order, 'd', 'last')).toBeUndefined()
  })

  it('has no target for a key that is not in the order', () => {
    expect(stepTarget(order, 'x', 'up')).toBeUndefined()
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
