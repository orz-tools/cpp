import { describe, expect, it, vi } from 'vitest'
import { HoldingTrainable } from './characterQuery'
import { quickFiltersFor, wrapQueryWithQuickFilter } from './quickFilters'

// cpp-basic 导入时会初始化 localforage，测试环境里没有存储后端
vi.mock('localforage', () => {
  const noop = new Proxy({}, { get: () => () => Promise.resolve(null) })
  return { default: { createInstance: () => noop, dropInstance: () => Promise.resolve() } }
})
vi.mock('./Toaster', () => ({ AppToaster: new Promise(() => {}) }))

const component = {
  quickFilters: { professions: 'contains', rarity: '==', elite: '==' },
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
})
