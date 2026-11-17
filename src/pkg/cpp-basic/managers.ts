import { Draft } from 'immer'
import { PSTR } from '../gt'
import { BasicDataManager } from './DataManager'
import { QueryParam, RootCharacterQuery } from './queries'
import { ExpItem, Formula, ICharacter, IGame, IItem, IStageInfo, Task } from './types'

/** 「更多视图」菜单里的一组，带分隔标题 */
export interface PredefinedQueryGroup {
  id: string
  title: PSTR
}

export interface PredefinedQuerySegment {
  /** 这一段进的那一版预设 */
  key: string
  label: PSTR
  /** 悬停说明 */
  title: PSTR
}

export interface PredefinedQuery {
  name: string
  /** getPredefinedQueryGroups() 里某一组的 id */
  group: string
  /** 名字那一段的悬停说明；没有时用「只列出还没练到的」 */
  title?: PSTR
  /** 名字后面的各段，按显示顺序；每段进 key 那一版，那一版自己不再单独占一行 */
  segments?: PredefinedQuerySegment[]
  /** 这个字段在列表各行上的和，作为价值显示在标题栏的视图名旁边 */
  totalValue?: string
  query: QueryParam
}

export interface IZoneInfo {
  readonly id: string
  readonly name: string
  /** 窄处显示的短名，例如「第十三章」「残照终尽」；没有时用 name */
  readonly shortName?: string
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
  /** 「更多视图」菜单里预设的分组，按显示顺序；「我的过滤器」是外壳自己的，不在这里 */
  getPredefinedQueryGroups(): PredefinedQueryGroup[]
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
