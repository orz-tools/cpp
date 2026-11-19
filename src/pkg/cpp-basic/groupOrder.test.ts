import { describe, expect, it } from 'vitest'
import { orderGroups } from './groupOrder'

describe('orderGroups', () => {
  it('keeps the defaults without a groupOrder', () => {
    const defaults = ['a', 'b', 'c']
    expect(orderGroups(defaults, undefined)).toBe(defaults)
  })

  it('follows a groupOrder that lists every group', () => {
    expect(orderGroups(['a', 'b', 'c'], ['c', 'a', 'b'])).toEqual(['c', 'a', 'b'])
  })

  it('puts the groups it leaves out after the listed ones, in default order', () => {
    expect(orderGroups(['a', 'b', 'c'], ['c'])).toEqual(['c', 'a', 'b'])
  })

  it('drops listed groups that are no longer there', () => {
    expect(orderGroups(['a', 'b'], ['x', 'b'])).toEqual(['b', 'a'])
  })
})
