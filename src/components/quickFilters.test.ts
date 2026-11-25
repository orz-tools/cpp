import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Assertion } from '../pkg/cpp-basic'
import { HoldingTrainable } from './characterQuery'
import { quickFiltersFor, wrapQueryWithQuickFilter } from './quickFilters'

// cpp-basic 导入时会初始化 localforage，测试环境里没有存储后端
vi.mock('localforage', () => {
  const noop = new Proxy({}, { get: () => () => Promise.resolve(null) })
  return { default: { createInstance: () => noop, dropInstance: () => Promise.resolve() } }
})
vi.mock('./Toaster', () => ({ AppToaster: new Promise(() => {}) }))

const tagged = vi.fn((value: unknown): Assertion | undefined =>
  value === 'none' ? undefined : { _: 'field', field: 'tags', op: 'contains', operand: value },
)

const component = {
  quickFilters: { professions: 'contains', rarity: '==', elite: '==', tagged },
  quickFiltersByJoin: { building: { 'building.room': '==', rarity: '==' } },
}

describe('quickFiltersFor', () => {
  it('takes the set of the join the query expands', () => {
    expect(quickFiltersFor(component, 'building')).toBe(component.quickFiltersByJoin.building)
  })

  it('takes the usual set without a join, or for a join that has none of its own', () => {
    expect(quickFiltersFor(component, undefined)).toBe(component.quickFilters)
    expect(quickFiltersFor(component, null)).toBe(component.quickFilters)
    expect(quickFiltersFor(component, 'skill')).toBe(component.quickFilters)
    expect(quickFiltersFor(component, 'toString')).toBe(component.quickFilters)
  })
})

describe('wrapQueryWithQuickFilter', () => {
  it('leaves out the values of another set, and keeps holding', () => {
    const quick = { professions: 'WARRIOR', 'building.room': 'TRADING', holding: [HoldingTrainable] }
    const wrapped = wrapQueryWithQuickFilter({ join: 'building' }, quick, quickFiltersFor(component, 'building'))
    expect(wrapped.where).toEqual({
      _: '&&',
      operand: [
        {
          _: '&&',
          operand: [
            { _: 'field', field: 'own', op: '==', operand: true },
            { _: 'field', field: 'finished', op: '==', operand: false },
          ],
        },
        { _: 'field', field: 'building.room', op: '==', operand: 'TRADING' },
      ],
    })
  })

  it('applies the value again under the set it belongs to', () => {
    const quick = { professions: 'WARRIOR', 'building.room': 'TRADING' }
    expect(wrapQueryWithQuickFilter({}, quick, quickFiltersFor(component, undefined)).where).toEqual({
      _: '&&',
      operand: [{ _: 'field', field: 'professions', op: 'contains', operand: 'WARRIOR' }],
    })
  })

  describe('a function entry', () => {
    beforeEach(() => tagged.mockClear())

    it('builds its condition from the value in quick, after the view’s own', () => {
      const where = { _: 'field' as const, field: 'own', op: '==', operand: true }
      const wrapped = wrapQueryWithQuickFilter({ where }, { tagged: 'x' }, quickFiltersFor(component, undefined))
      expect(tagged).toHaveBeenCalledWith('x')
      expect(wrapped.where).toEqual({
        _: '&&',
        operand: [where, { _: 'field', field: 'tags', op: 'contains', operand: 'x' }],
      })
    })

    it('adds nothing when it returns undefined', () => {
      const query = { join: 'skill' }
      expect(wrapQueryWithQuickFilter(query, { tagged: 'none' }, quickFiltersFor(component, undefined))).toBe(query)
    })

    it('is not called under a set it is not in', () => {
      const quick = { tagged: 'x', 'building.room': 'TRADING' }
      expect(wrapQueryWithQuickFilter({}, quick, quickFiltersFor(component, 'building')).where).toEqual({
        _: '&&',
        operand: [{ _: 'field', field: 'building.room', op: '==', operand: 'TRADING' }],
      })
      expect(tagged).not.toHaveBeenCalled()
    })

    it('goes with holding as before', () => {
      const wrapped = wrapQueryWithQuickFilter(
        {},
        { holding: [HoldingTrainable], tagged: 'x' },
        quickFiltersFor(component, undefined),
      )
      expect(wrapped.where).toMatchObject({
        _: '&&',
        operand: [{ _: '&&' }, { _: 'field', field: 'tags', op: 'contains', operand: 'x' }],
      })
    })
  })
})
