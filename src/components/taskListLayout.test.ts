import { describe, expect, it } from 'vitest'
import {
  TASK_HEADER_HEIGHT,
  charDragGaps,
  charDraggable,
  groupDragGaps,
  groupDraggable,
  layoutTasks,
} from './taskListLayout'

const tasks = (...charIds: string[]) => charIds.map((charId) => ({ charId }))

describe('layoutTasks', () => {
  it('starts a new run where the starred tasks end, even for the same operator', () => {
    const layout = layoutTasks(tasks('A', 'A', 'A', 'B'), 2)
    expect(layout.runs).toEqual([
      { charId: 'A', starred: true, first: 0, last: 1 },
      { charId: 'A', starred: false, first: 2, last: 2 },
      { charId: 'B', starred: false, first: 3, last: 3 },
    ])
    expect(layout.runOf).toEqual([0, 0, 1, 2])
  })

  it('runs the adjacent tasks of an operator together without stars', () => {
    expect(layoutTasks(tasks('A', 'A', 'B', 'C', 'C'), 0).runs).toEqual([
      { charId: 'A', starred: false, first: 0, last: 1 },
      { charId: 'B', starred: false, first: 2, last: 2 },
      { charId: 'C', starred: false, first: 3, last: 4 },
    ])
  })
})

describe('charDragGaps', () => {
  // 星标段 A B，其余段 A C D
  const layout = layoutTasks(tasks('A', 'B', 'A', 'A', 'C', 'D'), 2)

  it("offers only the dragged run's segment, with the run's own edges as staying put", () => {
    expect(charDragGaps(layout, 3)).toEqual([
      { index: 2, edge: 'start', target: { before: 'A' } },
      { index: 4, edge: 'start', target: null },
      { index: 5, edge: 'start', target: null },
      { index: 5, edge: 'end', target: { after: 'D' } },
    ])
  })

  it('stays put at the end of the segment for its last run', () => {
    expect(charDragGaps(layout, 4).slice(-1)).toEqual([{ index: 5, edge: 'end', target: null }])
  })

  it('keeps a drag in the starred segment out of the rest', () => {
    expect(charDragGaps(layout, 0)).toEqual([
      { index: 0, edge: 'start', target: null },
      { index: 1, edge: 'start', target: null },
      { index: 1, edge: 'end', target: { after: 'B' } },
    ])
  })
})

describe('charDraggable', () => {
  it('drags an operator only when its segment has another', () => {
    // 星标段只有 A，其余段 A B
    const layout = layoutTasks(tasks('A', 'A', 'B'), 1)
    expect(layout.runs.map((_, run) => charDraggable(layout, run))).toEqual([false, true, true])
  })

  it('drags nothing for the only operator in the list', () => {
    expect(charDraggable(layoutTasks(tasks('A', 'A'), 0), 0)).toBe(false)
  })

  it('agrees with whether the gaps have a target', () => {
    for (const layout of [layoutTasks(tasks('A', 'B', 'A', 'A', 'C', 'D'), 2), layoutTasks(tasks('A', 'A', 'B'), 1)]) {
      layout.runs.forEach((_, run) => {
        expect(charDraggable(layout, run)).toBe(charDragGaps(layout, run).some((gap) => gap.target !== null))
      })
    }
  })
})

describe('groupDragGaps', () => {
  // A：专精 s1 两级、精二、专精 s2 一级、模组 m 一级；B：一项专精
  const list = [
    { charId: 'A', group: 's1' },
    { charId: 'A', group: 's1' },
    { charId: 'A' },
    { charId: 'A', group: 's2' },
    { charId: 'A', group: 'm' },
    { charId: 'B', group: 'x' },
    { charId: 'B' },
  ]
  const layout = layoutTasks(list, 0)

  it("draws the line under the operator's row above the run's first item", () => {
    expect(groupDragGaps(list, layout, 3)?.gaps[0]).toEqual({
      index: 0,
      edge: 'start',
      offset: TASK_HEADER_HEIGHT,
      target: { before: 's1' },
    })
  })

  it('offers whole items, with a task between two items left out', () => {
    expect(groupDragGaps(list, layout, 1)).toEqual({
      rows: [0, 1],
      gaps: [
        { index: 0, edge: 'start', offset: TASK_HEADER_HEIGHT, target: null },
        { index: 3, edge: 'start', target: null },
        { index: 4, edge: 'start', target: { before: 'm' } },
        { index: 4, edge: 'end', target: { after: 'm' } },
      ],
    })
  })

  it('has nowhere else to go for the only item', () => {
    expect(groupDragGaps(list, layout, 5)).toEqual({
      rows: [5, 5],
      gaps: [
        { index: 5, edge: 'start', offset: TASK_HEADER_HEIGHT, target: null },
        { index: 5, edge: 'end', target: null },
      ],
    })
  })

  it('does not drag a task without a group', () => {
    expect(groupDragGaps(list, layout, 2)).toBeUndefined()
  })
})

describe('groupDraggable', () => {
  const list = [
    { charId: 'A', group: 's1' },
    { charId: 'A', group: 's1' },
    { charId: 'A' },
    { charId: 'A', group: 's2' },
    { charId: 'B', group: 'x' },
    { charId: 'B', group: 'x' },
    { charId: 'B' },
  ]
  const layout = layoutTasks(list, 0)

  it('drags an item only when its run has another', () => {
    expect(list.map((_, row) => groupDraggable(list, layout, row))).toEqual([
      true,
      true,
      false,
      true,
      false,
      false,
      false,
    ])
  })

  it('agrees with whether the gaps have a target', () => {
    list.forEach((_, row) => {
      const gaps = groupDragGaps(list, layout, row)?.gaps ?? []
      expect(groupDraggable(list, layout, row)).toBe(gaps.some((gap) => gap.target !== null))
    })
  })
})
