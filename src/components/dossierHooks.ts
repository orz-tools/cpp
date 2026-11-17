import { atom, useAtomValue, useSetAtom } from 'jotai'
import { selectAtom } from 'jotai/utils'
import { createContext, useContext, useMemo } from 'react'
import useEvent from 'react-use-event-hook'
import { DossierState, clickCharacter, showCharacter } from './dossierState'

// 每个 Cpp 实例有自己的 store，所以档案开着没有是按 profile 分开的，刷新后是关着的
export const dossierAtom = atom<DossierState | null>(null)

let windowCount = 0

export function nextWindowEpoch() {
  return ++windowCount
}

export function currentWindowEpoch() {
  return windowCount
}

/** 弹出的大窗口的序号；窗口外是 null */
export const PopOutWindowContext = createContext<number | null>(null)

/** 和点列表里的干员一样：打开、切换或关上档案；在大窗口里调用时，档案排到窗口上面 */
export function useOpenCharacterDossier(): (charId: string) => void {
  const windowEpoch = useContext(PopOutWindowContext)
  const setState = useSetAtom(dossierAtom)
  return useEvent((charId: string) =>
    setState((state) =>
      clickCharacter(state, charId, {
        epoch: windowEpoch ?? currentWindowEpoch(),
        inWindow: windowEpoch != null,
      }),
    ),
  )
}

/** 打开这名干员的档案；已经开着时不关上，被窗口盖住时重新打开 */
export function useShowCharacterDossier(): (charId: string) => void {
  const windowEpoch = useContext(PopOutWindowContext)
  const setState = useSetAtom(dossierAtom)
  return useEvent((charId: string) =>
    setState((state) =>
      showCharacter(state, charId, {
        epoch: windowEpoch ?? currentWindowEpoch(),
        inWindow: windowEpoch != null,
      }),
    ),
  )
}

export function useCloseCharacterDossier(): () => void {
  const setState = useSetAtom(dossierAtom)
  return useEvent(() => setState(null))
}

export function useDossierOpenFor(charId: string): boolean {
  // 每一行只订阅自己这一位，换干员时只有开关变了的那一两行重新渲染
  const openAtom = useMemo(() => selectAtom(dossierAtom, (s) => s?.charId === charId), [charId])
  return useAtomValue(openAtom)
}
