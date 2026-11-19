import type { MoveTarget } from '../pkg/cpp-core/planOrder'
import type { DropGap } from './listDrag'

/** 干员那一行的高度；任务列表估行高时也用它 */
export const TASK_HEADER_HEIGHT = 30

/** 同一段里相邻、同一名干员的几行，画在一个标题行下面 */
export interface TaskRun {
  charId: string
  starred: boolean
  first: number
  last: number
}

export interface TaskListLayout {
  runs: TaskRun[]
  /** 每一行属于哪一组 */
  runOf: number[]
}

/**
 * 前 starredCount 行是星标段。一组不跨段：星标段最后一名和其余段第一名是同一人时，其余段另起标题行，
 * 两段各自的组才都有标题行可拖
 */
export function layoutTasks(tasks: readonly { charId: string }[], starredCount: number): TaskListLayout {
  const runs: TaskRun[] = []
  const runOf: number[] = []
  tasks.forEach((task, i) => {
    const starred = i < starredCount
    const prev = runs[runs.length - 1]
    if (prev && prev.charId === task.charId && prev.starred === starred) prev.last = i
    else runs.push({ charId: task.charId, starred, first: i, last: i })
    runOf.push(runs.length - 1)
  })
  return { runs, runOf }
}

/** 拖一名干员（第 run 组）有没有地方放：本段还有别的组。星标段在前，同一段的组总是挨着 */
export function charDraggable(layout: TaskListLayout, run: number): boolean {
  const starred = layout.runs[run].starred
  return layout.runs[run - 1]?.starred === starred || layout.runs[run + 1]?.starred === starred
}

/** 拖一名干员（第 run 组）：只放在本段的组之间 */
export function charDragGaps(layout: TaskListLayout, run: number): DropGap<MoveTarget>[] {
  const starred = layout.runs[run].starred
  const gaps: DropGap<MoveTarget>[] = []
  let last = -1
  layout.runs.forEach((r, i) => {
    if (r.starred !== starred) return
    gaps.push({ index: r.first, edge: 'start', target: i === run || i === run + 1 ? null : { before: r.charId } })
    last = i
  })
  const r = layout.runs[last]
  gaps.push({ index: r.last, edge: 'end', target: last === run ? null : { after: r.charId } })
  return gaps
}

/** 第 row 行所在的组里，group 相同、连着的行是一项；不带 group 的行不归任何一项 */
function groupItems(tasks: readonly { group?: string }[], layout: TaskListLayout, row: number) {
  const run = layout.runs[layout.runOf[row]]
  const items: { group: string; first: number; last: number }[] = []
  for (let i = run.first; i <= run.last; i++) {
    const group = tasks[i].group
    if (!group) continue
    const prev = items[items.length - 1]
    if (prev && prev.group === group && prev.last === i - 1) prev.last = i
    else items.push({ group, first: i, last: i })
  }
  return { run, items }
}

/** 拖第 row 行那一整项有没有地方放：这一行带 group，组里还有别的整项 */
export function groupDraggable(tasks: readonly { group?: string }[], layout: TaskListLayout, row: number): boolean {
  return !!tasks[row]?.group && groupItems(tasks, layout, row).items.length > 1
}

/**
 * 拖第 row 行那一整项：只放在别的整项前面、最后一项后面。
 * 这一行没有 group 时不能拖
 */
export function groupDragGaps(
  tasks: readonly { group?: string }[],
  layout: TaskListLayout,
  row: number,
): { rows: readonly [number, number]; gaps: DropGap<MoveTarget>[] } | undefined {
  if (!tasks[row]?.group) return undefined
  const { run, items } = groupItems(tasks, layout, row)
  const source = items.findIndex((w) => w.first <= row && row <= w.last)
  const dragged = items[source]
  const gaps: DropGap<MoveTarget>[] = items.map((w, j) => ({
    index: w.first,
    edge: 'start',
    // 组的第一行上面画着干员那一行，线画在它和任务之间
    ...(w.first === run.first ? { offset: TASK_HEADER_HEIGHT } : {}),
    target: j === source || j === source + 1 ? null : { before: w.group },
  }))
  const last = items.length - 1
  gaps.push({ index: items[last].last, edge: 'end', target: last === source ? null : { after: items[last].group } })
  return { rows: [dragged.first, dragged.last], gaps }
}
