import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Cpp } from '../Cpp'
import { PredefinedQuery, QueryParam, RootCharacterQuery } from '../pkg/cpp-basic'
import {
  HoldingAbsent,
  HoldingTrainable,
  ListModeAll,
  ListModeFav,
  compileQuery,
  defaultFavQuery,
  holdingAssertion,
} from './characterQuery'
import { remove, saveAs, setFavQuery, setViewColumnWidth } from './queryEditor/savedQueries'

// cpp-basic 导入时会初始化 localforage，测试环境里没有存储后端
vi.mock('localforage', () => {
  const noop = new Proxy({}, { get: () => () => Promise.resolve(null) })
  return { default: { createInstance: () => noop, dropInstance: () => Promise.resolve() } }
})

// Cpp 导入时会创建 toaster，测试环境里没有 document
vi.mock('./Toaster', () => ({ AppToaster: new Promise(() => {}) }))

const order: QueryParam['order'] = [['rarity', 'DESC']]

const presets: Record<string, PredefinedQuery> = {
  cost: {
    name: '成本',
    group: 'cost',
    segments: [{ key: 'cost.all', label: '全部', title: '全部' }],
    query: { select: ['a', 'b'], widths: { b: 60 } },
  },
  'cost.all': { name: '成本（全部）', group: 'cost', query: { select: ['a', 'b'], widths: { b: 60 } } },
  other: { name: '别的', group: 'cost', query: { select: ['a'] } },
}

class StubAdapter {
  public static getRegions() {
    return []
  }
  public getCodename() {
    return 'stub'
  }
  public getDefaultCharacterQueryOrder() {
    return order
  }
  public getFavCharacterQueryWhere(): QueryParam['where'] {
    return { _: 'field', field: 'elite', op: '<', operand: 2 }
  }
  public getPredefinedQueries() {
    return presets
  }
  public getPredefinedQueryGroups() {
    return []
  }
  public getReplacedPredefinedQueries() {
    return { 'cost.usable': 'cost' }
  }
  public getRootCharacterQuery() {
    return new RootCharacterQuery()
  }
  public getDataManager() {
    return {
      region: undefined,
      getState: () => ({ status: 'loading', generation: 0, loading: [], updating: false }),
      subscribe: () => () => {},
    }
  }
}

function createCpp() {
  return new Cpp<any>('stub_', 'stub', new StubAdapter() as any, {} as any)
}

beforeEach(() => {
  const storage = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => void storage.set(k, v),
    removeItem: (k: string) => void storage.delete(k),
  })
  vi.stubGlobal('crypto', { randomUUID: () => Math.random().toString(36).slice(2) })
})

describe('compileQuery', () => {
  it('keeps the built-in 常看 query when there is no custom version', () => {
    const cpp = createCpp()
    expect(cpp.store.get(cpp.atoms.atoms.dataAtom).savedQueries).toEqual([])
    expect(compileQuery(ListModeFav, cpp)).toEqual({
      where: {
        _: '||',
        operand: [
          { _: 'field', field: 'goal', op: '==', operand: true },
          {
            _: '&&',
            operand: [
              { _: 'field', field: 'elite', op: '<', operand: 2 },
              { _: 'field', field: 'finished', op: '==', operand: false },
            ],
          },
        ],
      },
      order,
    })
  })

  it('uses the custom 常看 query, and the default again after restoring it', () => {
    const cpp = createCpp()
    const custom: QueryParam = { where: { _: 'field', field: 'rarity', op: '==', operand: 6 } }
    setFavQuery(cpp, custom)
    expect(compileQuery(ListModeFav, cpp)).toEqual({ ...custom, order })
    setFavQuery(cpp, undefined)
    expect(compileQuery(ListModeFav, cpp)).toEqual(defaultFavQuery(cpp))
  })

  it('resolves a saved query, and throws once it is deleted', () => {
    const cpp = createCpp()
    const query: QueryParam = { where: { _: 'field', field: 'rarity', op: '==', operand: 6 }, order: [] }
    const id = saveAs(cpp, '六星', query)
    expect(compileQuery('#*' + id, cpp)).toEqual(query)
    remove(cpp, id)
    expect(() => compileQuery('#*' + id, cpp)).toThrow('Saved query not found')
  })
})

describe('setViewColumnWidth', () => {
  it('lays a resized preset column over the preset, on every version of its row', () => {
    const cpp = createCpp()
    setViewColumnWidth(cpp, '#?cost.all', 'a', 120)
    expect(cpp.store.get(cpp.atoms.atoms.dataAtom).presetWidths).toEqual({ cost: { a: 120 } })
    expect(compileQuery('#?cost', cpp)).toEqual({ select: ['a', 'b'], widths: { a: 120, b: 60 } })
    expect(compileQuery('#?cost.all', cpp).widths).toEqual({ a: 120, b: 60 })
    expect(compileQuery('#?other', cpp)).toBe(presets.other.query)
  })

  it('forgets a preset once its last resized column is reset', () => {
    const cpp = createCpp()
    setViewColumnWidth(cpp, '#?cost', 'a', 120)
    setViewColumnWidth(cpp, '#?other', 'a', 80)
    setViewColumnWidth(cpp, '#?cost', 'a', undefined)
    expect(cpp.store.get(cpp.atoms.atoms.dataAtom).presetWidths).toEqual({ other: { a: 80 } })
    expect(compileQuery('#?cost', cpp)).toBe(presets.cost.query)
    setViewColumnWidth(cpp, '#?other', 'a', undefined)
    expect(cpp.store.get(cpp.atoms.atoms.dataAtom)).not.toHaveProperty('presetWidths')
  })

  it('writes a saved view back into its own query', () => {
    const cpp = createCpp()
    const id = saveAs(cpp, '六星', { select: ['a'] })
    setViewColumnWidth(cpp, '#*' + id, 'a', 90)
    expect(compileQuery('#*' + id, cpp)).toEqual({ select: ['a'], widths: { a: 90 }, order })
    setViewColumnWidth(cpp, '#*' + id, 'a', undefined)
    expect(cpp.store.get(cpp.atoms.atoms.dataAtom).savedQueries[0].query).toEqual({ select: ['a'] })
  })

  it('leaves the undo history alone', () => {
    const cpp = createCpp()
    const { dataAtom, undoCounterAtom } = cpp.atoms.atoms
    const id = saveAs(cpp, '六星', { select: ['a'] })
    setViewColumnWidth(cpp, '#*' + id, 'a', 90)
    setViewColumnWidth(cpp, '#?cost', 'a', 120)
    expect(cpp.store.get(undoCounterAtom)).toBe(1)
    cpp.store.set(dataAtom, 'undo')
    expect(cpp.store.get(dataAtom).savedQueries).toEqual([])
    expect(cpp.store.get(dataAtom).presetWidths).toEqual({ cost: { a: 120 } })
  })

  it('writes the customized 常看 back, and leaves the built-in one as it is', () => {
    const cpp = createCpp()
    setViewColumnWidth(cpp, ListModeFav, 'a', 90)
    expect(cpp.store.get(cpp.atoms.atoms.dataAtom).favQuery).toBeUndefined()
    setFavQuery(cpp, { select: ['a'] })
    setViewColumnWidth(cpp, ListModeFav, 'a', 90)
    expect(cpp.store.get(cpp.atoms.atoms.dataAtom).favQuery).toEqual({ select: ['a'], widths: { a: 90 } })
  })
})

describe('queryParamAtom', () => {
  it('falls back to 全部 when the saved query it points to is gone', () => {
    const cpp = createCpp()
    const id = saveAs(cpp, '六星', {})
    cpp.store.set(cpp.queryParamAtom, (x) => ({ ...x, query: '#*' + id }))
    expect(cpp.store.get(cpp.queryParamAtom).query).toBe('#*' + id)
    remove(cpp, id)
    expect(cpp.store.get(cpp.queryParamAtom).query).toBe(ListModeAll)
  })

  it('turns the retired 缺席 view into 全部 with the 缺席 quick filter, keeping the other quick filters', () => {
    localStorage.setItem(
      'cpp[stub]query_param',
      JSON.stringify({ v: 1, query: '#!absent', search: '', quick: { rarity: 6 }, source: '#!absent' }),
    )
    const cpp = createCpp()
    const param = cpp.store.get(cpp.queryParamAtom)
    expect(param.query).toBe(ListModeAll)
    expect(param.quick).toEqual({ rarity: 6, holding: [HoldingAbsent] })
    expect(param.source).toBeUndefined()
  })

  it('opens the preset that replaced a stored one, keeping the search and quick filters', () => {
    localStorage.setItem(
      'cpp[stub]query_param',
      JSON.stringify({ v: 1, query: '#?cost.usable', search: '能天使', quick: { rarity: 6 } }),
    )
    const cpp = createCpp()
    expect(cpp.store.get(cpp.queryParamAtom)).toMatchObject({ query: '#?cost', search: '能天使', quick: { rarity: 6 } })
    cpp.store.set(cpp.queryParamAtom, (x) => ({ ...x, query: '#?cost.all' }))
    expect(cpp.store.get(cpp.queryParamAtom).query).toBe('#?cost.all')
  })
})

describe('holdingAssertion', () => {
  const trainable = {
    _: '&&',
    operand: [
      { _: 'field', field: 'own', op: '==', operand: true },
      { _: 'field', field: 'finished', op: '==', operand: false },
    ],
  }
  const absent = { _: 'field', field: 'own', op: '==', operand: false }

  it('adds no condition when neither is chosen', () => {
    expect(holdingAssertion(undefined)).toBeUndefined()
    expect(holdingAssertion([])).toBeUndefined()
    expect(holdingAssertion(['unknown'])).toBeUndefined()
    expect(holdingAssertion('absent')).toBeUndefined()
  })

  it('uses the one chosen condition as it is', () => {
    expect(holdingAssertion([HoldingTrainable])).toEqual(trainable)
    expect(holdingAssertion([HoldingAbsent])).toEqual(absent)
  })

  it('takes the union when both are chosen, which leaves out only the finished operators', () => {
    expect(holdingAssertion([HoldingTrainable, HoldingAbsent])).toEqual({ _: '||', operand: [trainable, absent] })
  })
})
