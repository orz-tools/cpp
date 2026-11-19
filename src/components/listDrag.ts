import type { MoveTarget } from '../pkg/cpp-core/planOrder'

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

/** 「计划」视图：keys 是各行的干员，source 是被拖的那一行 */
export function listGaps(keys: readonly string[], source: number): DropGap<MoveTarget>[] {
  const gaps: DropGap<MoveTarget>[] = keys.map((key, i) => ({
    index: i,
    edge: 'start',
    target: i === source || i === source + 1 ? null : { before: key },
  }))
  const last = keys.length - 1
  if (last >= 0) gaps.push({ index: last, edge: 'end', target: source === last ? null : { after: keys[last] } })
  return gaps
}

/** 指针离容器上下边越近滚得越快；拖到容器外面按贴着边算 */
export function autoScrollStep(clientY: number, top: number, bottom: number): number {
  const speed = (d: number) => Math.min(AUTO_SCROLL_MAX, Math.ceil((AUTO_SCROLL_EDGE - Math.max(0, d)) / 2))
  if (clientY - top < AUTO_SCROLL_EDGE) return -speed(clientY - top)
  if (bottom - clientY < AUTO_SCROLL_EDGE) return speed(bottom - clientY)
  return 0
}
