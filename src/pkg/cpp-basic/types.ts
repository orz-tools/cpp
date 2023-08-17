import { BlobImages } from '../blobcache'
import type { FarmModelInternalVar, FarmModelSolutionVar } from './FarmPlanner'
import { IGameAdapter } from './managers'

export interface IGame {
  characterStatus: object
  characterTaskType: unknown
}

export interface Task<G extends IGame> {
  id: string
  charId: string
  type: G['characterTaskType']
  requires: { itemId: string; quantity: number }[]
  depends: Task<G>[]
}

export interface Formula {
  id: string
  itemId: string
  quantity: number
  costs: {
    itemId: string
    quantity: number
  }[]
  tags: string[]
  apCost?: number
}

export interface ExpItem {
  value: Record<string, number>
  indirectStage: {
    itemId: string
    quantity: number
  }[]
}

export interface IItem {
  readonly key: string
  readonly name: string
  readonly icon: BlobImages
  readonly sortId: string
  readonly valueAsAp: number | undefined
  readonly inventoryCategory: string
}

export interface ICharacter {
  readonly key: string
  readonly avatar: BlobImages
  readonly rarity: number
  readonly name: string
  readonly appellation: string
  readonly characterViewExtraClass?: string[]
}

export interface IStageInfo {
  readonly sortKey: string
  readonly id: string
  readonly name: string
  readonly code: string
  readonly zoneId: string
  readonly ap: number
  readonly dropInfo: Record<string, [drops: number, samples: number]>
  readonly sortedDropInfo: [itemId: string, drops: number, samples: number][]
  readonly varRow: { [K in FarmModelSolutionVar | FarmModelInternalVar]?: number }
}

export abstract class BasicStageInfo implements IStageInfo {
  public abstract id: string
  public abstract code: string
  public abstract name: string
  public abstract zoneId: string

  public get sortKey(): string {
    return this.id
  }

  public constructor(protected ga: IGameAdapter<any>) {}

  public dropInfo: Record<string, [drops: number, samples: number]> = {}

  private _ap = 0
  public setAp(ap: number) {
    this._ap = ap
    this.clearCache()
  }
  public get ap(): number {
    return this._ap
  }

  private cachedSortedDropInfo?: [itemId: string, drops: number, samples: number][]
  public get sortedDropInfo(): [itemId: string, drops: number, samples: number][] {
    if (!this.cachedSortedDropInfo) {
      this.cachedSortedDropInfo = this.sortDropInfo(Object.entries(this.dropInfo).map((x) => [x[0], x[1][0], x[1][1]]))
    }
    return this.cachedSortedDropInfo
  }

  public sortDropInfo(
    di: [itemId: string, drops: number, samples: number][],
  ): [itemId: string, drops: number, samples: number][] {
    return di
  }

  private cachedVarRow?: { [K in FarmModelSolutionVar | FarmModelInternalVar]?: number }
  public get varRow(): { [K in FarmModelSolutionVar | FarmModelInternalVar]?: number } {
    if (!this.cachedVarRow) {
      this.cachedVarRow = {}
      const vr = this.cachedVarRow

      vr['ap'] = this._ap
      for (const [itemId, [drops, samples]] of Object.entries(this.dropInfo)) {
        const value = Number.isFinite(samples) ? drops / samples : drops

        const eiv = this.ga.getExpItemValue(itemId)
        if (eiv) {
          vr[`item:${eiv[1]}`] = (vr[`item:${eiv[1]}`] || 0) + value * eiv[0]
        } else {
          vr[`item:${itemId}`] = (vr[`item:${itemId}`] || 0) + value
        }
      }
    }
    return this.cachedVarRow
  }

  private clearCache() {
    this.cachedSortedDropInfo = undefined
    this.cachedVarRow = undefined
  }

  public addDrop(itemId: string, drops: number, samples = Infinity): this {
    if (!this.dropInfo[itemId]) {
      this.dropInfo[itemId] = [drops, samples]
    } else {
      const existing = this.dropInfo[itemId]
      if (Number.isFinite(existing[1]) && Number.isFinite(samples)) {
        existing[0] += drops
        existing[1] += samples
      } else {
        throw new Error('Cannot mix Infinity samples with finity sampels')
      }
    }
    this.clearCache()
    return this
  }
}
