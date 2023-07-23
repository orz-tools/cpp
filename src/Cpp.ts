import { WritableAtom, atom, createStore } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import React, { SetStateAction, useContext } from 'react'
import { IGameComponent } from './components/types'
import { IGame, IGameAdapter } from './pkg/cpp-basic'
import { UserData, UserDataAtomHolder } from './pkg/cpp-core/UserData'

export interface Preference {
  valueType: ValueType
  forbiddenFormulaTags: string[]
  forbiddenStageIds: string[]
  farmLevel: FarmLevel
}

export enum ValueType {
  Ap = 'ap',
  Diamond = 'diamond',
  Yuan = 'yuan',
  Time = 'time',
}

export enum FarmLevel {
  StarOnly = 'star', // 星标 (最少体力)
  StarForGoal = 'star_for_goal', // 星标 (以计划为目标)
  StarForFinished = 'star_for_finished', // 星标 (以毕业为目标)
  Goal = 'goal', // 计划 (最少体力)
  GoalForFinished = 'goal_for_finished', // 计划 (以毕业为目标)
  Finished = 'finished', // 毕业
}

export const FarmLevelNames: Record<FarmLevel, string> = {
  [FarmLevel.StarOnly]: '星标 (最少体力)',
  [FarmLevel.StarForGoal]: '星标 (以计划为目标)',
  [FarmLevel.StarForFinished]: '星标 (以毕业为目标)',
  [FarmLevel.Goal]: '计划 (最少体力)',
  [FarmLevel.GoalForFinished]: '计划 (以毕业为目标)',
  [FarmLevel.Finished]: '毕业',
}

export const FarmLevelShortNames: Record<FarmLevel, string> = {
  [FarmLevel.StarOnly]: '仅星标',
  [FarmLevel.StarForGoal]: '星标(计划)',
  [FarmLevel.StarForFinished]: '星标(毕业)',
  [FarmLevel.Goal]: '仅计划',
  [FarmLevel.GoalForFinished]: '计划(毕业)',
  [FarmLevel.Finished]: '毕业',
}

export class Cpp<G extends IGame> {
  public constructor(
    public readonly storagePrefix: string,
    public readonly instanceName: string,
    public readonly gameAdapter: IGameAdapter<G>,
    public readonly gameComponent: IGameComponent,
  ) {
    this.preferenceAtoms = this.createPreferenceAtoms()

    this.atoms = new UserDataAtomHolder(this.gameAdapter)
    this.atoms.setAtom(
      atomWithStorage<UserData<any> | undefined>(this.storagePrefix + 'userdata', undefined),
      this.preferenceAtoms.forbiddenFormulaTagsAtom,
    )
  }

  public store = createStore()
  public atoms: UserDataAtomHolder<G>
  public preferenceAtoms: ReturnType<Cpp<G>['createPreferenceAtoms']>

  public createPreferenceAtoms() {
    const preferenceStorageAtom = atomWithStorage<Preference>(this.storagePrefix + 'preference', undefined as any)
    const preferenceAtom: WritableAtom<Preference, [Preference | SetStateAction<Preference>], void> = atom<
      Preference,
      [Preference | SetStateAction<Preference>],
      void
    >(
      (get) => {
        const value = Object.assign({}, get(preferenceStorageAtom) || {})
        if (value.valueType == null) value.valueType = ValueType.Ap
        if (value.farmLevel == null) value.farmLevel = FarmLevel.GoalForFinished
        if (value.forbiddenFormulaTags == null) value.forbiddenFormulaTags = []
        if (value.forbiddenStageIds == null) value.forbiddenStageIds = []
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

    return {
      preferenceAtom,
      preferenceStorageAtom,
      valueTypeAtom,
      forbiddenFormulaTagsAtom,
      forbiddenStageIdsAtom,
      farmLevelAtom,
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

export function useStore<G extends IGame>() {
  return useCpp<G>().store
}

export function useAtoms<G extends IGame>() {
  return useCpp<G>().atoms.atoms
}
