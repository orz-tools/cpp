import { describe, expect, it } from 'vitest'
import {
  AREA_CAPS,
  FOOTER_HEIGHT,
  MAX_SIDE,
  cellOrigin,
  cellWidth,
  gridCells,
  pngPixels,
  pngScale,
  sheetSize,
} from './layout'

const positions = (n: number, columns: number, order: 'rows' | 'columns') => {
  const g = gridCells(n, columns, order)
  return { cols: g.cols, rows: g.rows, at: Array.from({ length: n }, (_, i) => g.at(i)) }
}

const ARKNIGHTS_STATUS_WIDTH = 260

describe('gridCells', () => {
  it('puts one character a row in one column', () => {
    expect(positions(3, 1, 'rows')).toEqual({
      cols: 1,
      rows: 3,
      at: [
        { row: 0, col: 0 },
        { row: 1, col: 0 },
        { row: 2, col: 0 },
      ],
    })
    expect(positions(3, 1, 'columns')).toEqual(positions(3, 1, 'rows'))
  })

  it('fills a row first when ordered by rows', () => {
    const g = positions(5, 2, 'rows')
    expect([g.cols, g.rows]).toEqual([2, 3])
    expect(g.at).toEqual([
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 1, col: 0 },
      { row: 1, col: 1 },
      { row: 2, col: 0 },
    ])
  })

  it('fills a column first when ordered by columns, without an empty column', () => {
    const five = positions(5, 4, 'columns')
    expect([five.cols, five.rows]).toEqual([3, 2])
    expect(five.at).toEqual([
      { row: 0, col: 0 },
      { row: 1, col: 0 },
      { row: 0, col: 1 },
      { row: 1, col: 1 },
      { row: 0, col: 2 },
    ])

    const eight = positions(8, 3, 'columns')
    expect([eight.cols, eight.rows]).toEqual([3, 3])
    expect(eight.at.map((x) => `${x.row}${x.col}`)).toEqual(['00', '10', '20', '01', '11', '21', '02', '12'])
  })

  it('narrows the columns to the characters when ordered by rows', () => {
    expect(positions(2, 4, 'rows')).toMatchObject({ cols: 2, rows: 1 })
  })
})

describe('sheetSize', () => {
  const base = { n: 4, columns: 1, order: 'rows' as const, statusWidth: 100, goal: false, header: false, footer: false }

  it('widens a cell by the goal', () => {
    expect(cellWidth(100, false)).toBe(40 + 8 + 120 + 8 + 100)
    expect(cellWidth(100, true)).toBe(40 + 8 + 120 + 8 + 100 + 8 + 100)
  })

  it('adds the header, the column heads and the footer to the height', () => {
    expect(sheetSize(base).height).toBe(16 * 2 + 4 * 48)
    expect(sheetSize({ ...base, header: true }).height).toBe(16 * 2 + 48 + 4 * 48)
    expect(sheetSize({ ...base, goal: true }).height).toBe(16 * 2 + 20 + 4 * 48)
    expect(sheetSize({ ...base, footer: true }).height).toBe(16 * 2 + 4 * 48 + 93)
    expect(FOOTER_HEIGHT).toBe(93)
  })

  it('lays the columns out with a gap', () => {
    const sheet = sheetSize({ ...base, columns: 3 })
    expect(sheet.width).toBe(16 * 2 + 3 * cellWidth(100, false) + 2 * 24)
    expect(sheet.contentRight).toBe(sheet.width - 16)
    expect(cellOrigin(sheet, 0)).toEqual({ x: 16, y: 16 })
    expect(cellOrigin(sheet, 2)).toEqual({ x: 16 + 2 * (cellWidth(100, false) + 24), y: 16 })
    expect(cellOrigin(sheet, 3)).toEqual({ x: 16, y: 16 + 48 })
  })

  it('starts the grid under the header and the column heads', () => {
    const sheet = sheetSize({ ...base, header: true, goal: true })
    expect(sheet.gridTop).toBe(16 + 48 + 20)
    expect(sheet.gridBottom).toBe(16 + 48 + 20 + 4 * 48)
  })

  it('matches the estimate for a 70-operator list', () => {
    const sheet = sheetSize({ ...base, n: 70, statusWidth: ARKNIGHTS_STATUS_WIDTH, footer: true })
    const scale = pngScale(sheet.width, sheet.height, AREA_CAPS[0])
    expect(scale).toBe(2)
    expect(pngPixels(sheet.width, sheet.height, scale)).toEqual({ width: 936, height: 6970 })
  })
})

describe('pngScale', () => {
  it('is 2 for a small image', () => {
    expect(pngScale(468, 1000, AREA_CAPS[0])).toBe(2)
  })

  it('shrinks by the long side and by the area', () => {
    const long = pngScale(100, 20000, AREA_CAPS[0])
    expect(long).toBe(Math.floor((MAX_SIDE / 20000) * 100) / 100)

    const wide = pngScale(4000, 4000, AREA_CAPS[1])
    expect(wide).toBe(1.02)
  })

  it('never goes over the caps once multiplied back', () => {
    for (const [w, h] of [
      [468, 16925],
      [736, 20305],
      [5000, 5000],
      [3000, 31000],
      [7777, 1234],
    ]) {
      for (const cap of AREA_CAPS) {
        const px = pngPixels(w, h, pngScale(w, h, cap))
        expect(px.width * px.height).toBeLessThanOrEqual(cap)
        expect(Math.max(px.width, px.height)).toBeLessThanOrEqual(MAX_SIDE)
      }
    }
  })

  it('matches the estimates for long lists', () => {
    const at = (n: number, goal: boolean) =>
      sheetSize({
        n,
        columns: 1,
        order: 'rows',
        statusWidth: ARKNIGHTS_STATUS_WIDTH,
        goal,
        header: false,
        footer: true,
      })

    // 三百五十名、不带目标：约 468 × 16,930
    const a = at(350, false)
    expect(a.width).toBe(468)
    expect(pngScale(a.width, a.height, AREA_CAPS[0])).toBe(1.93)
    expect(pngScale(a.width, a.height, AREA_CAPS[1])).toBe(1.45)

    // 四百二十名、带目标：约 736 × 20,300
    const b = at(420, true)
    expect(b.width).toBe(736)
    expect(pngScale(b.width, b.height, AREA_CAPS[0])).toBe(1.49)
    expect(pngScale(b.width, b.height, AREA_CAPS[1])).toBe(1.05)
  })
})
