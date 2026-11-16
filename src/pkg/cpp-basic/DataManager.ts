import localForage from 'localforage'
import { FriendlyError } from '../../components/Err'
import { DataContainerObject, IDataContainer, destroy, getLastCheckedAt, load, reset } from '../dccache'
import { gt } from '../gt'
import { IGame } from './types'

// HACK
void localForage.dropInstance({ name: 'cpp_dm' })
void destroy('reverse1999-hisboundenduty-drops')
void destroy('reverse1999-hisboundenduty-values')
for (const name of [
  'reverse1999-yuanyan3060-zh_CN',
  'reverse1999-enigmaticnebula-en',
  'reverse1999-enigmaticnebula-jp',
  'reverse1999-enigmaticnebula-kr',
  'reverse1999-enigmaticnebula-tw',
  'reverse1999-enigmaticnebula-zh',
  'reverse1999-hisboundenduty-drops-china',
  'reverse1999-hisboundenduty-drops-haiwai',
  'reverse1999-hisboundenduty-values-china',
])
  void destroy(name)
void destroy('arknights-yituliu')
void destroy('arknights-yituliu-values')

/** The data containers one region uses. */
export interface DataSources {
  readonly required: DataContainerObject<any>[]
  readonly absolutelyRequired: DataContainerObject<any>[]
}

export interface DataSnapshot {
  raw: any
  data: any
}

export type ContainerGetter = <T extends object>(obj: DataContainerObject<T>) => IDataContainer<T>

export interface DataManagerState {
  status: 'loading' | 'ready' | 'error'
  /** 0 until the first commit; every commit adds one */
  generation: number
  /** names of the containers being loaded */
  loading: string[]
  /** an operation is running or waiting in the queue */
  updating: boolean
  /** only while status is 'error', that is, when the first load failed */
  error?: Error
}

export interface UpdateOptions {
  force?: boolean
  absolutelyRequiredOnly?: boolean
}

export interface UpdateResult {
  applied: boolean
  notify: boolean
}

/** Returns when the derived data built at this commit goes stale (an event starting or ending), if ever. */
export type CommitHook = () => number | undefined

interface Committed<S extends DataSources, Snap extends DataSnapshot> {
  region: string
  sources: S
  containers: Map<DataContainerObject<any>, IDataContainer>
  snapshot: Snap
}

// setTimeout fires at once for any delay above this
const MAX_TIMEOUT = 2 ** 31 - 1

export abstract class BasicDataManager<
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  G extends IGame,
  S extends DataSources = DataSources,
  Snap extends DataSnapshot = DataSnapshot,
> {
  /** Validates the region and creates its sources without touching this manager; throws for an unknown region. */
  protected abstract createSources(region: string): S
  protected abstract buildSnapshot(sources: S, getContainer: ContainerGetter): Snap

  private committed?: Committed<S, Snap>
  private initRegion?: string
  private state: DataManagerState = { status: 'loading', generation: 0, loading: [], updating: false }
  private readonly listeners = new Set<() => void>()
  private readonly loadingNames = new Set<string>()
  private readonly commitHooks: CommitHook[] = []
  private queue: Promise<unknown> = Promise.resolve()
  private queued = 0
  private expiresAt?: number
  private expiryTimer?: ReturnType<typeof setTimeout>

  public get region(): string | undefined {
    return this.committed?.region
  }

  public get sources(): S {
    return this.committed?.sources as S
  }

  public get raw(): Snap['raw'] {
    return this.committed?.snapshot.raw
  }

  public get data(): Snap['data'] {
    return this.committed?.snapshot.data
  }

  public get<T extends object>(d: DataContainerObject<T>): IDataContainer<T> {
    const container = this.committed?.containers.get(d)
    if (!container) {
      throw new Error(`DataContainerObject ${d.name} not found`)
    }
    return container as IDataContainer<T>
  }

  public getState(): DataManagerState {
    return this.state
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => void this.listeners.delete(listener)
  }

  public onCommit(hook: CommitHook) {
    this.commitHooks.push(hook)
  }

  public init(region: string): Promise<void> {
    this.initRegion = region
    return this.enqueue(() => this.doInit(region))
  }

  public update({ force = false, absolutelyRequiredOnly = false }: UpdateOptions = {}): Promise<UpdateResult> {
    return this.enqueue(() => this.doUpdate(force, absolutelyRequiredOnly, true))
  }

  /** Clears the stored copies of the required containers, then downloads them again. */
  public reset(): Promise<UpdateResult> {
    return this.enqueue(async () => {
      const region = this.committed?.region ?? this.initRegion
      if (region === undefined) throw new Error('DataManager is not initialized')
      for (const x of (this.committed?.sources ?? this.createSources(region)).required) {
        await reset(x)
      }
      return await this.doUpdate(true, false, false)
    })
  }

  public switchRegion(region: string): Promise<boolean> {
    return this.enqueue(async () => {
      const committed = this.committed
      if (!committed) {
        // The first load failed, so there is nothing to keep; start over in the new region.
        if (region === this.initRegion) return false
        const previous = this.initRegion
        this.initRegion = region
        try {
          await this.doInit(region)
        } catch (e) {
          this.initRegion = previous
          throw e
        }
        return true
      }
      if (region === committed.region) return false

      const sources = this.createSources(region)
      const byName = new Map([...committed.containers].map(([obj, container]) => [obj.name, container]))
      const containers = await this.loadContainers(sources.required, undefined, (obj) => byName.get(obj.name))
      this.commit({ region, sources, containers, snapshot: this.buildSnapshot(sources, getter(containers)) })
      return true
    })
  }

  /** Builds the snapshot again from the containers already loaded, for settings the derived data depends on. */
  public rebuild(): Promise<void> {
    return this.enqueue(() => Promise.resolve(this.doRebuild()))
  }

  public checkExpiry(): Promise<void> {
    if (this.expiresAt === undefined) return Promise.resolve()
    if (Date.now() < this.expiresAt) {
      this.armExpiryTimer()
      return Promise.resolve()
    }
    return this.enqueue(() => {
      // An earlier rebuild in the queue may have moved the expiry already.
      if (this.expiresAt !== undefined && Date.now() >= this.expiresAt) this.doRebuild()
      return Promise.resolve()
    })
  }

  private async doInit(region: string) {
    try {
      const sources = this.createSources(region)
      const containers = await this.loadContainers(sources.required, undefined, () => undefined)
      this.commit({ region, sources, containers, snapshot: this.buildSnapshot(sources, getter(containers)) })
    } catch (e) {
      if (!this.committed) this.setState({ status: 'error', error: e as Error })
      throw e
    }
  }

  private async doUpdate(force: boolean, absolutelyRequiredOnly: boolean, useCurrent: boolean): Promise<UpdateResult> {
    const committed = this.committed
    if (!committed) {
      if (this.initRegion === undefined) throw new Error('DataManager is not initialized')
      await this.doInit(this.initRegion)
      return { applied: true, notify: false }
    }

    const targets = absolutelyRequiredOnly ? committed.sources.absolutelyRequired : committed.sources.required
    const changed = new Set<DataContainerObject<any>>()
    const fresh = new Map<DataContainerObject<any>, IDataContainer>()
    await Promise.all(
      targets.map(async (obj) => {
        if (!force && Date.now() - (await getLastCheckedAt(obj)) < obj.autoUpdateThreshold) return
        const previous = committed.containers.get(obj)
        const container = await this.loadContainer(
          obj,
          force,
          () => changed.add(obj),
          useCurrent ? previous : undefined,
        )
        // Downloaded again yet the same (a repo version file can run ahead of its data file): keep the object held,
        // so what is cached against it, such as the item value inputs, stays valid.
        const same =
          !changed.has(obj) &&
          previous?.version.id === container.version.id &&
          previous.version.timestamp === container.version.timestamp
        fresh.set(obj, same ? previous : container)
      }),
    )

    if (changed.size === 0) {
      // Only the version moved. Keep it, or the next check downloads the same content again to compare.
      for (const [obj, container] of fresh) committed.containers.set(obj, container)
      return { applied: false, notify: false }
    }

    let notify = false
    for (const obj of changed) {
      const previous = committed.containers.get(obj)
      if (
        !previous ||
        fresh.get(obj)!.version.timestamp - previous.version.timestamp > obj.autoUpdateNotificationThreshold
      ) {
        notify = true
      }
    }

    const containers = new Map(committed.containers)
    for (const [obj, container] of fresh) containers.set(obj, container)
    this.commit({ ...committed, containers, snapshot: this.buildSnapshot(committed.sources, getter(containers)) })
    return { applied: true, notify }
  }

  private doRebuild() {
    const committed = this.committed
    if (!committed) return
    this.commit({ ...committed, snapshot: this.buildSnapshot(committed.sources, getter(committed.containers)) })
  }

  private async loadContainers(
    objs: DataContainerObject<any>[],
    refresh: boolean | undefined,
    current: (obj: DataContainerObject<any>) => IDataContainer | undefined,
  ) {
    const containers = new Map<DataContainerObject<any>, IDataContainer>()
    await Promise.all(
      objs.map(async (obj) => containers.set(obj, await this.loadContainer(obj, refresh, undefined, current(obj)))),
    )
    return containers
  }

  private async loadContainer(
    obj: DataContainerObject<any>,
    refresh: boolean | undefined,
    onRefreshed: (() => void) | undefined,
    current: IDataContainer | undefined,
  ) {
    this.loadingNames.add(obj.name)
    this.setState({ loading: [...this.loadingNames] })
    try {
      return await load(obj, refresh, onRefreshed, current)
    } catch (e) {
      const realE = e instanceof Error ? e : new Error(e as any)
      const err = new FriendlyError(`Failed to load DataObject ${obj.name}: ${realE.message}`, { cause: e })
      if (realE.stack) err.stack = realE.stack
      ;(err as any).friendly = gt.gettext(`无法加载数据，请检查网络连接/更换网络/使用「加速器」/切换线路。`)
      throw err
    } finally {
      this.loadingNames.delete(obj.name)
      this.setState({ loading: [...this.loadingNames] })
    }
  }

  private commit(next: Committed<S, Snap>) {
    this.committed = next
    this.state = {
      ...this.state,
      status: 'ready',
      generation: this.state.generation + 1,
      error: undefined,
    }

    let expiresAt: number | undefined
    for (const hook of this.commitHooks) {
      try {
        const t = hook()
        if (t !== undefined && Number.isFinite(t) && (expiresAt === undefined || t < expiresAt)) expiresAt = t
      } catch (e) {
        console.error('DataManager commit hook failed', e)
      }
    }
    this.expiresAt = expiresAt
    this.armExpiryTimer()
    this.emit()
  }

  private armExpiryTimer() {
    clearTimeout(this.expiryTimer)
    this.expiryTimer = undefined
    if (this.expiresAt === undefined) return
    this.expiryTimer = setTimeout(
      () => void this.checkExpiry().catch((e) => console.error('DataManager rebuild failed', e)),
      Math.min(Math.max(this.expiresAt - Date.now(), 0), MAX_TIMEOUT),
    )
  }

  private enqueue<T>(op: () => Promise<T>): Promise<T> {
    if (this.queued++ === 0) this.setState({ updating: true })
    const run = this.queue.then(op)
    this.queue = run.then(noop, noop)
    return run.finally(() => {
      if (--this.queued === 0) this.setState({ updating: false })
    })
  }

  private setState(patch: Partial<DataManagerState>) {
    this.state = { ...this.state, ...patch }
    this.emit()
  }

  private emit() {
    for (const listener of this.listeners) listener()
  }
}

function getter(containers: Map<DataContainerObject<any>, IDataContainer>): ContainerGetter {
  return <T extends object>(obj: DataContainerObject<T>) => {
    const container = containers.get(obj)
    if (!container) throw new Error(`DataContainerObject ${obj.name} not found`)
    return container as IDataContainer<T>
  }
}

function noop() {
  //
}
