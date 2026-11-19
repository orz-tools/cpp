import { Atom, PrimitiveAtom, WritableAtom, atom, createStore } from 'jotai'
import type { TxDataAction } from '../pkg/txatom'

type Store = ReturnType<typeof createStore>

/**
 * 干员列表的结果是快照：改了计划、撤销或重做以后加一，列表跟着重新查询，「计划」视图里清空的行才会消失、撤销以后才回来。
 * 每个档案有自己的 store，所以按档案分开
 */
export const listRequeryAtom: PrimitiveAtom<number> = atom(0)

export function requeryList(store: Store): void {
  store.set(listRequeryAtom, (x) => x + 1)
}

/**
 * 提示里的「撤销」只撤它报的那一步：之后用户数据又变了，撤掉的就是别的那一步，所以不动。
 * head 是写入后马上取的用户数据对象
 */
export function undoIfUnchanged<T extends object>(
  store: Store,
  atoms: { dataAtom: WritableAtom<T, TxDataAction<T>, void>; undoCounterAtom: Atom<number> },
  head: T,
): boolean {
  if (store.get(atoms.dataAtom) !== head || store.get(atoms.undoCounterAtom) === 0) return false
  store.set(atoms.dataAtom, 'undo')
  return true
}
