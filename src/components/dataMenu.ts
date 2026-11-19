import { atom } from 'jotai'

/** Whether the navbar's 导入/导出 menu is open; held here so the changelog can open it too */
export const dataMenuOpenAtom = atom(false)
