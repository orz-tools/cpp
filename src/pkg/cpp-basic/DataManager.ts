import localForage from 'localforage'
import { FriendlyError } from '../../components/Err'
import { DataContainerObject, IDataContainer, destroy, getLastCheckedAt, load, reset } from '../dccache'
import { IGame } from './types'

// HACK
void localForage.dropInstance({ name: 'cpp_dm' })
void destroy('reverse1999-hisboundenduty-drops')
void destroy('reverse1999-hisboundenduty-values')
void destroy('arknights-yituliu')

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export abstract class BasicDataManager<G extends IGame> {
  public readonly dataObjectMap = new Map<DataContainerObject<any>, IDataContainer>()

  public async init() {
    this.initialized = false
    try {
      await this.loadDataObjects()
      this.raw = await this.loadRaw()
      this.data = await this.transform()
    } catch (e) {
      this.error = e as any
      throw e
    }
    this.initialized = true
  }
  public loading = new Set<string>()
  public initialized = false
  public error?: Error

  public abstract transform(): Promise<any>
  public data!: Awaited<ReturnType<this['transform']>>

  public async refresh() {
    let refreshed = false
    await this.loadDataObjects(true, () => (refreshed = true))
    return refreshed
  }

  public abstract loadRaw(refresh?: boolean): Promise<any>
  public raw!: Awaited<ReturnType<this['loadRaw']>>

  public get<T extends object>(d: DataContainerObject<T>): IDataContainer<T> {
    if (!this.dataObjectMap.has(d)) {
      throw new Error(`DataContainerObject ${d.name} not found`)
    }
    return this.dataObjectMap.get(d)! as any as IDataContainer<T>
  }

  public getRequiredDataObjects(): Promise<DataContainerObject<any>[]> {
    return Promise.resolve([])
  }

  protected async loadDataObjects(refresh?: boolean | undefined, onRefreshed?: () => any) {
    const dos = await this.getRequiredDataObjects()
    await Promise.all(
      dos.map(async (x) => {
        this.loading.add(x.name)
        try {
          this.dataObjectMap.set(x, await load(x, refresh, onRefreshed))
        } catch (e) {
          const realE = e instanceof Error ? e : new Error(e as any)
          const err = new FriendlyError(`Failed to load DataObject ${x.name}: ${realE.message}`, { cause: e })
          if (realE.stack) err.stack = realE.stack
          ;(err as any).friendly = `无法加载数据，请检查网络连接/更换网络/使用“加速器”/切换线路。`
          throw err
        } finally {
          this.loading.delete(x.name)
        }
      }),
    )
  }

  public async reset() {
    for (const x of await this.getRequiredDataObjects()) {
      await reset(x)
    }
  }

  public async checkUpdates() {
    const dos = await this.getRequiredDataObjects()
    let showNotification = false
    for (const x of dos) {
      const l = await getLastCheckedAt(x)
      if (Date.now() - l < x.autoUpdateThreshold) {
        continue
      }

      let refreshed = false
      const previous = this.dataObjectMap.get(x)
      const result = await load(x, false, () => (refreshed = true))
      if (refreshed) {
        if (previous) {
          if (result.version.timestamp - previous?.version.timestamp > x.autoUpdateNotificationThreshold) {
            showNotification = true
          }
        } else {
          showNotification = true
        }
      }
    }
    return showNotification
  }
}
