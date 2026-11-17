import { describe, expect, it } from 'vitest'
import type { IStageInfo } from '../cpp-basic/types'
import { RECORDS_GROUP, computeStageEfficiencies, eliteSeries, groupByMaterial } from './stageEfficiency'

type Drops = Record<string, [drops: number, samples: number]>

const stage = (id: string, ap: number, dropInfo: Drops, sortKey = id) =>
  ({ id, sortKey, ap, dropInfo }) as unknown as IStageInfo

const VALUES: Record<string, number> = {
  '4001': 0.004,
  '2001': 0.8,
  '2002': 1.6,
  '2003': 4,
  '2004': 8,
  '30011': 1,
  '30012': 3,
  '30013': 10,
  '30014': 40,
  '3221': 18, // 近卫芯片
  '3261': 18, // 医疗芯片
  '31043': 20, // 半自然溶剂
  '30063': 25, // 全新装置
}

function compute(stages: IStageInfo[], minSamples = 500, values: Record<string, number> = VALUES) {
  return computeStageEfficiencies({
    stages: Object.fromEntries(stages.map((x) => [x.id, x])),
    valueOf: (id) => values[id],
    isRecord: (id) => /^200[1-4]$/.test(id),
    minSamples,
  })
}

const one = (s: IStageInfo, minSamples?: number, values?: Record<string, number>) =>
  compute([s], minSamples, values).get(s.id)!

describe('computeStageEfficiencies', () => {
  it('sums the value of every expected drop, gold and records included', () => {
    const e = one(stage('a', 10, { '4001': [120, Infinity], '30013': [500, 1000], '2001': [2000, 1000] }))
    // 120 × 0.004 + 0.5 × 10 + 2 × 0.8
    expect(e.value).toBeCloseTo(0.48 + 5 + 1.6)
    expect(e.efficiency).toBeCloseTo(0.708)
    expect(e.drops.map((x) => [x.itemId, x.quantity])).toEqual([
      ['30013', 0.5],
      ['2001', 2],
      ['4001', 120],
    ])
  })

  it('takes hand-written drops as they are', () => {
    const e = one(stage('ce', 30, { '4001': [7500, Infinity] }))
    expect(e.value).toBeCloseTo(30)
    expect(e.efficiency).toBeCloseTo(1)
    expect(e.samples).toBeUndefined()
  })

  it('counts an item without a value as zero', () => {
    const e = one(stage('a', 10, { act_token: [1000, 100], '30013': [100, 100] }))
    expect(e.value).toBeCloseTo(10)
    expect(e.drops.find((x) => x.itemId === 'act_token')!.value).toBe(0)
  })

  it('leaves the efficiency out for a stage without sanity cost', () => {
    const e = one(stage('free', 0, { '30013': [100, 1000] }))
    expect(e.efficiency).toBeUndefined()
    expect(e.ranked).toBe(false)
  })

  describe('low samples', () => {
    it('takes the largest sample count among the drops and compares it to the threshold', () => {
      const drops: Drops = { '30013': [10, 499], '30012': [10, 300], '4001': [72, Infinity] }
      const below = one(stage('a', 6, drops))
      expect(below.samples).toBe(499)
      expect(below.lowSample).toBe(true)
      expect(below.ranked).toBe(false)
      const at = one(stage('a', 6, { ...drops, '30013': [10, 500] }))
      expect(at.lowSample).toBe(false)
      expect(at.ranked).toBe(true)
    })

    it('never marks hand-written drops', () => {
      const e = one(stage('ls', 30, { '2004': [4, Infinity], '2003': [2, Infinity] }), 1e9)
      expect(e.samples).toBeUndefined()
      expect(e.lowSample).toBe(false)
    })
  })

  describe('main drop', () => {
    it('is the only valued material', () => {
      const e = one(stage('a', 6, { '30013': [100, 1000], '4001': [72, Infinity] }))
      expect(e.mainDrop).toBe('30013')
      expect(e.groups).toEqual(['30013'])
    })

    it('puts drops within 90% of the best in their groups too', () => {
      const e = one(stage('pr', 18, { '3221': [500, 1000], '3261': [500, 1000], '30012': [2800, 1000] }))
      expect(e.mainDrop).toBe('3221')
      expect(e.groups).toEqual(['3221', '3261', '30013'])
      const below = one(stage('pr', 18, { '3221': [500, 1000], '3261': [440, 1000] }))
      expect(below.groups).toEqual(['3221'])
    })

    it('files the tiers of an elite series under its third tier', () => {
      expect(eliteSeries('30012')).toBe('30013')
      expect(eliteSeries('30014')).toBe('30013')
      expect(eliteSeries('31044')).toBe('31043')
      expect(eliteSeries('30115')).toBe('30115')
      expect(eliteSeries('3221')).toBe('3221')
      const e = one(stage('a', 6, { '30014': [100, 1000], '30012': [1400, 1000] }))
      expect(e.mainDrop).toBe('30012')
      expect(e.groups).toEqual(['30013'])
    })

    it('falls back to gold when a stage drops only gold', () => {
      const e = one(stage('ce', 30, { '4001': [7500, Infinity] }))
      expect(e.mainDrop).toBe('4001')
      expect(e.groups).toEqual(['4001'])
      expect(e.topDrops.map((x) => x.itemId)).toEqual(['4001'])
    })

    it('falls back to records when they are worth at least the gold', () => {
      const e = one(stage('ls', 30, { '2004': [4, Infinity], '2003': [2, Infinity], '4001': [360, Infinity] }))
      expect(e.mainDrop).toBe(RECORDS_GROUP)
      expect(e.groups).toEqual([RECORDS_GROUP])
    })

    it('has none when nothing has a value', () => {
      const e = one(stage('a', 6, { '30013': [100, 1000], '4001': [72, Infinity] }), 500, {})
      expect(e.value).toBe(0)
      expect(e.mainDrop).toBeUndefined()
      expect(e.groups).toEqual([])
      expect(e.topDrops).toEqual([])
    })

    it('keeps gold and records out of the top drops while there are materials', () => {
      const e = one(
        stage('a', 6, {
          '4001': [72000, Infinity],
          '2004': [1000, 1000],
          '30011': [100, 1000],
          '30012': [100, 1000],
          '30013': [100, 1000],
          '30014': [100, 1000],
        }),
      )
      expect(e.topDrops.map((x) => x.itemId)).toEqual(['30014', '30013', '30012'])
    })
  })
})

describe('groupByMaterial', () => {
  const sortIds: Record<string, string> = { '30013': '1', '31043': '2', '30063': '3', '4001': '9' }
  const sortIdOf = (id: string) => sortIds[id] ?? id

  it('orders groups by their best efficiency, then by warehouse order', () => {
    const groups = groupByMaterial(
      compute([
        // 1.2
        stage('event', 10, { '31043': [600, 1000] }),
        // 1.0, and 30063 ties at 1.0 one rounding error below
        stage('main', 10, { '30013': [1000, 1000] }),
        stage('other', 25, { '30063': [999999, 1000000] }),
        // 0.9
        stage('ce', 10, { '4001': [2250, Infinity] }),
      ]),
      sortIdOf,
    )
    expect(groups.map((x) => x.itemId)).toEqual(['31043', '30013', '30063', '4001'])
    expect(groups[0].best).toBeCloseTo(1.2)
  })

  it('keeps low-sample stages out of the best efficiency and puts them last', () => {
    const groups = groupByMaterial(
      compute([
        stage('few', 10, { '30013': [200, 100] }), // 2.0, but 100 samples
        stage('b', 10, { '30013': [900, 1000] }, '2'),
        stage('a', 10, { '30013': [900, 1000] }, '1'),
        stage('c', 10, { '30013': [1000, 1000] }),
      ]),
      sortIdOf,
    )
    expect(groups).toEqual([{ itemId: '30013', stageIds: ['c', 'a', 'b', 'few'], best: expect.closeTo(1) }])
  })

  it('leaves the best efficiency empty when no stage counts, and puts the group last', () => {
    const groups = groupByMaterial(
      compute([stage('few', 10, { '31043': [600, 100] }), stage('main', 10, { '30013': [100, 1000] })]),
      sortIdOf,
    )
    expect(groups.map((x) => [x.itemId, x.best])).toEqual([
      ['30013', expect.closeTo(0.1)],
      ['31043', undefined],
    ])
  })
})
