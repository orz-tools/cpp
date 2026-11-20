/** 一串加减停手这么久才写进用户数据：撤销只留 10 步，一下一步会把之前的都挤掉 */
export const COMMIT_DELAY_MS = 600
/** 比 Blueprint 自己按钮的 300ms 长：触屏上点一下常超过 300ms，不能一点就开始连加 */
export const HOLD_DELAY_MS = 400
export const REPEAT_MS = 100

export const formatter = (q: number) => q.toFixed(0)
export const parser = (q: string) => Math.floor(parseFloat(q) || 0)

/** 从框里现在的字算起，不小于 0 */
export function stepQuantity(text: string, delta: number): number {
  return Math.max(0, parser(text) + delta)
}

export interface DeferredCommit {
  /** 重新计时 */
  schedule(): void
  /** 有待写的就立刻写 */
  flush(): void
  cancel(): void
}

export function createDeferredCommit(delayMs: number, commit: () => void): DeferredCommit {
  let timer: ReturnType<typeof setTimeout> | undefined
  const cancel = () => {
    if (timer === undefined) return
    clearTimeout(timer)
    timer = undefined
  }
  return {
    schedule() {
      cancel()
      timer = setTimeout(() => {
        timer = undefined
        commit()
      }, delayMs)
    },
    flush() {
      if (timer === undefined) return
      cancel()
      commit()
    },
    cancel,
  }
}

export interface HoldRepeat {
  start(): void
  /** 返回这次按住有没有调过 onStep：调过的话，松手跟着来的那次 click 不该再加一下 */
  stop(): boolean
}

/** start 后 delayMs 第一次 onStep，之后每 intervalMs 一次，直到 stop */
export function createHoldRepeat(delayMs: number, intervalMs: number, onStep: () => void): HoldRepeat {
  let timeout: ReturnType<typeof setTimeout> | undefined
  let interval: ReturnType<typeof setInterval> | undefined
  let stepped = false
  const stop = () => {
    clearTimeout(timeout)
    clearInterval(interval)
    timeout = interval = undefined
    const result = stepped
    stepped = false
    return result
  }
  return {
    start() {
      stop()
      timeout = setTimeout(() => {
        timeout = undefined
        stepped = true
        onStep()
        interval = setInterval(onStep, intervalMs)
      }, delayMs)
    },
    stop,
  }
}
