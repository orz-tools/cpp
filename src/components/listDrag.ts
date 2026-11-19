import { MoveTarget, moveKeys } from '../pkg/cpp-core/planOrder'

/** 按下后移动超过这么多 px 才算拖，没超过就松开仍是点击 */
export const DRAG_THRESHOLD = 4

const AUTO_SCROLL_EDGE = 40
const AUTO_SCROLL_MAX = 20

export interface Measurement {
  start: number
  end: number
}

/**
 * 两行之间的一条边界：第 index 行的上边（start）或下边（end），在内容里往下再挪 offset。
 * target 为 null 的是被拖那一块自己的上下边：放在这里等于没动，不画线，松开不写
 */
export interface DropGap<T> {
  index: number
  edge: 'start' | 'end'
  offset?: number
  target: T | null
}

export function gapY(gap: DropGap<unknown>, measurements: readonly Measurement[]): number {
  const m = measurements[gap.index]
  return (gap.edge === 'start' ? m.start : m.end) + (gap.offset ?? 0)
}

export function nearestGap<T>(
  gaps: readonly DropGap<T>[],
  measurements: readonly Measurement[],
  y: number,
): DropGap<T> | undefined {
  let best: DropGap<T> | undefined
  let distance = Infinity
  for (const gap of gaps) {
    if (!measurements[gap.index]) continue
    const d = Math.abs(gapY(gap, measurements) - y)
    if (d < distance) {
      best = gap
      distance = d
    }
  }
  return best
}

/**
 * keys 每条边界上放下 moving 的去处：第 i 条在 keys[i] 上面，第 keys.length 条在最后一项下面。
 * 放下后看得到的顺序不变就是 null，按 keys 判断：藏起来的干员不会在看不出任何变化时被挪动
 */
export function gatherTargets(keys: readonly string[], moving: ReadonlySet<string>): (MoveTarget | null)[] {
  const picked = [...moving]
  const lastStill = keys.findLast((key) => !moving.has(key))
  return Array.from({ length: keys.length + 1 }, (_, i) => {
    const below = keys.slice(i).find((key) => !moving.has(key))
    const target = below !== undefined ? { before: below } : lastStill !== undefined ? { after: lastStill } : null
    return target && moveKeys(keys, picked, target) !== keys ? target : null
  })
}

/** 「计划」视图：keys 是各行的干员，moving 是这次挪的 */
export function listGaps(keys: readonly string[], moving: ReadonlySet<string>): DropGap<MoveTarget>[] {
  const n = keys.length
  if (n === 0) return []
  return gatherTargets(keys, moving).map((target, i) =>
    i < n ? { index: i, edge: 'start', target } : { index: n - 1, edge: 'end', target },
  )
}

export function inRanges(ranges: readonly (readonly [number, number])[], index: number): boolean {
  return ranges.some(([first, last]) => first <= index && index <= last)
}

/** 指针离容器上下边越近滚得越快；拖到容器外面按贴着边算 */
export function autoScrollStep(clientY: number, top: number, bottom: number): number {
  const speed = (d: number) => Math.min(AUTO_SCROLL_MAX, Math.ceil((AUTO_SCROLL_EDGE - Math.max(0, d)) / 2))
  if (clientY - top < AUTO_SCROLL_EDGE) return -speed(clientY - top)
  if (bottom - clientY < AUTO_SCROLL_EDGE) return speed(bottom - clientY)
  return 0
}
