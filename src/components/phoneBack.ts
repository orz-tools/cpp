import type { OverlayInstance } from '@blueprintjs/core'

/**
 * 手机上的返回键：每开一层（档案、弹窗、弹出菜单、卡片，「更多」里的子页或面板页），历史里多一条守卫；
 * 按一次返回，浏览器退掉一条，页面关掉最上面那层。
 *
 * 不在 popstate 里补推守卫：返回键不算用户操作，Chrome 会让返回键跳过页面在没有用户操作时推的记录。
 * 所以只在用户点击、按键之后对账（settled），弹窗关掉多出来的守卫用 history.go 退回去
 */
export interface BackGuardState {
  /** 现在历史里有几条守卫 */
  guards: number
  /** 接下来几次 popstate 是自己 history.go 引起的 */
  expectPops: number
}

export const initialBackGuard: BackGuardState = { guards: 0, expectPops: 0 }

export type BackGuardEvent =
  /** 用户每次点击、按键之后的下一帧；depth 是那时开着几层 */
  | { type: 'settled'; depth: number }
  /** popstate；depth 是那时开着几层 */
  | { type: 'pop'; depth: number }

export type BackGuardAction =
  | { type: 'push'; count: number }
  | { type: 'go'; delta: number }
  /** 关掉最上面那层 */
  | { type: 'close' }
  /** 层已经被代码关掉、守卫还没退：照用户的意思往回走 */
  | { type: 'leave' }

export function stepBackGuard(
  state: BackGuardState,
  event: BackGuardEvent,
): { state: BackGuardState; actions: BackGuardAction[] } {
  if (event.type === 'settled') {
    if (event.depth > state.guards) {
      return {
        state: { ...state, guards: event.depth },
        actions: [{ type: 'push', count: event.depth - state.guards }],
      }
    }
    if (event.depth < state.guards) {
      // 一次退几条都只引起一次 popstate
      return {
        state: { guards: event.depth, expectPops: state.expectPops + 1 },
        actions: [{ type: 'go', delta: event.depth - state.guards }],
      }
    }
    return { state, actions: [] }
  }

  if (state.expectPops > 0) return { state: { ...state, expectPops: state.expectPops - 1 }, actions: [] }
  // 不是自己的守卫，例如手机布局之前就有的同页记录
  if (state.guards === 0) return { state, actions: [] }
  const next = { ...state, guards: state.guards - 1 }
  return { state: next, actions: [event.depth > 0 ? { type: 'close' } : { type: 'leave' }] }
}

/** 开着的 Blueprint 浮层：档案抽屉、弹窗、弹出菜单、卡片都算，toast 的容器和悬停提示不算 */
export function openOverlays(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>('.bp6-overlay.bp6-overlay-open')].filter(
    (o) =>
      !o.classList.contains('bp6-toast-container') &&
      o.querySelector(':scope > .bp6-popover-transition-container > .bp6-tooltip') == null,
  )
}

/**
 * 给最上面那层浮层派发一次 Esc，等于用户按了 Esc；不让 Esc 关的浮层（出错时没有关闭按钮的对话框）就关不掉。
 * last 是 useOverlayStack().getLastOpened()，它是 toast 或悬停提示时取 DOM 里最后一个开着的浮层
 */
export function closeTopOverlay(last: OverlayInstance | undefined): boolean {
  const overlays = openOverlays()
  if (overlays.length === 0) return false
  const fromStack = last?.containerElement.current
  const target = fromStack && overlays.includes(fromStack) ? fromStack : overlays[overlays.length - 1]
  target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true }))
  return true
}
