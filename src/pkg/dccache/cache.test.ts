import { beforeEach, describe, expect, it, vi } from 'vitest'
import { load } from './cache'
import { CONTAINER_TYPE, CONTAINER_VERSION, IDataContainer, IDataContainerHeader } from './dc'
import { DataContainerObject } from './obj'

const memory = vi.hoisted(() => new Map<string, unknown>())
const getItem = vi.hoisted(() => vi.fn())

vi.mock('localforage', () => ({
  default: {
    createInstance: () => ({
      getItem: (key: string) => {
        getItem(key)
        return Promise.resolve(memory.get(key))
      },
      setItem: (key: string, value: unknown) => Promise.resolve(void memory.set(key, value)),
      removeItem: (key: string) => Promise.resolve(void memory.delete(key)),
    }),
  },
}))

function container(id: string, data: object): IDataContainer<object> {
  return {
    '@type': CONTAINER_TYPE,
    '@version': CONTAINER_VERSION,
    name: 'test',
    version: { id, text: id, timestamp: 1, sources: [], schema: 1 },
    data,
  }
}

class TestObject extends DataContainerObject<object> {
  public readonly name = 'test'
  public remote = container('v1', { a: 1 })
  public versionFile?: IDataContainerHeader

  public getHeader(): Promise<IDataContainerHeader> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { data, ...header } = this.remote
    return Promise.resolve(this.versionFile ?? header)
  }

  public getData(): Promise<IDataContainer<object>> {
    return Promise.resolve(structuredClone(this.remote))
  }
}

describe('load', () => {
  beforeEach(() => {
    memory.clear()
    getItem.mockClear()
  })

  it('returns the in-memory container itself when the remote version is the same', async () => {
    const obj = new TestObject()
    const current = container('v1', { a: 1 })
    const onRefreshed = vi.fn()
    expect(await load(obj, false, onRefreshed, current)).toBe(current)
    expect(getItem).not.toHaveBeenCalledWith('data:test')
    expect(onRefreshed).not.toHaveBeenCalled()
  })

  it('does not report a refresh when only the version changed', async () => {
    const obj = new TestObject()
    obj.remote = container('v2', { a: 1 })
    const onRefreshed = vi.fn()
    const result = await load(obj, false, onRefreshed, container('v1', { a: 1 }))
    expect(result.version.id).toBe('v2')
    expect(onRefreshed).not.toHaveBeenCalled()
  })

  it('reports a refresh and stores the new data when the content changed', async () => {
    const obj = new TestObject()
    obj.remote = container('v2', { a: 2 })
    const onRefreshed = vi.fn()
    await load(obj, false, onRefreshed, container('v1', { a: 1 }))
    expect(onRefreshed).toHaveBeenCalledOnce()
    expect(memory.get('data:test')).toEqual(container('v2', { a: 2 }))
  })

  it('compares against the stored copy when no in-memory container is given', async () => {
    const obj = new TestObject()
    memory.set('data:test', container('v1', { a: 1 }))
    obj.remote = container('v2', { a: 1 })
    const unchanged = vi.fn()
    await load(obj, false, unchanged)
    expect(getItem).toHaveBeenCalledWith('data:test')
    expect(unchanged).not.toHaveBeenCalled()

    obj.remote = container('v3', { a: 3 })
    const changed = vi.fn()
    await load(obj, false, changed)
    expect(changed).toHaveBeenCalledOnce()
  })

  it('downloads once while the version file names an older version than the data carries', async () => {
    const obj = new TestObject()
    memory.set('data:test', container('older', { a: 0 }))
    obj.remote = container('new', { a: 2 })
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { data, ...behind } = container('old', {})
    obj.versionFile = behind
    const getData = vi.spyOn(obj, 'getData')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    expect((await load(obj, false)).version.id).toBe('new')
    expect((await load(obj, false)).version.id).toBe('new')
    expect((await load(obj)).version.id).toBe('new')
    expect(getData).toHaveBeenCalledOnce()
    expect(warn).toHaveBeenCalledOnce()

    obj.remote = container('newer', { a: 3 })
    obj.versionFile = undefined
    expect((await load(obj, false)).version.id).toBe('newer')
    expect(getData).toHaveBeenCalledTimes(2)
    warn.mockRestore()
  })
})
