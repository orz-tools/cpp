import React, { useMemo, useRef } from 'react'
import { useCoarsePointer } from './phoneLayout'

/** 按住多久算长按；和安卓自己的长按差不多 */
const HOLD_MS = 500
/** 手指挪动超过这么多就是在滑，不算长按 */
const SLOP_PX = 10

interface Press {
  timer: number
  x: number
  y: number
  fired: boolean
  /** 弹出菜单：在元素的左下角派发一次右键 */
  fire: () => void
}

/**
 * 触屏上按住一会儿、手指没挪动，就派发一次右键，由包着它的 ContextMenu 弹出菜单：
 * iOS Safari 长按不触发 contextmenu。安卓自己会触发，也换成这一次，只弹一次；长按之后松手不算点击。
 * 菜单弹在这个元素的左下角，和点任务行一样：从按住的地方往右弹，宽的一行里会出屏。
 * 返回的 props 挂在 ContextMenu 里面的那个元素上
 */
export function useLongPressContextMenu(): React.DOMAttributes<HTMLElement> {
  const coarse = useCoarsePointer()
  const press = useRef<Press | null>(null)

  return useMemo(() => {
    if (!coarse) return {}
    const cancel = () => {
      if (press.current) clearTimeout(press.current.timer)
    }
    return {
      onTouchStart: (e: React.TouchEvent<HTMLElement>) => {
        cancel()
        press.current = null
        if (e.touches.length !== 1) return
        const target = e.currentTarget
        const { clientX: x, clientY: y } = e.touches[0]
        const p: Press = {
          x,
          y,
          fired: false,
          timer: 0,
          fire: () => {
            clearTimeout(p.timer)
            p.fired = true
            const r = target.getBoundingClientRect()
            target.dispatchEvent(
              new MouseEvent('contextmenu', {
                bubbles: true,
                cancelable: true,
                button: 2,
                clientX: r.left,
                clientY: r.bottom,
              }),
            )
          },
        }
        p.timer = window.setTimeout(p.fire, HOLD_MS)
        press.current = p
      },
      onTouchMove: (e: React.TouchEvent<HTMLElement>) => {
        const p = press.current
        const t = e.touches[0]
        if (p && !p.fired && t && Math.hypot(t.clientX - p.x, t.clientY - p.y) > SLOP_PX) {
          cancel()
          press.current = null
        }
      },
      onTouchEnd: (e: React.TouchEvent<HTMLElement>) => {
        cancel()
        // 不让浏览器再补发 mousedown 和 click：菜单会当成点在外面关掉，干员会当成点了开档案
        if (press.current?.fired) e.preventDefault()
        else press.current = null
      },
      onTouchCancel: () => {
        cancel()
        press.current = null
      },
      // 安卓自己的长按：先到就换成我们的（弹在同一个地方），晚到就吞掉，菜单已经开着
      onContextMenuCapture: (e: React.MouseEvent<HTMLElement>) => {
        const p = press.current
        if (!p || !e.nativeEvent.isTrusted) return
        e.preventDefault()
        e.stopPropagation()
        if (!p.fired) p.fire()
      },
      onClickCapture: (e: React.MouseEvent<HTMLElement>) => {
        if (!press.current?.fired) return
        press.current = null
        e.preventDefault()
        e.stopPropagation()
      },
    }
  }, [coarse])
}
