import { Draft } from 'immer'
import { PSTR } from '../gt'
import { BasicDataManager } from './DataManager'
import { QueryParam, RootCharacterQuery } from './queries'
import { ExpItem, Formula, ICharacter, IGame, IItem, IStageInfo, Task } from './types'

export interface PredefinedQuery {
  name: string
  query: QueryParam
  /** 同一指标「全部」版本的 key。菜单里两者合成一行，右边一段进这一版；那一版自己不再单独占一行 */
  all?: string
}

export interface IZoneInfo {
  readonly id: string
  readonly name: string
  readonly categoryId: string
  /** 同一分类内按字符串升序 */
  readonly sortKey: string
}

export interface IStageCategory {
  readonly id: string
  readonly name: string
}

export interface IGameAdapterStatic<G extends IGame = IGame> {
  new (region: any): IGameAdapter<G>
  codename: string
  getRegions(): { id: string; name: string; short?: string }[] | null | undefined
}

export interface IGameAdapter<G extends IGame> {
  getCodename(): string
  getDataManager(): BasicDataManager<G>
  getUserDataAdapter(): IUserDataAdapter<G>
  getRootCharacterQuery(): RootCharacterQuery<any, any>
  getCharacter(key: string): ICharacter
  getItem(key: string): IItem
  getInventoryCategories(): Record<string, PSTR>
  getInventoryPages(): Record<string, string>
  getInventoryItems(page?: string): IItem[]
  getFormulas(): Formula[]
  getExpItems(): Record<string, ExpItem>
  getExpItemValue(key: string): [number, string] | null | undefined
  getStageInfos(): Record<string, IStageInfo>
  getZoneInfos(): Record<string, IZoneInfo>
  /** 按显示顺序 */
  getStageCategories(): IStageCategory[]
  getFormulaTagNames(): Record<string, PSTR>
  getDefaultCharacterQueryOrder(): QueryParam['order']
  getFavCharacterQueryWhere(): QueryParam['where']
  getPredefinedQueries(): Record<string, PredefinedQuery>
  readPreference<K extends keyof G['preferences']>(key: K, storage: Record<string, any>): G['preferences'][K]
  writePreference<K extends keyof G['preferences']>(
    key: K,
    value: G['preferences'][K],
    storage: Record<string, any>,
  ): Record<string, any>
  /** 在 DataManager.init() 之前以当时的游戏偏好调用一次，之后游戏偏好每次变化都调用；返回 true 表示派生数据要 rebuild() */
  applyPreferenceSnapshot?(storage: Record<string, any>): boolean
}

export interface IUserDataAdapter<G extends IGame> {
  getAllCharacterIds(): string[]
  getFrozenEmptyCharacterStatus(): G['characterStatus']
  finishedCharacterStatus(charId: string, current: G['characterStatus']): G['characterStatus']
  rewriteCharacters(
    charId: string,
    current: Draft<G['characterStatus']> | undefined,
    goal: Draft<G['characterStatus']> | undefined,
  ): readonly [current: Draft<G['characterStatus']> | undefined, goal: Draft<G['characterStatus']> | undefined]
  isManuallyTask(task: Task<G>): boolean
  generateTasksForCharacter(charId: string, current: G['characterStatus'], goal: G['characterStatus']): Task<G>[]
  formatTaskAsString(type: G['characterTaskType'], charId: string): string
  completeTask(type: G['characterTaskType'], charId: string, draft: Draft<G['characterStatus']>): void
  compareCharacter(a: ICharacter, b: ICharacter, stA: G['characterStatus'], stB: G['characterStatus']): number
  isAbsentCharacter(c: ICharacter, st: G['characterStatus']): boolean
  isFavCharacter(c: ICharacter, st: G['characterStatus']): boolean
}
