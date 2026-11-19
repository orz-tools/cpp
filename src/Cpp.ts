import { PrimitiveAtom, WritableAtom, atom, createStore, useAtom, useAtomValue, useSetAtom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import { atomFamily } from 'jotai-family'
import React, { DependencyList, SetStateAction, startTransition, useContext, useMemo } from 'react'
import { ErrAtom } from './components/Err'
import { AppToaster } from './components/Toaster'
import { IGameComponent } from './components/types'
import { BlobFlavour } from './pkg/blobcache'
import { DataManagerState, IGame, IGameAdapter, IGameAdapterStatic } from './pkg/cpp-basic'
import { UserData, UserDataAtomHolder } from './pkg/cpp-core/UserData'
import { PSTR, gt, lpstr } from './pkg/gt'

export type GameDataStatus = Omit<DataManagerState, 'generation'>

export interface Preference {
  v: number
  valueType: ValueType
  forbiddenFormulaTags: string[]
  forbiddenStageIds: string[]
  farmLevel: FarmLevel
  blobFlavour: BlobFlavour
  /** 物品列表、关卡面板里的大数缩写成「9.3万」；图标上的数不看它，总是缩写 */
  compactQuantities: boolean
  game: Record<string, any>
}

export enum ValueType {
  Ap = 'ap',
  Diamond = 'diamond',
  Yuan = 'yuan',
  Time = 'time',
}

export enum Level {
  Star = 1,
  Goal = 2,
  Finished = 3,
}

export enum FarmLevel {
  StarOnly = 'star', // 仅星标
  StarForGoal = 'star_for_goal', // 星标 (以计划为目标)
  StarForFinished = 'star_for_finished', // 星标 (以毕业为目标)
  Goal = 'goal', // 仅计划
  GoalForFinished = 'goal_for_finished', // 计划 (以毕业为目标)
  Finished = 'finished', // 毕业
}

export const FarmLevelNames: Record<FarmLevel, PSTR> = {
  [FarmLevel.StarOnly]: lpstr(() => gt.pgettext('full name', '仅星标')),
  [FarmLevel.StarForGoal]: lpstr(() => gt.pgettext('full name', '星标 (以计划为目标)')),
  [FarmLevel.StarForFinished]: lpstr(() => gt.pgettext('full name', '星标 (以毕业为目标)')),
  [FarmLevel.Goal]: lpstr(() => gt.pgettext('full name', '仅计划')),
  [FarmLevel.GoalForFinished]: lpstr(() => gt.pgettext('full name', '计划 (以毕业为目标)')),
  [FarmLevel.Finished]: lpstr(() => gt.pgettext('full name', '毕业')),
}

export const FarmLevelShortNames: Record<FarmLevel, PSTR> = {
  [FarmLevel.StarOnly]: lpstr(() => gt.pgettext('short name', '仅星标')),
  [FarmLevel.StarForGoal]: lpstr(() => gt.pgettext('short name', '星标(计划)')),
  [FarmLevel.StarForFinished]: lpstr(() => gt.pgettext('short name', '星标(毕业)')),
  [FarmLevel.Goal]: lpstr(() => gt.pgettext('short name', '仅计划')),
  [FarmLevel.GoalForFinished]: lpstr(() => gt.pgettext('short name', '计划(毕业)')),
  [FarmLevel.Finished]: lpstr(() => gt.pgettext('short name', '毕业')),
}

export interface ListCharactersQueryParam {
  v: number
  search: string
  query: string
  quick?: Record<string, any>
  /** query 是编辑中的 JSON 时，记录它是从哪个引用复制来的 */
  source?: string
}

export const SavedQueryPrefix = '#*'

export class Cpp<G extends IGame> {
  public constructor(
    public readonly storagePrefix: string,
    public readonly instanceName: string,
    public readonly gameAdapter: IGameAdapter<G>,
    public readonly gameComponent: IGameComponent,
  ) {
    localStorage.removeItem('cpp_query_param')

    this.preferenceAtoms = this.createPreferenceAtoms()
    this.queryParamAtom = this.createQueryParamAtom()

    this.atoms = new UserDataAtomHolder(this.gameAdapter)
    this.atoms.setAtom(
      atomWithStorage<UserData<any> | undefined>(this.storagePrefix + 'userdata', undefined),
      this.preferenceAtoms.forbiddenFormulaTagsAtom,
      this.gameDataGenerationAtom,
    )
    // Mounted for the life of the page: atomWithStorage reads localStorage again on every mount, and a language
    // switch remounts the whole React tree. The fresh copy is no longer the head of the undo history, which empties it.
    this.store.sub(this.atoms.baseAtom, () => {})

    this.storedRegion = localStorage.getItem(this.storagePrefix + 'region') || ''

    const regions = this.gameAdapterStatic.getRegions() || []
    if (regions.length > 0 && !this.storedRegion) {
      this.storedRegion = regions[0].id
    }

    const dm = this.gameAdapter.getDataManager()
    const syncDataState = () => {
      const { status, generation, loading, updating, error } = dm.getState()
      const previous = this.store.get(this.gameDataGenerationAtom)
      if (previous === 0) {
        this.store.set(this.gameDataGenerationAtom, generation)
      } else if (generation !== previous) {
        // As a transition React redraws the panels in short slices rather than one long task. Not for the first
        // commit: the app mounts from the status atom, and would render once more when the transition lands.
        startTransition(() => this.store.set(this.gameDataGenerationAtom, generation))
      }
      this.store.set(this.gameDataStatusAtom, { status, loading, updating, error })
    }
    syncDataState()
    dm.subscribe(syncDataState)

    this.store.sub(this.preferenceAtoms.gameAtom, () => {
      if (this.gameAdapter.applyPreferenceSnapshot?.(this.store.get(this.preferenceAtoms.gameAtom))) {
        dm.rebuild().catch((e) => console.error('Failed to rebuild game data for new preferences', e))
      }
    })
  }

  private readonly storedRegion: string
  public store = createStore()
  public atoms: UserDataAtomHolder<G>
  public preferenceAtoms: ReturnType<Cpp<G>['createPreferenceAtoms']>
  public queryParamAtom: ReturnType<Cpp<G>['createQueryParamAtom']>
  /** Changes only when the game data manager commits */
  public readonly gameDataGenerationAtom: PrimitiveAtom<number> = atom(0)
  public readonly gameDataStatusAtom: PrimitiveAtom<GameDataStatus> = atom<GameDataStatus>({
    status: 'loading',
    loading: [],
    updating: false,
  })

  /** The region of the committed game data; until the first commit, the stored one the data is loading for. */
  public get region(): string {
    return this.gameAdapter.getDataManager().region ?? this.storedRegion
  }

  public get gameAdapterStatic() {
    return this.gameAdapter.constructor as IGameAdapterStatic<G>
  }

  public async setRegion(region: string): Promise<boolean> {
    if (this.region === region) return false
    const toaster = await AppToaster
    const progress = toaster.show(
      { message: gt.gettext('正在切换区域…'), isCloseButtonShown: false, timeout: 0, intent: 'primary' },
      'region',
    )
    try {
      await this.gameAdapter.getDataManager().switchRegion(region)
      localStorage.setItem(this.storagePrefix + 'region', region)
      // Replaced in place: a dismiss followed by a show with the same key drops both.
      toaster.show({ message: gt.gettext('区域已切换'), intent: 'success' }, progress)
    } catch (e) {
      toaster.dismiss(progress)
      this.store.set(ErrAtom, { error: e, context: gt.pgettext('error context', '切换区域失败') })
    }
    return true
  }

  public createQueryParamAtom() {
    const key = `cpp[` + this.gameAdapter.getCodename() + `]query_param`
    const baseAtom = atom(
      (() => {
        try {
          return (JSON.parse(localStorage.getItem(key) || 'null') as ListCharactersQueryParam) || undefined
        } catch {
          return undefined
        }
      })(),
    )

    const storageAtom = atom(
      (get) => get(baseAtom),
      (get, set, value: ListCharactersQueryParam | undefined) => {
        set(baseAtom, value)
        if (value) {
          localStorage.setItem(key, JSON.stringify(value))
        } else {
          localStorage.removeItem(key)
        }
      },
    )

    const normalizedAtom = atom((get) => {
      const value = Object.assign({}, get(storageAtom) || {}) as ListCharactersQueryParam
      if (value.v !== 1) {
        value.v = 1
        value.query = '#!all'
        value.search = ''
        value.quick = {}
      }
      if (value.query == null) value.query = '#!all'
      if (value.search == null) value.search = ''
      if (value.quick == null) value.quick = {}
      // 「缺席」曾是一个视图，现在是「全部」加上快捷过滤「缺席」
      if (value.query === '#!absent') {
        value.query = '#!all'
        value.quick = { ...value.quick, holding: ['absent'] }
      }
      if (value.source === '#!absent') value.source = undefined
      const replaced = this.gameAdapter.getReplacedPredefinedQueries?.() ?? {}
      const preset = value.query.startsWith('#?') ? value.query.slice(2) : undefined
      if (preset != null && Object.hasOwn(replaced, preset)) value.query = '#?' + replaced[preset]
      return value
    })

    const queryParamAtom = atom(
      (get) => {
        const value = get(normalizedAtom)
        // 只在引用已保存过滤器时才依赖用户数据，免得每次改数据都让列表重新查询
        if (value.query.startsWith(SavedQueryPrefix)) {
          const id = value.query.slice(SavedQueryPrefix.length)
          if (!get(this.atoms.atoms.dataAtom).savedQueries.some((x) => x.id === id)) {
            return { ...value, query: '#!all', source: undefined }
          }
        }
        return value
      },
      (get, set, value: ListCharactersQueryParam | SetStateAction<ListCharactersQueryParam>) => {
        if (typeof value === 'function') value = value(get(queryParamAtom))
        set(storageAtom, value)
      },
    )
    return queryParamAtom
  }

  public createPreferenceAtoms() {
    // getOnInit：entry.tsx 在 React 挂载前就读游戏偏好（applyPreferenceSnapshot），那时默认的 onMount 还没从 localStorage 取值
    const preferenceStorageAtom = atomWithStorage<Preference>(
      this.storagePrefix + 'preference',
      undefined as any,
      undefined,
      {
        getOnInit: true,
      },
    )
    const preferenceAtom: WritableAtom<Preference, [Preference | SetStateAction<Preference>], void> = atom<
      Preference,
      [Preference | SetStateAction<Preference>],
      void
    >(
      (get) => {
        const value = Object.assign({}, get(preferenceStorageAtom) || {})
        if (!value.v) value.v = 0
        if (value.valueType == null) value.valueType = ValueType.Ap
        if (value.farmLevel == null) value.farmLevel = FarmLevel.Goal
        if (value.forbiddenFormulaTags == null) value.forbiddenFormulaTags = []
        if (value.forbiddenStageIds == null) value.forbiddenStageIds = []
        if (value.blobFlavour == null) value.blobFlavour = 'soul'
        if (value.compactQuantities == null) value.compactQuantities = false
        value.v = 1
        return value
      },
      (get, set, value: Preference | SetStateAction<Preference>) =>
        set(preferenceStorageAtom, typeof value === 'function' ? value(get(preferenceAtom)) : value),
    )

    const valueTypeAtom = atom(
      (get) => get(preferenceAtom).valueType,
      (get, set, value: ValueType | SetStateAction<ValueType>) => {
        set(preferenceAtom, (r) => ({
          ...r,
          valueType: typeof value === 'function' ? value(get(preferenceAtom).valueType) : value,
        }))
      },
    )

    const forbiddenFormulaTagsAtom = atom(
      (get) => get(preferenceAtom).forbiddenFormulaTags || [],
      (get, set, value: string[] | SetStateAction<string[]>) => {
        set(preferenceAtom, (r) => ({
          ...r,
          forbiddenFormulaTags:
            typeof value === 'function' ? value(get(preferenceAtom).forbiddenFormulaTags || []) : value,
        }))
      },
    )

    const forbiddenStageIdsAtom = atom(
      (get) => get(preferenceAtom).forbiddenStageIds || [],
      (get, set, value: string[] | SetStateAction<string[]>) => {
        set(preferenceAtom, (r) => ({
          ...r,
          forbiddenStageIds: typeof value === 'function' ? value(get(preferenceAtom).forbiddenStageIds || []) : value,
        }))
      },
    )

    const farmLevelAtom = atom(
      (get) => get(preferenceAtom).farmLevel || [],
      (get, set, value: FarmLevel | SetStateAction<FarmLevel>) => {
        set(preferenceAtom, (r) => ({
          ...r,
          farmLevel: typeof value === 'function' ? value(get(preferenceAtom).farmLevel || []) : value,
        }))
      },
    )

    const blobFlavourAtom = atom(
      (get) => get(preferenceAtom).blobFlavour || [],
      (get, set, value: BlobFlavour | SetStateAction<BlobFlavour>) => {
        set(preferenceAtom, (r) => ({
          ...r,
          blobFlavour: typeof value === 'function' ? value(get(preferenceAtom).blobFlavour || []) : value,
        }))
      },
    )

    const compactQuantitiesAtom = atom(
      (get) => get(preferenceAtom).compactQuantities,
      (get, set, value: SetStateAction<boolean>) => {
        set(preferenceAtom, (r) => ({
          ...r,
          compactQuantities: typeof value === 'function' ? value(get(preferenceAtom).compactQuantities) : value,
        }))
      },
    )

    const gameAtom = atom(
      (get) => get(preferenceAtom).game || {},
      (get, set, value: Record<string, any> | SetStateAction<Record<string, any>>) => {
        set(preferenceAtom, (r) => ({
          ...r,
          game: typeof value === 'function' ? value(get(preferenceAtom).game || {}) : value,
        }))
      },
    )

    const gameAtoms = atomFamily((key: keyof G['preferences']) =>
      atom(
        (get) => this.gameAdapter.readPreference(key, get(gameAtom)),
        (get, set, value: any) => set(gameAtom, this.gameAdapter.writePreference(key, value, get(gameAtom))),
      ),
    )

    return {
      preferenceAtom,
      preferenceStorageAtom,
      valueTypeAtom,
      forbiddenFormulaTagsAtom,
      forbiddenStageIdsAtom,
      farmLevelAtom,
      blobFlavourAtom,
      compactQuantitiesAtom,
      gameAtom,
      gameAtoms,
    }
  }
}

export const CppContext = React.createContext<Cpp<any>>(null as any)

export function useCpp<G extends IGame>() {
  return useContext(CppContext) as Cpp<G>
}

/** Re-renders the caller whenever newer game data is committed, so what it reads from the adapter stays current. */
export function useGameAdapter<G extends IGame>() {
  const cpp = useCpp<G>()
  useAtomValue(cpp.gameDataGenerationAtom)
  return cpp.gameAdapter
}

/** For a dependency list: changes whenever newer game data is committed. */
export function useGameDataGeneration() {
  return useAtomValue(useCpp().gameDataGenerationAtom)
}

/**
 * useMemo for values read from the game adapter: also recomputes whenever newer game data is committed. Lint checks
 * the deps of its callers as it does for useMemo (additionalHooks in .oxlintrc.json).
 */
export function useGameDataMemo<T>(factory: () => T, deps: DependencyList): T {
  const generation = useGameDataGeneration()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(factory, [...deps, generation])
}

export function useGameAdapterStatic<G extends IGame>() {
  return useCpp<G>().gameAdapterStatic
}

export function useStore<G extends IGame>() {
  return useCpp<G>().store
}

export function useAtoms<G extends IGame>() {
  return useCpp<G>().atoms.atoms
}

function __internalGetGamePreferenceAtom<G extends IGame, K extends keyof G['preferences']>(param: K) {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useCpp<G>().preferenceAtoms.gameAtoms(param) as WritableAtom<
    G['preferences'][K],
    [value: G['preferences'][K]],
    void
  >
}

/* eslint-disable react-hooks/rules-of-hooks */
class GameUser<G extends IGame> {
  public useGamePreferenceAtom<K extends keyof G['preferences']>(param: K) {
    return useAtom(__internalGetGamePreferenceAtom<G, K>(param))
  }

  public useSetGamePreferenceAtom<K extends keyof G['preferences']>(param: K) {
    return useSetAtom(__internalGetGamePreferenceAtom<G, K>(param))
  }

  public useGamePreferenceAtomValue<K extends keyof G['preferences']>(param: K) {
    return useAtomValue(__internalGetGamePreferenceAtom<G, K>(param))
  }
}

const gameUserInstance = new GameUser()
export function WithGame<G extends IGame>() {
  return gameUserInstance as any as GameUser<G>
}
