import type { CppData_ArknightsPrtsSkins } from '../cpp-data-schemas/arknights-prts-skins'
import {
  DataContainerObject,
  IDataContainer,
  getLastCheckedAt as dccacheGetLastCheckedAt,
  load as dccacheLoad,
} from '../dccache'
import type { ArknightsPrtsSkinsObject } from './DataObjects'

export type PrtsSkinsData = CppData_ArknightsPrtsSkins

export interface PrtsSkinsLoaderDeps {
  load: <T extends object>(obj: DataContainerObject<T>, refresh?: boolean) => Promise<IDataContainer<T>>
  getLastCheckedAt: (obj: DataContainerObject<any>) => Promise<number>
  now: () => number
}

const defaultDeps: PrtsSkinsLoaderDeps = {
  load: (obj, refresh) => dccacheLoad(obj, refresh),
  getLastCheckedAt: dccacheGetLastCheckedAt,
  now: () => Date.now(),
}

/**
 * One download per session, shared by the panel, its window and every dossier. The stored copy serves as it is until it
 * was last checked longer ago than the object's autoUpdateThreshold; then the repo is asked once, and a failed check
 * keeps the copy in hand. Only when nothing is stored and the download fails does the promise reject; it is forgotten
 * then, so that 重试 downloads again.
 */
export class PrtsSkinsLoader {
  private cached?: { name: string; promise: Promise<PrtsSkinsData> }

  public constructor(private readonly deps: PrtsSkinsLoaderDeps = defaultDeps) {}

  public get(obj: ArknightsPrtsSkinsObject): Promise<PrtsSkinsData> {
    if (this.cached?.name === obj.name) return this.cached.promise
    const promise = this.loadOnce(obj)
    const entry = { name: obj.name, promise }
    this.cached = entry
    promise.catch(() => {
      if (this.cached === entry) this.cached = undefined
    })
    return promise
  }

  private async loadOnce(obj: ArknightsPrtsSkinsObject) {
    const { load, getLastCheckedAt, now } = this.deps
    const stored = await load(obj)
    if (now() - (await getLastCheckedAt(obj)) <= obj.autoUpdateThreshold) return stored.data
    try {
      return (await load(obj, false)).data
    } catch (e) {
      console.warn('Failed to check arknights-prts-skins for an update; keeping the stored copy.', e)
      return stored.data
    }
  }
}
