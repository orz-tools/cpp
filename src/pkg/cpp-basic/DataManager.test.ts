import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DataContainerObject, IDataContainer } from '../dccache'
import { BasicDataManager, ContainerGetter, DataSources } from './DataManager'
import { IGame } from './types'

const dc = vi.hoisted(() => ({
  load: vi.fn(),
  reset: vi.fn(() => Promise.resolve()),
  getLastCheckedAt: vi.fn(() => Promise.resolve(0)),
  destroy: vi.fn(() => Promise.resolve()),
}))

vi.mock('../dccache', () => dc)
vi.mock('localforage', () => ({ default: { dropInstance: () => Promise.resolve() } }))

interface Remote {
  id: string
  timestamp: number
  data: unknown
  /** the version file is ahead of the data file, so the same version is downloaded again on every check */
  stale?: boolean
}

let remote: Map<string, Remote | Error>
let gate: Promise<void> | undefined

function container(name: string, r: Remote): IDataContainer<any> {
  return {
    '@type': '@orz/cpp/data-container',
    '@version': 1,
    name,
    version: { id: r.id, text: r.id, timestamp: r.timestamp, sources: [], schema: 1 },
    data: r.data,
  }
}

function obj(
  name: string,
  thresholds: { autoUpdateThreshold?: number; autoUpdateNotificationThreshold?: number } = {},
) {
  return { name, autoUpdateThreshold: 0, autoUpdateNotificationThreshold: 0, ...thresholds } as DataContainerObject<any>
}

// Mirrors dccache: an unchanged version returns the container passed in, changed content reports a refresh.
dc.load.mockImplementation(
  async (o: DataContainerObject<any>, refresh?: boolean, onRefreshed?: () => void, current?: IDataContainer) => {
    if (gate) await gate
    const r = remote.get(o.name)
    if (!r) throw new Error(`no remote ${o.name}`)
    if (r instanceof Error) throw r
    if (current && current.version.id === r.id && !r.stale) return current
    if (current ? JSON.stringify(current.data) !== JSON.stringify(r.data) : refresh !== undefined) onRefreshed?.()
    return container(o.name, r)
  },
)

class TestSources implements DataSources {
  public readonly shared: DataContainerObject<any>
  public readonly local: DataContainerObject<any>

  public constructor(
    public readonly region: string,
    thresholds?: Parameters<typeof obj>[1],
  ) {
    this.shared = obj('shared', thresholds)
    this.local = obj(`local-${region}`, thresholds)
  }

  public get required() {
    return [this.shared, this.local]
  }

  public get absolutelyRequired() {
    return [this.shared]
  }
}

class TestDataManager extends BasicDataManager<IGame, TestSources> {
  public failBuild = false
  public thresholds?: Parameters<typeof obj>[1]

  protected createSources(region: string) {
    if (!['x', 'y'].includes(region)) throw new Error('Invalid game region: ' + region)
    return new TestSources(region, this.thresholds)
  }

  protected buildSnapshot(sources: TestSources, getContainer: ContainerGetter) {
    if (this.failBuild) throw new Error('build failed')
    const raw = { shared: getContainer(sources.shared).data, local: getContainer(sources.local).data }
    return { raw, data: { ...raw } }
  }
}

function setRemote(name: string, id: string, data: unknown, timestamp = 1) {
  remote.set(name, { id, timestamp, data })
}

describe('BasicDataManager', () => {
  beforeEach(() => {
    remote = new Map()
    gate = undefined
    setRemote('shared', 's1', 'S1')
    setRemote('local-x', 'x1', 'X1')
    setRemote('local-y', 'y1', 'Y1')
    dc.load.mockClear()
    dc.getLastCheckedAt.mockImplementation(() => Promise.resolve(0))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('commits the first generation on init', async () => {
    const dm = new TestDataManager()
    const listener = vi.fn()
    dm.subscribe(listener)
    expect(dm.getState()).toMatchObject({ status: 'loading', generation: 0 })
    await dm.init('x')
    expect(dm.getState()).toMatchObject({ status: 'ready', generation: 1, loading: [], updating: false })
    expect(dm.data).toEqual({ shared: 'S1', local: 'X1' })
    expect(dm.region).toBe('x')
    expect(listener).toHaveBeenCalled()
  })

  it('reports a failed init through the state', async () => {
    remote.set('local-x', new Error('offline'))
    const dm = new TestDataManager()
    await expect(dm.init('x')).rejects.toThrow('offline')
    expect(dm.getState().status).toBe('error')
    expect(dm.getState().error?.message).toMatch('offline')
    expect(dm.getState().generation).toBe(0)
  })

  it('commits only when some content changed', async () => {
    const dm = new TestDataManager()
    await dm.init('x')
    const before = dm.data

    expect(await dm.update({})).toEqual({ applied: false, notify: false })
    expect(dm.getState().generation).toBe(1)
    expect(dm.data).toBe(before)

    setRemote('local-x', 'x2', 'X2')
    expect(await dm.update({})).toMatchObject({ applied: true })
    expect(dm.getState().generation).toBe(2)
    expect(dm.data).toEqual({ shared: 'S1', local: 'X2' })
  })

  it('keeps a moved version without committing when the content is the same', async () => {
    const dm = new TestDataManager()
    await dm.init('x')
    setRemote('local-x', 'x2', 'X1')
    expect(await dm.update({})).toEqual({ applied: false, notify: false })
    expect(dm.get(dm.sources.local).version.id).toBe('x2')
    expect(dm.getState().generation).toBe(1)
  })

  it('keeps the container it holds when the same version is downloaded again', async () => {
    const dm = new TestDataManager()
    await dm.init('x')
    const held = dm.get(dm.sources.shared)
    remote.set('shared', { id: 's1', timestamp: 1, data: 'S1', stale: true })
    setRemote('local-x', 'x2', 'X2')
    expect(await dm.update({ force: true })).toMatchObject({ applied: true })
    expect(dm.get(dm.sources.shared)).toBe(held)
  })

  it('notifies only when the new version is newer by more than the threshold', async () => {
    const dm = new TestDataManager()
    dm.thresholds = { autoUpdateNotificationThreshold: 1000 }
    await dm.init('x')

    setRemote('local-x', 'x2', 'X2', 1000)
    expect(await dm.update({})).toEqual({ applied: true, notify: false })

    setRemote('local-x', 'x3', 'X3', 3000)
    expect(await dm.update({})).toEqual({ applied: true, notify: true })
  })

  it('skips containers checked within their threshold unless forced', async () => {
    const dm = new TestDataManager()
    dm.thresholds = { autoUpdateThreshold: 60_000 }
    await dm.init('x')
    dc.getLastCheckedAt.mockImplementation(() => Promise.resolve(Date.now()))
    setRemote('local-x', 'x2', 'X2')
    dc.load.mockClear()

    expect(await dm.update({})).toEqual({ applied: false, notify: false })
    expect(dc.load).not.toHaveBeenCalled()

    expect(await dm.update({ force: true })).toMatchObject({ applied: true })
    expect(dc.load).toHaveBeenCalledTimes(2)
  })

  it('keeps the committed snapshot when building a new one throws', async () => {
    const dm = new TestDataManager()
    await dm.init('x')
    const before = dm.data
    setRemote('local-x', 'x2', 'X2')
    dm.failBuild = true
    await expect(dm.update({ force: true })).rejects.toThrow('build failed')
    expect(dm.data).toBe(before)
    expect(dm.get(dm.sources.local).version.id).toBe('x1')
    expect(dm.getState()).toMatchObject({ status: 'ready', generation: 1, updating: false })
  })

  it('runs the init again on an update after the first load failed', async () => {
    remote.set('local-x', new Error('offline'))
    const dm = new TestDataManager()
    await expect(dm.init('x')).rejects.toThrow()
    setRemote('local-x', 'x1', 'X1')
    expect(await dm.update({ force: true })).toEqual({ applied: true, notify: false })
    expect(dm.getState()).toMatchObject({ status: 'ready', generation: 1, error: undefined })
  })

  it('runs operations one after another in the order they were started', async () => {
    const dm = new TestDataManager()
    await dm.init('x')
    setRemote('shared', 's2', 'S2')
    const order: string[] = []
    const update = dm.update({ force: true }).then(() => order.push(`update ${dm.getState().generation}`))
    const switched = dm.switchRegion('y').then(() => order.push(`switch ${dm.getState().generation}`))
    expect(dm.getState().updating).toBe(true)
    await Promise.all([update, switched])
    expect(order).toEqual(['update 2', 'switch 3'])
    expect(dm.data).toEqual({ shared: 'S2', local: 'Y1' })
    expect(dm.getState().updating).toBe(false)
  })

  it('switches regions in one commit and reuses same-named containers', async () => {
    const dm = new TestDataManager()
    await dm.init('x')
    const oldLocal = dm.sources.local
    const oldShared = dm.get(dm.sources.shared)

    let open!: () => void
    gate = new Promise((r) => (open = r))
    const switched = dm.switchRegion('y')
    await Promise.resolve()
    expect(dm.region).toBe('x')
    expect(dm.get(oldLocal).data).toBe('X1')
    open()
    expect(await switched).toBe(true)

    expect(dm.region).toBe('y')
    expect(dm.data).toEqual({ shared: 'S1', local: 'Y1' })
    expect(dm.get(dm.sources.shared)).toBe(oldShared)
    expect(() => dm.get(oldLocal)).toThrow()
    expect(await dm.switchRegion('y')).toBe(false)
  })

  it('keeps everything when a region switch fails', async () => {
    const dm = new TestDataManager()
    await dm.init('x')
    const sources = dm.sources
    remote.set('local-y', new Error('offline'))
    await expect(dm.switchRegion('y')).rejects.toThrow('offline')
    await expect(dm.switchRegion('z')).rejects.toThrow('Invalid game region')
    expect(dm.region).toBe('x')
    expect(dm.sources).toBe(sources)
    expect(dm.getState()).toMatchObject({ status: 'ready', generation: 1 })
  })

  it('rebuilds only after the first commit', async () => {
    const dm = new TestDataManager()
    await dm.rebuild()
    expect(dm.getState().generation).toBe(0)
    await dm.init('x')
    const before = dm.data
    await dm.rebuild()
    expect(dm.getState().generation).toBe(2)
    expect(dm.data).not.toBe(before)
    expect(dm.data).toEqual(before)
  })

  it('rebuilds when the derived data from a commit expires', async () => {
    vi.useFakeTimers({ now: 0 })
    const dm = new TestDataManager()
    let expiresAt: number | undefined = 1000
    dm.onCommit(() => expiresAt)
    await dm.init('x')
    expiresAt = undefined

    await vi.advanceTimersByTimeAsync(999)
    expect(dm.getState().generation).toBe(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(dm.getState().generation).toBe(2)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('sets the expiry timer to the longest delay setTimeout takes and arms it again when it fires early', async () => {
    vi.useFakeTimers({ now: 0 })
    const max = 2 ** 31 - 1
    const dm = new TestDataManager()
    let expiresAt: number | undefined = max + 5000
    dm.onCommit(() => expiresAt)
    await dm.init('x')
    expiresAt = undefined

    await vi.advanceTimersByTimeAsync(max)
    expect(dm.getState().generation).toBe(1)
    expect(vi.getTimerCount()).toBe(1)
    await vi.advanceTimersByTimeAsync(5000)
    expect(dm.getState().generation).toBe(2)
  })
})
