import { atom, useAtomValue, useSetAtom } from 'jotai'
import { atomWithStorage, selectAtom } from 'jotai/utils'
import { SetStateAction, createContext, useContext, useMemo } from 'react'
import useEvent from 'react-use-event-hook'
import { DossierPrefs, DossierState, StatusMode, clickCharacter, readDossierPrefs, showCharacter } from './dossierState'

// 每个 Cpp 实例有自己的 store，所以档案开着没有是按 profile 分开的，刷新后是关着的
export const dossierAtom = atom<DossierState | null>(null)

// 和 cpp_sidebar 一样记在本机、不分档案
const dossierPrefsStorageAtom = atomWithStorage<unknown>('cpp_dossier', null, undefined, { getOnInit: true })

export const dossierPrefsAtom = atom(
  (get) => readDossierPrefs(get(dossierPrefsStorageAtom)),
  (get, set, update: SetStateAction<DossierPrefs>) =>
    set(
      dossierPrefsStorageAtom,
      typeof update === 'function' ? update(readDossierPrefs(get(dossierPrefsStorageAtom))) : update,
    ),
)

export interface OpenDossierOptions {
  /** 打开到这一页：先改本机记录的 section，再按原来的规则打开或切换档案 */
  section?: string
  /** 「练度」页显示哪一边，和 section 一样先记下 */
  statusMode?: StatusMode
}

function withOptions(prefs: DossierPrefs, options: OpenDossierOptions | undefined): DossierPrefs {
  const section = options?.section || prefs.section
  const statusMode = options?.statusMode ?? prefs.statusMode
  return section === prefs.section && statusMode === prefs.statusMode ? prefs : { section, statusMode }
}

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
export function useOpenCharacterDossier(): (charId: string, options?: OpenDossierOptions) => void {
  const windowEpoch = useContext(PopOutWindowContext)
  const setPrefs = useSetAtom(dossierPrefsAtom)
  const setState = useSetAtom(dossierAtom)
  return useEvent((charId: string, options?: OpenDossierOptions) => {
    if (options) setPrefs((p) => withOptions(p, options))
    setState((state) =>
      clickCharacter(state, charId, {
        epoch: windowEpoch ?? currentWindowEpoch(),
        inWindow: windowEpoch != null,
      }),
    )
  })
}

/** 打开这名干员的档案；已经开着时不关上，被窗口盖住时重新打开 */
export function useShowCharacterDossier(): (charId: string, options?: OpenDossierOptions) => void {
  const windowEpoch = useContext(PopOutWindowContext)
  const setPrefs = useSetAtom(dossierPrefsAtom)
  const setState = useSetAtom(dossierAtom)
  return useEvent((charId: string, options?: OpenDossierOptions) => {
    if (options) setPrefs((p) => withOptions(p, options))
    setState((state) =>
      showCharacter(state, charId, {
        epoch: windowEpoch ?? currentWindowEpoch(),
        inWindow: windowEpoch != null,
      }),
    )
  })
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
