import { atom, useAtomValue, useSetAtom } from 'jotai'
import { useEffect } from 'react'
import type { Cpp, ListCharactersQueryParam } from '../Cpp'
import { useCpp } from '../Cpp'

export interface RosterPin {
  label: string
  charIds: string[]
  /** 设筛选的那一项，面板凭它认出钉着的是自己哪一项 */
  key?: string
  /** 设筛选时的 queryParamAtom，用来判断视图变没变 */
  param: ListCharactersQueryParam
}

/** 侧栏面板把干员列表临时筛成一组干员。每个档案有自己的 store，所以按档案分开；刷新后没有 */
export const rosterPinAtom = atom<RosterPin | null>(null)

type PinHost = Pick<Cpp<any>, 'store' | 'queryParamAtom'>

export function setRosterPin(cpp: PinHost, label: string, charIds: string[], key?: string) {
  cpp.store.set(rosterPinAtom, { label, charIds, key, param: cpp.store.get(cpp.queryParamAtom) })
}

export function clearRosterPin(cpp: PinHost) {
  cpp.store.set(rosterPinAtom, null)
}

/**
 * 切换视图、改搜索词或快捷过滤都会换一个 queryParam 对象，筛选随之失效。按引用比较而不在 effect 里监听变化，
 * 面板设筛选和列表渲染谁先谁后都一样
 */
export function activeRosterPin(pin: RosterPin | null, param: ListCharactersQueryParam): RosterPin | null {
  return pin && pin.param === param ? pin : null
}

/** 失效的筛选顺手清掉 */
export function useActiveRosterPin(): RosterPin | null {
  const cpp = useCpp()
  const pin = useAtomValue(rosterPinAtom)
  const param = useAtomValue(cpp.queryParamAtom)
  const setPin = useSetAtom(rosterPinAtom)
  const active = activeRosterPin(pin, param)
  const stale = pin != null && active == null
  useEffect(() => {
    if (stale) setPin((x) => (x === pin ? null : x))
  }, [stale, pin, setPin])
  return active
}
