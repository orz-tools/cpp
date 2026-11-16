import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Cpp } from '../Cpp'
import { QueryParam, RootCharacterQuery } from '../pkg/cpp-basic'
import { ListModeAll, ListModeFav, compileQuery, defaultFavQuery } from './characterQuery'
import { remove, saveAs, setFavQuery } from './queryEditor/savedQueries'

// cpp-basic 导入时会初始化 localforage，测试环境里没有存储后端
vi.mock('localforage', () => {
  const noop = new Proxy({}, { get: () => () => Promise.resolve(null) })
  return { default: { createInstance: () => noop, dropInstance: () => Promise.resolve() } }
})

const order: QueryParam['order'] = [['rarity', 'DESC']]

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
    return {}
  }
  public getRootCharacterQuery() {
    return new RootCharacterQuery()
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
  it('keeps the built-in 想看的 query when there is no custom version', () => {
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

  it('uses the custom 想看的 query, and the default again after restoring it', () => {
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

describe('queryParamAtom', () => {
  it('falls back to 全部 when the saved query it points to is gone', () => {
    const cpp = createCpp()
    const id = saveAs(cpp, '六星', {})
    cpp.store.set(cpp.queryParamAtom, (x) => ({ ...x, query: '#*' + id }))
    expect(cpp.store.get(cpp.queryParamAtom).query).toBe('#*' + id)
    remove(cpp, id)
    expect(cpp.store.get(cpp.queryParamAtom).query).toBe(ListModeAll)
  })
})
