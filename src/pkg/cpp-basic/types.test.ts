import { describe, expect, it } from 'vitest'
import '../testing/mockLocalforage'
import { BasicStageInfo } from './types'

class TestStage extends BasicStageInfo {
  public id = 's1'
  public code = '1-1'
  public name = 'Test'
  public zoneId = 'z1'
}

const makeGa = () =>
  ({
    getExpItemValue: (key: string) => (key === 'e' ? [2, '##EXP'] : undefined),
  }) as any

describe('BasicStageInfo', () => {
  it('accumulates drop data', () => {
    const stage = new TestStage(makeGa())
    stage.addDrop('a', 1, 2)
    stage.addDrop('a', 2, 3)
    expect(stage.dropInfo).toEqual({ a: [3, 5] })
  })

  it('throws when mixing infinite and finite samples', () => {
    const stage = new TestStage(makeGa())
    stage.addDrop('a', 1)
    expect(() => stage.addDrop('a', 2, 3)).toThrow(/Cannot mix/)
  })

  it('computes varRow with ap and exp item conversion', () => {
    const stage = new TestStage(makeGa())
    stage.setAp(10)
    stage.addDrop('a', 1, 2)
    stage.addDrop('e', 3, 1)
    stage.addDrop('x', 4)
    expect(stage.varRow).toEqual({ ap: 10, 'item:a': 0.5, 'item:##EXP': 6, 'item:x': 4 })
  })

  it('keeps the default drop order and invalidates caches on changes', () => {
    const stage = new TestStage(makeGa())
    stage.addDrop('a', 1, 2)
    stage.addDrop('e', 3, 1)
    expect(stage.sortedDropInfo).toEqual([
      ['a', 1, 2],
      ['e', 3, 1],
    ])

    stage.addDrop('b', 2, 3)
    expect(stage.sortedDropInfo.map((x) => x[0])).toEqual(['a', 'e', 'b'])
    expect(stage.varRow.ap).toBe(0)

    stage.setAp(20)
    expect(stage.varRow.ap).toBe(20)
  })
})
