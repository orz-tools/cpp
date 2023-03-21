import { atom, WritableAtom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import { SetStateAction } from 'react'
import { FormulaTag } from '../pkg/cpp-core/DataManager'

export enum ValueType {
  Ap = 'ap',
  Diamond = 'diamond',
  Yuan = 'yuan',
  Time = 'time',
}

export interface Preference {
  valueType: ValueType
  forbiddenFormulaTags: FormulaTag[]
  forbiddenStageIds: string[]
}

const preferenceStorageAtom = atomWithStorage<Preference>('cpp_preference', undefined as any)
export const preferenceAtom: WritableAtom<Preference, [Preference | SetStateAction<Preference>], void> = atom<
  Preference,
  [Preference | SetStateAction<Preference>],
  void
>(
  (get) => {
    const value = Object.assign({}, get(preferenceStorageAtom) || {})
    if (value.valueType == null) value.valueType = ValueType.Ap
    if (value.forbiddenFormulaTags == null) value.forbiddenFormulaTags = []
    if (value.forbiddenStageIds == null) value.forbiddenStageIds = []
    return value
  },
  (get, set, value: Preference | SetStateAction<Preference>) =>
    set(preferenceStorageAtom, typeof value === 'function' ? value(get(preferenceAtom)) : value),
)

export const valueTypeAtom = atom(
  (get) => get(preferenceAtom).valueType,
  (get, set, value: ValueType | SetStateAction<ValueType>) => {
    set(preferenceAtom, (r) => ({
      ...r,
      valueType: typeof value === 'function' ? value(get(preferenceAtom).valueType) : value,
    }))
  },
)

export const forbiddenFormulaTagsAtom = atom(
  (get) => get(preferenceAtom).forbiddenFormulaTags || [],
  (get, set, value: FormulaTag[] | SetStateAction<FormulaTag[]>) => {
    set(preferenceAtom, (r) => ({
      ...r,
      forbiddenFormulaTags: typeof value === 'function' ? value(get(preferenceAtom).forbiddenFormulaTags || []) : value,
    }))
  },
)

export const forbiddenStageIdsAtom = atom(
  (get) => get(preferenceAtom).forbiddenStageIds || [],
  (get, set, value: string[] | SetStateAction<string[]>) => {
    set(preferenceAtom, (r) => ({
      ...r,
      forbiddenStageIds: typeof value === 'function' ? value(get(preferenceAtom).forbiddenStageIds || []) : value,
    }))
  },
)
