import { SITE_QR } from './siteQr'

/** 练度图的版面，尺寸都是 1 倍的 px */

export const MARGIN = 16
export const ROW_HEIGHT = 48
export const AVATAR_SIZE = 40
export const CELL_GAP = 8
export const NAME_WIDTH = 120
export const COLUMN_GAP = 24
export const HEADER_HEIGHT = 48
export const COLUMN_HEAD_HEIGHT = 20

export const QR_SIZE = 56
/** QR 码标准要求四周各留 4 格静区，这里取整到 px */
export const QR_QUIET = Math.ceil((QR_SIZE / SITE_QR.length) * 4)
/** 二维码连同四周静区的边长；深色配色在这块区域垫浅色底板 */
export const QR_PLATE = QR_SIZE + QR_QUIET * 2

// 页脚：最后一行格子下面空 20，画 1px 的分隔线，再空 16，然后是和二维码连同静区一样高的一行。
// 二维码不缩小：缩进 56 px 的话，1 倍的 PNG 上一格只剩 1.7 px，实测扫不出来。
// 浅色配色的白底本身就是静区，不画底板，但页脚留出同样的高度，这样换配色只改颜色，图的尺寸和各元素的位置都不变。
// 练度格的影子（列表的 0 3px 6px）往外最多伸出 12，最后一行下面的 20、底边的 16 和列间的 24 都容得下
export const FOOTER_SPACE_ABOVE = 20
export const FOOTER_RULE = 1
export const FOOTER_SPACE_BELOW = 16
export const FOOTER_ROW = QR_PLATE
export const FOOTER_HEIGHT = FOOTER_SPACE_ABOVE + FOOTER_RULE + FOOTER_SPACE_BELOW + FOOTER_ROW
// logo 比头像小一号、字也不加粗：页脚不该看起来像又一名干员
export const FOOTER_LOGO = 36
export const FOOTER_LOGO_GAP = 10
export const FOOTER_LINE1_SIZE = 13
export const FOOTER_LINE1_HEIGHT = 20
export const FOOTER_LINE2_SIZE = 12
export const FOOTER_LINE2_HEIGHT = 16
/** 页脚第一行和二维码的静区之间至少空这么多 */
export const FOOTER_TEXT_GAP = 16

/** rows 是先左右（一行排满再换行），columns 是先上下 */
export type RosterOrder = 'rows' | 'columns'

export interface GridCells {
  cols: number
  rows: number
  /** 第 i 名（从 0 数）在第几行、第几列 */
  at: (i: number) => { row: number; col: number }
}

/**
 * 先左右时列数缩到干员数；先上下时先定行数，再按行数算用到几列，不会空出一整列（5 名 4 列 → 2 行 3 列）
 */
export function gridCells(n: number, columns: number, order: RosterOrder): GridCells {
  const c = Math.max(1, Math.floor(columns))
  if (n <= 0) return { cols: 0, rows: 0, at: () => ({ row: 0, col: 0 }) }
  if (order === 'columns') {
    const rows = Math.ceil(n / c)
    const cols = Math.ceil(n / rows)
    return { cols, rows, at: (i) => ({ row: i % rows, col: Math.floor(i / rows) }) }
  }
  const cols = Math.min(c, n)
  const rows = Math.ceil(n / cols)
  return { cols, rows, at: (i) => ({ row: Math.floor(i / cols), col: i % cols }) }
}

/** 一格：头像、名字、当前练度，显示目标时再加目标练度 */
export function cellWidth(statusWidth: number, goal: boolean): number {
  return AVATAR_SIZE + CELL_GAP + NAME_WIDTH + CELL_GAP + statusWidth + (goal ? CELL_GAP + statusWidth : 0)
}

export interface SheetOptions {
  n: number
  columns: number
  order: RosterOrder
  statusWidth: number
  goal: boolean
  header: boolean
  footer: boolean
}

export interface Sheet {
  width: number
  height: number
  grid: GridCells
  cellWidth: number
  /** 第一行格子的顶 */
  gridTop: number
  /** 最后一行格子的底；页脚从这里往下排 */
  gridBottom: number
  /** 内容的右缘：最右一列练度格的右缘 */
  contentRight: number
}

export function sheetSize({ n, columns, order, statusWidth, goal, header, footer }: SheetOptions): Sheet {
  const grid = gridCells(n, columns, order)
  const cell = cellWidth(statusWidth, goal)
  const width = MARGIN * 2 + grid.cols * cell + Math.max(0, grid.cols - 1) * COLUMN_GAP
  const gridTop = MARGIN + (header ? HEADER_HEIGHT : 0) + (goal ? COLUMN_HEAD_HEIGHT : 0)
  const gridBottom = gridTop + grid.rows * ROW_HEIGHT
  const height = gridBottom + (footer ? FOOTER_HEIGHT : 0) + MARGIN
  return { width, height, grid, cellWidth: cell, gridTop, gridBottom, contentRight: width - MARGIN }
}

/** 第 i 名那一格的左上角 */
export function cellOrigin(sheet: Sheet, i: number): { x: number; y: number } {
  const { row, col } = sheet.grid.at(i)
  return { x: MARGIN + col * (sheet.cellWidth + COLUMN_GAP), y: sheet.gridTop + row * ROW_HEIGHT }
}

/**
 * iOS 上一张 canvas 最多 16,777,216 像素；先按两倍于它的面积试，建不起来再按它试。
 * 不靠 User-Agent 猜是不是 iOS
 */
export const AREA_CAPS = [33_554_432, 16_777_216] as const
/** Chrome、Firefox 上 canvas 一条边的上限 */
export const MAX_SIDE = 32_767
export const DEFAULT_SCALE = 2

/** 默认 2 倍；超过面积或长边上限时缩小，向下取到 0.01。分列只改形状、不改面积，所以面积上限不能靠分列绕开 */
export function pngScale(width: number, height: number, maxArea: number): number {
  const scale = Math.min(DEFAULT_SCALE, Math.sqrt(maxArea / (width * height)), MAX_SIDE / Math.max(width, height))
  return Math.max(0.01, Math.floor(scale * 100) / 100)
}

/** PNG 的像素宽高 */
export function pngPixels(width: number, height: number, scale: number): { width: number; height: number } {
  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}
