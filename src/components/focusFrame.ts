import { PrimitiveAtom, atom, useAtomValue, useSetAtom } from 'jotai'
import { selectAtom } from 'jotai/utils'
import { RefObject, useEffect, useMemo, useState } from 'react'
import useEvent from 'react-use-event-hook'

export interface FrameRequest {
  /** skin:<skinId>、baseSkill:<charId>:<buffId>、stage:<stageId>、peek:<peekKey>、so:<charId>:<key>（特勤任务页的一行） */
  target: string
  nonce: number
}

/**
 * 要框出的那一项。请求一直留着，直到对得上的元素挂载并消费它：档案换页、关卡面板展开章节、钉板加卡片，元素都是后挂载的。
 * 每个档案有自己的 store，所以按档案分开
 */
export const focusFrameAtom: PrimitiveAtom<FrameRequest | null> = atom<FrameRequest | null>(null)

let nonce = 0

/** 请求框出 target；同一个 target 再请求一次也会重新滚过去 */
export function useRequestFrame(): (target: string) => void {
  const setRequest = useSetAtom(focusFrameAtom)
  return useEvent((target: string) => setRequest({ target, nonce: ++nonce }))
}

/** 最近一个 overflow-y 是 auto 或 scroll 的祖先；没有时是 document.scrollingElement */
export function scrollParent(el: HTMLElement): HTMLElement {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const { overflowY } = getComputedStyle(p)
    if (overflowY === 'auto' || overflowY === 'scroll') return p
  }
  return (document.scrollingElement ?? document.documentElement) as HTMLElement
}

/**
 * el 的上边离 area 的上边多远、el 多高，按布局上的像素。从另一个大窗口里打开的大窗口，挂载时还在从半大放大，
 * getBoundingClientRect 量到的距离跟着缩小，直接拿去滚只滚到一半
 */
export function measureIn(el: HTMLElement, area: HTMLElement): { top: number; height: number } {
  const r = el.getBoundingClientRect()
  if (area === document.scrollingElement) return { top: r.top, height: r.height }
  const box = area.getBoundingClientRect()
  const scale = box.height / area.offsetHeight || 1
  return { top: (r.top - box.top) / scale, height: r.height / scale }
}

/** 只滚这一层：scrollIntoView 还会滚动外面的祖先，档案滑进来时连抽屉一起挪 */
function scrollToMiddle(el: HTMLElement, area: HTMLElement) {
  const { top, height } = measureIn(el, area)
  area.scrollTop += top - (area.clientHeight - height) / 2
}

/** 最近一次被接住的请求的 nonce：同一时间只框一项，框出新的一项时，之前框着的去掉框 */
const framedNonceAtom = atom(0)

/**
 * 元素对上请求时：滚到所在滚动区域的中间、返回 true，并把请求清掉；所在滚动区域有滚轮、触摸滑动或按键时，或者别处框出了
 * 另一项时变回 false。滚动用的是普通 effect：档案换干员、换页时先在 DossierTabs 的 layout effect 里把滚动归零，这里在它之后跑
 */
export function useFocusFrame(target: string, ref: RefObject<HTMLElement | null>): boolean {
  // 每个元素只订阅自己的 target，别的请求来了不重画
  const mineAtom = useMemo(() => selectAtom(focusFrameAtom, (r) => (r?.target === target ? r : null)), [target])
  const mine = useAtomValue(mineAtom)
  const setRequest = useSetAtom(focusFrameAtom)
  const [consumed, setConsumed] = useState<number | null>(null)
  const framedAtom = useMemo(() => selectAtom(framedNonceAtom, (n) => consumed != null && n === consumed), [consumed])
  const framed = useAtomValue(framedAtom)
  const setFramedNonce = useSetAtom(framedNonceAtom)

  useEffect(() => {
    const el = ref.current
    if (!mine || !el) return
    setRequest((r) => (r === mine ? null : r))
    setConsumed(mine.nonce)
    setFramedNonce(mine.nonce)
    scrollToMiddle(el, scrollParent(el))
  }, [mine, ref, setRequest, setFramedNonce])

  // 用户自己滚动或按键以后，外框就去掉
  useEffect(() => {
    const el = ref.current
    if (!framed || !el) return
    const area = scrollParent(el)
    const clear = () => setConsumed(null)
    area.addEventListener('wheel', clear, { passive: true })
    area.addEventListener('touchmove', clear, { passive: true })
    area.addEventListener('keydown', clear)
    return () => {
      area.removeEventListener('wheel', clear)
      area.removeEventListener('touchmove', clear)
      area.removeEventListener('keydown', clear)
    }
  }, [framed, ref])

  return framed
}
