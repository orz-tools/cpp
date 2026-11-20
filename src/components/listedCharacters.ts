import { PrimitiveAtom, atom } from 'jotai'

/** 干员列表现在画的行和选择；列表以外（练度图的两个入口）读它，不用再查一遍 */
export interface ListedCharacters {
  /** 列表现在的行，按列表的次序（「计划」视图是计划顺序）；展开子查询的视图里一名干员可能出现几次 */
  keys: readonly string[]
  /** 选中的，按列表的次序 */
  selected: readonly string[]
  /** 列表在查询，或者结果还是上一个视图、上一个面板筛选的 */
  pending: boolean
  /** 列表的查询出错 */
  failed: boolean
}

/** 每个档案有自己的 store，和 listRequeryAtom 一样按档案分开 */
export const listedCharactersAtom: PrimitiveAtom<ListedCharacters> = atom<ListedCharacters>({
  keys: [],
  selected: [],
  pending: true,
  failed: false,
})
