import React, { useCallback, useRef } from 'react'

const DOM_DELTA_LINE = 1
const DOM_DELTA_PAGE = 2
/** Firefox 的鼠标滚轮以行为单位，一格三行；一行算 32px，一格和 Chrome 的一格差不多远 */
const LINE_PX = 32
/** 缩放后 scrollLeft 带小数，滑到头了也可能差半个像素 */
const EDGE_SLOP = 1

export type ScrollMore = 'left' | 'right' | 'both' | null

/** 横滑的条哪一边还有没露出来的内容 */
export function scrollMore(scrollLeft: number, scrollWidth: number, clientWidth: number): ScrollMore {
  const left = scrollLeft > EDGE_SLOP
  const right = scrollLeft + clientWidth < scrollWidth - EDGE_SLOP
  return left && right ? 'both' : left ? 'left' : right ? 'right' : null
}

/**
 * 竖着滚一下滚轮，条横滑多少像素。横向的滚动（触控板横扫、Shift 加滚轮）浏览器自己会滑，
 * 按住 Ctrl 的是触控板双指缩放，这两种都得 0
 */
export function wheelToScrollLeft(
  e: Pick<WheelEvent, 'deltaX' | 'deltaY' | 'deltaMode' | 'ctrlKey'>,
  pageWidth: number,
): number {
  if (e.ctrlKey || Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return 0
  const unit = e.deltaMode === DOM_DELTA_LINE ? LINE_PX : e.deltaMode === DOM_DELTA_PAGE ? pageWidth : 1
  return e.deltaY * unit
}

/**
 * 横滑的条不画滚动条，看不出还有内容：哪边还有，就把哪边写进 data-scroll-more，由 App.css 在那边渐隐。
 * 鼠标的竖滚轮在条上本来什么也不滚，拿来横滑。条本身不横滑时（比如桌面布局下的快捷过滤）两样都不做
 */
export function watchScrollStrip(el: HTMLElement): () => void {
  const sync = () => {
    const { overflowX } = getComputedStyle(el)
    const more =
      overflowX === 'auto' || overflowX === 'scroll' ? scrollMore(el.scrollLeft, el.scrollWidth, el.clientWidth) : null
    if (more) el.setAttribute('data-scroll-more', more)
    else el.removeAttribute('data-scroll-more')
  }
  const onWheel = (e: WheelEvent) => {
    const delta = wheelToScrollLeft(e, el.clientWidth)
    if (!delta) return
    const before = el.scrollLeft
    el.scrollLeft = before + delta
    // 已经滑到头的话，滚轮留给外面
    if (el.scrollLeft !== before) e.preventDefault()
  }

  // 换了一种展开、换了界面语言，按钮换了一批，条自己的宽度却不变，所以连按钮一起看
  const resize = new ResizeObserver(sync)
  const observe = () => {
    resize.disconnect()
    resize.observe(el)
    for (const child of el.children) resize.observe(child)
  }
  const children = new MutationObserver(() => {
    observe()
    sync()
  })
  observe()
  children.observe(el, { childList: true })
  el.addEventListener('scroll', sync, { passive: true })
  el.addEventListener('wheel', onWheel, { passive: false })
  sync()

  return () => {
    resize.disconnect()
    children.disconnect()
    el.removeEventListener('scroll', sync)
    el.removeEventListener('wheel', onWheel)
    el.removeAttribute('data-scroll-more')
  }
}

/** 挂在横滑的条上的 ref，见 watchScrollStrip */
export function useScrollStrip<T extends HTMLElement>(): React.RefCallback<T> {
  const stop = useRef<(() => void) | null>(null)
  return useCallback((el: T | null) => {
    stop.current?.()
    stop.current = el ? watchScrollStrip(el) : null
  }, [])
}
