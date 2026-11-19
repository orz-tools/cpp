import { Icon } from '@blueprintjs/core'
import type { Virtualizer } from '@tanstack/react-virtual'
import React, { RefObject, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import useEvent from 'react-use-event-hook'
import { DRAG_THRESHOLD, DropGap, autoScrollStep, gapY, nearestGap } from './listDrag'

type HoverProps = Pick<React.HTMLAttributes<HTMLElement>, 'onPointerMove' | 'onPointerLeave'>
type PressProps = Pick<React.HTMLAttributes<HTMLElement>, 'onPointerDown' | 'onDragStart'>

/** 行拿它挂事件：悬停的地方出把手，按住的地方起拖 */
export interface ListDrag<S> {
  hoverProps(source: S): HoverProps
  pressProps(source: S): PressProps
}

export interface ListDragStart<T> {
  /** 被拖的首尾两行，列表把它们画淡 */
  rows: readonly [number, number]
  gaps: DropGap<T>[]
}

interface Options<S, T> {
  enabled: boolean
  /** 滚动容器：拖动中捕获指针，指针靠近上下边时滚动它 */
  scrollRef: RefObject<HTMLElement>
  /** 虚拟列表的内容容器，行的 start / end 从它的顶上量起 */
  contentRef: RefObject<HTMLElement>
  virtualizer: Virtualizer<HTMLUListElement, Element>
  /** 把手上下各比行缩进几 px */
  handleInset: number
  /** 移动过了门槛时调一次；返回 undefined 时这次不拖 */
  begin: (source: S) => ListDragStart<T> | undefined
  commit: (source: S, target: T) => void
}

interface Session<S, T> {
  source: S
  pointerId: number
  x: number
  y: number
  clientY: number
  /** 过了门槛、begin 给了落点以后才有 */
  gaps?: DropGap<T>[]
  gap?: DropGap<T>
  /** 按了 Esc：不画线、不提交，还在等松开，好吞掉那次 click */
  cancelled?: boolean
}

const HANDLE_WIDTH = 14
const HANDLE_HIDE_DELAY = 100
const NO_PROPS = {}
const preventDefault = (e: React.SyntheticEvent) => e.preventDefault()

/** 松开时的那次 click 落在起拖的行上，会打开档案、子菜单；它和 pointerup 在同一个任务里派发 */
function swallowNextClick() {
  const swallow = (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }
  window.addEventListener('click', swallow, { capture: true, once: true })
  setTimeout(() => window.removeEventListener('click', swallow, { capture: true }))
}

export function useListDrag<S, T>({
  enabled,
  scrollRef,
  contentRef,
  virtualizer,
  handleInset,
  begin: beginDrag,
  commit: commitDrag,
}: Options<S, T>) {
  const begin = useEvent(beginDrag)
  const commit = useEvent(commitDrag)
  // 只有这三样进 state：拖动中每次移动都 setState 会重画整个列表
  const [active, setActive] = useState<{ source: S; rows: readonly [number, number] }>()
  const [gap, setGap] = useState<DropGap<T>>()
  const [handlePos, setHandlePos] = useState<{ left: number; top: number; height: number }>()

  const session = useRef<Session<S, T>>()
  const detach = useRef<() => void>()
  const frame = useRef<number>()
  const hover = useRef<{ el: Element; source: S }>()
  const hideTimer = useRef<number>()

  // 任务列表的行高是量出来的：拖动中滚到新的行，量出的高度在下次 getMeasurements 时才进 measurementsCache
  const measurements = () => {
    virtualizer.getTotalSize()
    return virtualizer.measurementsCache
  }

  const hideHandle = useEvent(() => {
    window.clearTimeout(hideTimer.current)
    hover.current = undefined
    setHandlePos(undefined)
  })

  const keepHandle = useEvent(() => window.clearTimeout(hideTimer.current))

  const leaveHandle = useEvent(() => {
    window.clearTimeout(hideTimer.current)
    hideTimer.current = window.setTimeout(hideHandle, HANDLE_HIDE_DELAY)
  })

  const showHandle = useEvent((e: React.PointerEvent<HTMLElement>, source: S) => {
    if (e.pointerType === 'touch' || session.current) return
    window.clearTimeout(hideTimer.current)
    hover.current = { el: e.currentTarget, source }
    const rect = e.currentTarget.getBoundingClientRect()
    const next = { left: rect.left - HANDLE_WIDTH, top: rect.top + handleInset, height: rect.height - 2 * handleInset }
    setHandlePos((x) => (x && x.left === next.left && x.top === next.top && x.height === next.height ? x : next))
  })

  const updateGap = useEvent(() => {
    const s = session.current
    const content = contentRef.current
    if (!s?.gaps || s.cancelled || !content) return
    const next = nearestGap(s.gaps, measurements(), s.clientY - content.getBoundingClientRect().top)
    if (next === s.gap) return
    s.gap = next
    setGap(next)
  })

  const stopDragging = () => {
    if (frame.current !== undefined) cancelAnimationFrame(frame.current)
    frame.current = undefined
    document.body.classList.remove('cpp-list-dragging')
    scrollRef.current?.classList.remove('cpp-list-drag-scroller')
    setActive(undefined)
    setGap(undefined)
  }

  const end = useEvent((drop: boolean) => {
    const s = session.current
    session.current = undefined
    detach.current?.()
    detach.current = undefined
    if (!s?.gaps) return
    stopDragging()
    const scroller = scrollRef.current
    if (scroller?.hasPointerCapture(s.pointerId)) scroller.releasePointerCapture(s.pointerId)
    const target = s.gap?.target
    if (drop && !s.cancelled && target != null) commit(s.source, target)
    swallowNextClick()
  })

  const start = (s: Session<S, T>, e: PointerEvent) => {
    const started = begin(s.source)
    if (!started) {
      end(false)
      return
    }
    s.gaps = started.gaps
    // 捕获只为在窗口外松开时也收到 pointerup；Chrome 有时一给就收回（lostpointercapture），所以丢了也接着拖，
    // 事件照样从指针下面的元素冒泡到 window
    scrollRef.current?.setPointerCapture(e.pointerId)
    document.body.classList.add('cpp-list-dragging')
    scrollRef.current?.classList.add('cpp-list-drag-scroller')
    window.getSelection()?.removeAllRanges()
    hideHandle()
    setActive({ source: s.source, rows: started.rows })
    updateGap()
    function autoScroll() {
      frame.current = requestAnimationFrame(autoScroll)
      const scroller = scrollRef.current
      if (s.cancelled || !scroller) return
      const rect = scroller.getBoundingClientRect()
      const step = autoScrollStep(s.clientY, rect.top, rect.bottom)
      if (step !== 0) scroller.scrollTop += step
    }
    frame.current = requestAnimationFrame(autoScroll)
  }

  const press = useEvent((e: React.PointerEvent<HTMLElement>, source: S) => {
    if (!enabled || session.current || e.pointerType === 'touch' || e.button !== 0) return
    const s: Session<S, T> = { source, pointerId: e.pointerId, x: e.clientX, y: e.clientY, clientY: e.clientY }
    session.current = s

    const mine = (ev: PointerEvent) => ev.pointerId === s.pointerId && session.current === s
    const onMove = (ev: PointerEvent) => {
      if (!mine(ev) || s.cancelled) return
      // 在窗口外松开的收不到 pointerup
      if ((ev.buttons & 1) === 0) {
        end(false)
        return
      }
      s.clientY = ev.clientY
      if (s.gaps) updateGap()
      else if (Math.hypot(ev.clientX - s.x, ev.clientY - s.y) > DRAG_THRESHOLD) start(s, ev)
    }
    const onUp = (ev: PointerEvent) => mine(ev) && end(true)
    const onCancel = (ev: PointerEvent) => mine(ev) && end(false)
    const onBlur = () => end(false)
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key !== 'Escape' || !s.gaps || s.cancelled) return
      // 吞掉：档案抽屉、弹窗也听 Esc
      ev.preventDefault()
      ev.stopPropagation()
      s.cancelled = true
      stopDragging()
    }
    const onScroll = () => updateGap()

    const scroller = scrollRef.current
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    window.addEventListener('blur', onBlur)
    window.addEventListener('keydown', onKey, true)
    scroller?.addEventListener('scroll', onScroll)
    detach.current = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('keydown', onKey, true)
      scroller?.removeEventListener('scroll', onScroll)
    }
  })

  const pressHandle = useEvent((e: React.PointerEvent<HTMLElement>) => {
    const h = hover.current
    if (!h || !handlePos) return
    // 列表在把手出现以后重画过（撤销、别处改了计划），记下的那一行可能已经不是把手旁边这一行了
    const rect = h.el.getBoundingClientRect()
    if (!h.el.isConnected || rect.left - HANDLE_WIDTH !== handlePos.left || rect.top + handleInset !== handlePos.top) {
      hideHandle()
      return
    }
    press(e, h.source)
  })

  useEffect(() => {
    const scroller = scrollRef.current
    if (!handlePos || !scroller) return
    scroller.addEventListener('scroll', hideHandle, { passive: true })
    return () => scroller.removeEventListener('scroll', hideHandle)
  }, [handlePos, scrollRef, hideHandle])

  useEffect(() => {
    if (enabled) return
    hideHandle()
    end(false)
  }, [enabled, hideHandle, end])

  useEffect(
    () => () => {
      window.clearTimeout(hideTimer.current)
      end(false)
    },
    [end],
  )

  const drag = useMemo<ListDrag<S>>(
    () =>
      enabled
        ? {
            hoverProps: (source) => ({ onPointerMove: (e) => showHandle(e, source), onPointerLeave: leaveHandle }),
            // 头像是 <img>：浏览器自己的拖放一开始，指针事件就被 pointercancel 掐断
            pressProps: (source) => ({ onPointerDown: (e) => press(e, source), onDragStart: preventDefault }),
          }
        : { hoverProps: () => NO_PROPS, pressProps: () => NO_PROPS },
    [enabled, showHandle, leaveHandle, press],
  )

  const rows = gap?.target != null ? measurements() : undefined
  const overlay = gap && rows?.[gap.index] ? <div className="cpp-drop-line" style={{ top: gapY(gap, rows) }} /> : null

  const handle =
    handlePos && !active
      ? createPortal(
          <div
            className="cpp-drag-handle"
            aria-hidden={true}
            style={handlePos}
            onPointerMove={keepHandle}
            onPointerLeave={leaveHandle}
            onPointerDown={pressHandle}
          >
            <Icon icon="drag-handle-vertical" size={16} />
          </div>,
          document.body,
        )
      : null

  return { drag, active, overlay, handle }
}
