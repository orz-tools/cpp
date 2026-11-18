import { describe, expect, it, vi } from 'vitest'
import { Level } from '../Cpp'
import { itemCounterCells, itemCounterSlots } from './itemCounters'

// Cpp 导入时会创建 toaster，测试环境里没有 document
vi.mock('./Toaster', () => ({ AppToaster: new Promise(() => {}) }))

describe('itemCounterSlots', () => {
  it('shows the plan and the finished tiers without a view', () => {
    expect(itemCounterSlots(undefined)).toEqual([
      { level: Level.Goal, shown: true },
      { level: Level.Finished, shown: true },
    ])
  })

  it('puts the starred tier in the upper row of the starred view', () => {
    expect(itemCounterSlots(Level.Star)).toEqual([
      { level: Level.Star, shown: true },
      { level: Level.Finished, shown: false },
    ])
  })

  it('shows only the plan tier in the plan view', () => {
    expect(itemCounterSlots(Level.Goal)).toEqual([
      { level: Level.Goal, shown: true },
      { level: Level.Finished, shown: false },
    ])
  })

  it('shows only the finished tier in the finished view', () => {
    expect(itemCounterSlots(Level.Finished)).toEqual([
      { level: Level.Goal, shown: false },
      { level: Level.Finished, shown: true },
    ])
  })
})

describe('itemCounterCells', () => {
  it('caps what can be synthesized at the need', () => {
    expect(itemCounterCells(3, 5, 2, 10, true)).toEqual({
      afterSynthesis: { value: -2, strong: false },
      synthesizable: { value: 8, strong: true },
      remaining: { value: 6, strong: true },
      direct: { value: 3, strong: true },
      indirect: { value: 5, strong: true },
    })
  })

  it('fades every cell when the stock covers the need', () => {
    expect(itemCounterCells(2, 0, 5, 0, false)).toEqual({
      afterSynthesis: { value: -3, strong: false },
      synthesizable: { value: 0, strong: false },
      remaining: { value: -3, strong: false },
      direct: { value: 2, strong: false },
      indirect: { value: 0, strong: false },
    })
  })

  it('shows a forbidden recipe faded and does not subtract it after synthesis', () => {
    const cells = itemCounterCells(4, 0, 1, 3, false)
    expect(cells.afterSynthesis).toEqual({ value: 3, strong: true })
    expect(cells.synthesizable).toEqual({ value: 3, strong: false })
    expect(cells.remaining).toEqual({ value: 3, strong: true })
  })

  it('fades the direct need once the stock covers it', () => {
    const cells = itemCounterCells(2, 4, 3, 0, true)
    expect(cells.direct).toEqual({ value: 2, strong: false })
    expect(cells.indirect).toEqual({ value: 4, strong: true })
    expect(cells.remaining).toEqual({ value: 3, strong: true })
  })
})
