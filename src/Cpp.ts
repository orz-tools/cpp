import { WritableAtom, atom, createStore, useAtom, useAtomValue, useSetAtom } from 'jotai'
import { atomFamily, atomWithStorage } from 'jotai/utils'
import React, { SetStateAction, useContext } from 'react'
import { IGameComponent } from './components/types'
import { BlobFlavour } from './pkg/blobcache'
import { IGame, IGameAdapter, IGameAdapterStatic } from './pkg/cpp-basic'
import { UserData, UserDataAtomHolder } from './pkg/cpp-core/UserData'
import { PSTR, gt, lpstr } from './pkg/gt'

export interface Preference {
  v: number
  valueType: ValueType
  forbiddenFormulaTags: string[]
  forbiddenStageIds: string[]
  farmLevel: FarmLevel
  blobFlavour: BlobFlavour
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
}

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
    )

    this.region = localStorage.getItem(this.storagePrefix + 'region') || ''

    const regions = this.gameAdapterStatic.getRegions() || []
    if (regions.length > 0 && !this.region) {
      this.region = regions[0].id
    }
  }

  public readonly region: string
  public store = createStore()
  public atoms: UserDataAtomHolder<G>
  public preferenceAtoms: ReturnType<Cpp<G>['createPreferenceAtoms']>
  public queryParamAtom: ReturnType<Cpp<G>['createQueryParamAtom']>

  public get gameAdapterStatic() {
    return this.gameAdapter.constructor as IGameAdapterStatic<G>
  }

  public setRegion(region: string): boolean {
    if (this.region === region) return false
    localStorage.setItem(this.storagePrefix + 'region', region)
    alert(gt.gettext('区域已切换，将重新载入页面。'))
    location.reload()
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

    const queryParamAtom = atom(
      (get) => {
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
    const preferenceStorageAtom = atomWithStorage<Preference>(this.storagePrefix + 'preference', undefined as any)
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
      gameAtom,
      gameAtoms,
    }
  }
}

export const CppContext = React.createContext<Cpp<any>>(null as any)

export function useCpp<G extends IGame>() {
  return useContext(CppContext) as Cpp<G>
}

export function useGameAdapter<G extends IGame>() {
  return useCpp<G>().gameAdapter
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
