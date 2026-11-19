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

function container(id: string, data: object, schema = 1): IDataContainer<object> {
  return {
    '@type': CONTAINER_TYPE,
    '@version': CONTAINER_VERSION,
    name: 'test',
    version: { id, text: id, timestamp: 1, sources: [], schema },
    data,
  }
}

function header(c: IDataContainer<object>): IDataContainerHeader {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { data, ...h } = c
  return h
}

/** What is stored for the container: the copy, and the meta naming its version. */
function stored() {
  return { data: memory.get('data:test'), meta: memory.get('meta:test') }
}

class TestObject extends DataContainerObject<object> {
  public readonly name = 'test'
  public remote = container('v1', { a: 1 })
  public versionFile?: IDataContainerHeader
  public headerError?: Error
  public dataError?: Error

  public getHeader(): Promise<IDataContainerHeader> {
    if (this.headerError) return Promise.reject(this.headerError)
    return Promise.resolve(this.versionFile ?? header(this.remote))
  }

  public getData(): Promise<IDataContainer<object>> {
    if (this.dataError) return Promise.reject(this.dataError)
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

  it('leaves the copy and the meta alone when the download fails, and serves the copy offline', async () => {
    const obj = new TestObject()
    memory.set('data:test', container('v1', { a: 1 }))
    memory.set('meta:test', { lastCheckedAt: 5, header: header(container('v1', { a: 1 })) })
    const before = structuredClone(stored())
    obj.remote = container('v2', { a: 2 })
    obj.dataError = new Error('offline')

    await expect(load(obj, false)).rejects.toThrow('offline')
    expect(stored()).toEqual(before)

    obj.headerError = new Error('offline')
    expect(await load(obj)).toEqual(container('v1', { a: 1 }))
    expect(stored()).toEqual(before)
  })

  it('serves a stored copy the meta does not name without asking the repo, and makes the meta name it', async () => {
    const obj = new TestObject()
    memory.set('data:test', container('v1', { a: 1 }))
    memory.set('meta:test', { lastCheckedAt: 5, header: header(container('v2', { a: 2 })) })
    obj.headerError = new Error('offline')
    const getHeader = vi.spyOn(obj, 'getHeader')

    expect(await load(obj)).toEqual(container('v1', { a: 1 }))
    expect(getHeader).not.toHaveBeenCalled()
    expect(memory.get('meta:test')).toEqual({ lastCheckedAt: 0, header: header(container('v1', {})) })
  })

  it('serves a stored copy without a meta, and writes one for it', async () => {
    const obj = new TestObject()
    memory.set('data:test', container('v1', { a: 1 }))
    obj.headerError = new Error('offline')

    expect(await load(obj)).toEqual(container('v1', { a: 1 }))
    expect(memory.get('meta:test')).toMatchObject({ lastCheckedAt: 0, header: { version: { id: 'v1' } } })
  })

  it('serves the in-memory container without reading or changing the meta', async () => {
    const obj = new TestObject()
    const meta = { lastCheckedAt: 5, header: header(container('v2', { a: 2 })) }
    memory.set('meta:test', meta)
    obj.headerError = new Error('offline')
    const current = container('v1', { a: 1 })

    expect(await load(obj, undefined, undefined, current)).toBe(current)
    expect(getItem).not.toHaveBeenCalled()
    expect(memory.get('meta:test')).toBe(meta)
  })

  it('throws offline when there is no copy in hand', async () => {
    const obj = new TestObject()
    obj.headerError = new Error('offline')
    await expect(load(obj)).rejects.toThrow('offline')
    expect(stored()).toEqual({ data: undefined, meta: undefined })
  })

  it('asks the repo for a stored copy below the required schema, forcing past the version file it names', async () => {
    const obj = new TestObject()
    obj.requiredSchema = 2
    memory.set('data:test', container('v1', { a: 1 }))
    obj.headerError = new Error('offline')
    await expect(load(obj)).rejects.toThrow('offline')

    obj.headerError = undefined
    obj.remote = container('v2', { a: 2 }, 2)
    const getHeader = vi.spyOn(obj, 'getHeader')
    expect(await load(obj)).toEqual(container('v2', { a: 2 }, 2))
    expect(getHeader).toHaveBeenLastCalledWith(undefined)

    memory.set('data:test', container('v1', { a: 1 }))
    memory.set('meta:test', { lastCheckedAt: 5, header: header(container('v1', {})) })
    expect(await load(obj)).toEqual(container('v2', { a: 2 }, 2))
    expect(getHeader).toHaveBeenLastCalledWith(true)
  })

  it('does not store a download that fails verification', async () => {
    const obj = new TestObject()
    obj.requiredSchema = 2
    memory.set('data:test', container('v1', { a: 1 }, 2))
    memory.set('meta:test', { lastCheckedAt: 5, header: header(container('v1', {}, 2)) })
    const before = structuredClone(stored())
    obj.versionFile = header(container('v2', {}, 2))
    obj.remote = container('v2', { a: 2 }, 1)

    await expect(load(obj, false)).rejects.toThrow('schema not supported')
    expect(stored()).toEqual(before)
  })
})
