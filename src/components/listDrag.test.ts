import { describe, expect, it } from 'vitest'
import { DropGap, autoScrollStep, gapY, listGaps, nearestGap } from './listDrag'

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
    expect(listGaps(keys, 0)).toEqual([
      { index: 0, edge: 'start', target: null },
      { index: 1, edge: 'start', target: null },
      { index: 2, edge: 'start', target: { before: 'c' } },
      { index: 2, edge: 'end', target: { after: 'c' } },
    ])
  })

  it('keeps a middle row in place at its own edges', () => {
    expect(listGaps(keys, 1)).toEqual([
      { index: 0, edge: 'start', target: { before: 'a' } },
      { index: 1, edge: 'start', target: null },
      { index: 2, edge: 'start', target: null },
      { index: 2, edge: 'end', target: { after: 'c' } },
    ])
  })

  it('keeps the last row in place at its own edges', () => {
    expect(listGaps(keys, 2)).toEqual([
      { index: 0, edge: 'start', target: { before: 'a' } },
      { index: 1, edge: 'start', target: { before: 'b' } },
      { index: 2, edge: 'start', target: null },
      { index: 2, edge: 'end', target: null },
    ])
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
