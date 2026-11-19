import { describe, expect, it } from 'vitest'
import { DropGap, autoScrollStep, gapY, gatherTargets, inRanges, listGaps, nearestGap } from './listDrag'

const rows = [
  { start: 0, end: 50 },
  { start: 50, end: 100 },
  { start: 100, end: 150 },
]

describe('gapY', () => {
  it("reads a row's top or bottom, moved down by the offset", () => {
    expect(gapY({ index: 1, edge: 'start', target: null }, rows)).toBe(50)
    expect(gapY({ index: 1, edge: 'end', target: null }, rows)).toBe(100)
    expect(gapY({ index: 1, edge: 'start', offset: 30, target: null }, rows)).toBe(80)
  })
})

describe('nearestGap', () => {
  const gaps: DropGap<string>[] = [
    { index: 0, edge: 'start', target: 'a' },
    { index: 1, edge: 'start', target: 'b' },
    { index: 2, edge: 'end', target: 'c' },
  ]

  it('takes the closest gap', () => {
    expect(nearestGap(gaps, rows, 10)?.target).toBe('a')
    expect(nearestGap(gaps, rows, 60)?.target).toBe('b')
    expect(nearestGap(gaps, rows, 140)?.target).toBe('c')
  })

  it('takes the earlier of two gaps the same distance away', () => {
    expect(nearestGap(gaps, rows, 25)?.target).toBe('a')
  })

  it('skips gaps on rows that are not measured', () => {
    expect(nearestGap(gaps, rows.slice(0, 2), 140)?.target).toBe('b')
  })
})

describe('listGaps', () => {
  const keys = ['a', 'b', 'c']

  it('keeps the first row in place at its own edges', () => {
    expect(listGaps(keys, new Set([keys[0]]))).toEqual([
      { index: 0, edge: 'start', target: null },
      { index: 1, edge: 'start', target: null },
      { index: 2, edge: 'start', target: { before: 'c' } },
      { index: 2, edge: 'end', target: { after: 'c' } },
    ])
  })

  it('keeps a middle row in place at its own edges', () => {
    expect(listGaps(keys, new Set([keys[1]]))).toEqual([
      { index: 0, edge: 'start', target: { before: 'a' } },
      { index: 1, edge: 'start', target: null },
      { index: 2, edge: 'start', target: null },
      { index: 2, edge: 'end', target: { after: 'c' } },
    ])
  })

  it('keeps the last row in place at its own edges', () => {
    expect(listGaps(keys, new Set([keys[2]]))).toEqual([
      { index: 0, edge: 'start', target: { before: 'a' } },
      { index: 1, edge: 'start', target: { before: 'b' } },
      { index: 2, edge: 'start', target: null },
      { index: 2, edge: 'end', target: null },
    ])
  })

  it('has nowhere to go for the only row', () => {
    expect(listGaps(['a'], new Set(['a'])).some((gap) => gap.target !== null)).toBe(false)
  })

  it('has no gaps without rows', () => {
    expect(listGaps([], new Set(['a']))).toEqual([])
  })

  // 期望照收拢以前只拖一行的 listGaps 手写：单行拖动不能因为改成收拢而变
  it('keeps the rule of dragging one row', () => {
    for (const keys of [
      ['a', 'b'],
      ['a', 'b', 'c', 'd', 'e'],
      ['p', 'q', 'r', 's', 't', 'u', 'v'],
    ]) {
      const last = keys.length - 1
      keys.forEach((key, source) => {
        expect(listGaps(keys, new Set([key]))).toEqual([
          ...keys.map((k, i) => ({
            index: i,
            edge: 'start',
            target: i === source || i === source + 1 ? null : { before: k },
          })),
          { index: last, edge: 'end', target: source === last ? null : { after: keys[last] } },
        ])
      })
    }
  })
})

describe('gatherTargets', () => {
  const keys = ['a', 'b', 'c', 'd']

  it('stays put at the edges of the one being moved', () => {
    expect(gatherTargets(keys, new Set(['b']))).toEqual([{ before: 'a' }, null, null, { before: 'd' }, { after: 'd' }])
  })

  it('stays put around a run and inside it', () => {
    expect(gatherTargets(keys, new Set(['b', 'c']))).toEqual([{ before: 'a' }, null, null, null, { after: 'd' }])
  })

  it('moves keys apart anywhere, since gathering them changes the order', () => {
    expect(gatherTargets(keys, new Set(['a', 'c']))).toEqual([
      { before: 'b' },
      { before: 'b' },
      { before: 'd' },
      { before: 'd' },
      { after: 'd' },
    ])
  })

  it('has nowhere to go with every key moving', () => {
    expect(gatherTargets(keys, new Set(keys))).toEqual([null, null, null, null, null])
  })

  it('goes by the keys it is given only', () => {
    expect(gatherTargets(keys, new Set(['b', 'x']))).toEqual(gatherTargets(keys, new Set(['b'])))
  })
})

describe('inRanges', () => {
  const ranges = [
    [1, 1],
    [3, 5],
  ] as const

  it('takes in both ends of a range', () => {
    expect([1, 3, 4, 5].map((i) => inRanges(ranges, i))).toEqual([true, true, true, true])
  })

  it('leaves out what is outside every range', () => {
    expect([0, 2, 6].map((i) => inRanges(ranges, i))).toEqual([false, false, false])
  })
})

describe('autoScrollStep', () => {
  const top = 100
  const bottom = 500

  it('does not scroll away from the edges', () => {
    expect(autoScrollStep(140, top, bottom)).toBe(0)
    expect(autoScrollStep(300, top, bottom)).toBe(0)
    expect(autoScrollStep(460, top, bottom)).toBe(0)
  })

  it('scrolls fastest against an edge', () => {
    expect(autoScrollStep(100, top, bottom)).toBe(-20)
    expect(autoScrollStep(500, top, bottom)).toBe(20)
  })

  it('scrolls faster the closer it gets', () => {
    const up = [139, 130, 120, 110, 101].map((y) => -autoScrollStep(y, top, bottom))
    const down = [461, 470, 480, 490, 499].map((y) => autoScrollStep(y, top, bottom))
    for (const speeds of [up, down]) {
      expect(speeds[0]).toBeGreaterThan(0)
      for (let i = 1; i < speeds.length; i++) expect(speeds[i]).toBeGreaterThanOrEqual(speeds[i - 1])
    }
  })

  it('scrolls as against the edge outside the container', () => {
    expect(autoScrollStep(40, top, bottom)).toBe(-20)
    expect(autoScrollStep(600, top, bottom)).toBe(20)
  })
})
