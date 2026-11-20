import { SetStateAction, atom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import { useSyncExternalStore } from 'react'

/** 手机布局：一次一个区域、底部标签栏、「更多」代替侧栏 */
export const PHONE_QUERY = '(max-width: 767px)'
/** 触屏：点任务行出菜单、不拖列宽；和宽度无关，平板上也是 */
export const COARSE_QUERY = '(pointer: coarse)'

function mediaStore(query: string) {
  return {
    subscribe: (onChange: () => void) => {
      const mql = window.matchMedia(query)
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    },
    get: () => window.matchMedia(query).matches,
  }
}

const phoneStore = mediaStore(PHONE_QUERY)
const coarseStore = mediaStore(COARSE_QUERY)

export function usePhoneLayout(): boolean {
  return useSyncExternalStore(phoneStore.subscribe, phoneStore.get)
}

export function useCoarsePointer(): boolean {
  return useSyncExternalStore(coarseStore.subscribe, coarseStore.get)
}

/** 手机布局的样式都挂在 <html> 的 cpp-phone 下；只有游戏页面调，首页和已退役游戏的页面不换布局 */
export function watchPhoneLayoutClass(): () => void {
  const sync = () => document.documentElement.classList.toggle('cpp-phone', phoneStore.get())
  sync()
  return phoneStore.subscribe(sync)
}

export const PHONE_AREAS = ['chars', 'tasks', 'farm', 'items', 'more'] as const
export type PhoneArea = (typeof PHONE_AREAS)[number]

export function readPhoneArea(stored: unknown): PhoneArea {
  return PHONE_AREAS.includes(stored as PhoneArea) ? (stored as PhoneArea) : 'chars'
}

// 和 cpp_sidebar 一样记在本机、不分档案
const phoneAreaStorageAtom = atomWithStorage<unknown>('cpp_phone_area', null, undefined, { getOnInit: true })

export const phoneAreaAtom = atom(
  (get) => readPhoneArea(get(phoneAreaStorageAtom)),
  (get, set, update: SetStateAction<PhoneArea>) =>
    set(phoneAreaStorageAtom, typeof update === 'function' ? update(readPhoneArea(get(phoneAreaStorageAtom))) : update),
)

export type PhoneMorePage = 'import' | 'export' | 'value' | 'options' | 'region' | 'locale' | 'theme'

/** 「更多」里打开的子页；刷新后回到列表 */
export const phoneMorePageAtom = atom<PhoneMorePage | null>(null)
