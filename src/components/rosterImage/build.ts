import type { ICharacter } from '../../pkg/cpp-basic'
import {
  AVATAR_SIZE,
  CELL_GAP,
  COLUMN_GAP,
  COLUMN_HEAD_HEIGHT,
  FOOTER_LINE1_HEIGHT,
  FOOTER_LINE1_SIZE,
  FOOTER_LINE2_SIZE,
  FOOTER_LOGO,
  FOOTER_LOGO_GAP,
  FOOTER_RULE,
  FOOTER_SPACE_ABOVE,
  FOOTER_SPACE_BELOW,
  FOOTER_ROW,
  FOOTER_TEXT_GAP,
  MARGIN,
  NAME_WIDTH,
  QR_SIZE,
  ROW_HEIGHT,
  RosterOrder,
  cellOrigin,
  sheetSize,
} from './layout'
import { RosterImagePainter, Scene, SceneNode, sceneFont } from './scene'
import { SITE_QR, qrPath } from './siteQr'

/** 一名干员，按列表的 CharacterMenu 从 store 现取 */
export interface RosterEntry {
  key: string
  character: ICharacter
  current: unknown
  goal: unknown
  /** 目标和当前相同：没定目标 */
  goalSame: boolean
  /** 未持有 */
  absent: boolean
  /** 练满了 */
  finished: boolean
}

export interface RosterOptions {
  columns: number
  order: RosterOrder
  goal: boolean
  header: string
  footer: boolean
}

/** 图上的几句字，由对话框翻译好传入 */
export interface RosterTexts {
  footer: string
  current: string
  goal: string
}

/** 量字：canvas 的 measureText；font 是 canvas 的 font 简写 */
export type Measure = (text: string, font: string) => number

// 图的配色固定，不跟深色模式：分享出去的图不该随看图的人的设置变
export const ROSTER_COLORS = {
  background: '#ffffff',
  name: '#1c2127',
  muted: '#5f6b7c',
  footer: '#1c2127',
  rule: '#e5e8eb',
} as const

export const FOOTER_LOGO_URL = '/favicon.png'
/** 页脚第二行，不翻译 */
export const FOOTER_SITE_TEXT = 'cpp.orz.tools'

const ELLIPSIS = '…'

/** 列表的行按次序去重：展开子查询的视图里一名干员只画第一次出现的那行；取不到的跳过 */
export function rosterEntries(keys: readonly string[], read: (key: string) => RosterEntry | undefined): RosterEntry[] {
  const seen = new Set<string>()
  const result: RosterEntry[] = []
  for (const key of keys) {
    if (seen.has(key)) continue
    seen.add(key)
    const entry = read(key)
    if (entry) result.push(entry)
  }
  return result
}

/** 超过 maxWidth 时截断加「…」：在码点前缀的长度上二分，不切开代理对 */
export function fitText(text: string, font: string, maxWidth: number, measure: Measure): string {
  if (measure(text, font) <= maxWidth) return text
  const chars = Array.from(text)
  let lo = 0
  let hi = chars.length - 1
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2)
    if (measure(chars.slice(0, mid).join('') + ELLIPSIS, font) <= maxWidth) lo = mid
    else hi = mid - 1
  }
  return chars.slice(0, lo).join('').trimEnd() + ELLIPSIS
}

const NAME_SIZE = 14
const APPELLATION_SIZE = 12
const HEADER_SIZE = 24
const COLUMN_HEAD_SIZE = 12

export function buildRosterScene(
  entries: readonly RosterEntry[],
  options: RosterOptions,
  painter: RosterImagePainter,
  measure: Measure,
  texts: RosterTexts,
): Scene {
  const header = options.header.trim()
  const sheet = sheetSize({
    n: entries.length,
    columns: options.columns,
    order: options.order,
    statusWidth: painter.statusWidth,
    goal: options.goal,
    header: !!header,
    footer: options.footer,
  })
  const nodes: SceneNode[] = []
  const statusLeft = AVATAR_SIZE + CELL_GAP + NAME_WIDTH + CELL_GAP
  const goalLeft = statusLeft + painter.statusWidth + CELL_GAP
  const statusTop = (ROW_HEIGHT - painter.statusHeight) / 2

  if (header) {
    const font = { size: HEADER_SIZE, bold: true }
    nodes.push({
      kind: 'text',
      x: MARGIN,
      y: MARGIN + 30,
      text: fitText(header, sceneFont(font), sheet.width - MARGIN * 2, measure),
      ...font,
      fill: ROSTER_COLORS.name,
    })
  }

  if (options.goal) {
    const y = sheet.gridTop - COLUMN_HEAD_HEIGHT + 14
    for (let col = 0; col < sheet.grid.cols; col++) {
      const x = MARGIN + col * (sheet.cellWidth + COLUMN_GAP)
      for (const [dx, text] of [
        [statusLeft, texts.current],
        [goalLeft, texts.goal],
      ] as const) {
        nodes.push({ kind: 'text', x: x + dx, y, text, size: COLUMN_HEAD_SIZE, fill: ROSTER_COLORS.muted })
      }
    }
  }

  entries.forEach((entry, i) => {
    const { x, y } = cellOrigin(sheet, i)
    const { character } = entry
    const cell: SceneNode[] = [
      {
        kind: 'group',
        x: 0,
        y: (ROW_HEIGHT - AVATAR_SIZE) / 2,
        w: AVATAR_SIZE,
        h: AVATAR_SIZE,
        children: painter.avatar(character, entry.current, entry.absent),
      },
    ]

    // 看图软件的字体更宽时也不出界：截好的字外面再裁到名字那一栏
    const nameFont = { size: NAME_SIZE, bold: true }
    const subFont = { size: APPELLATION_SIZE }
    const sub = character.appellation ? fitText(character.appellation, sceneFont(subFont), NAME_WIDTH, measure) : ''
    cell.push({
      kind: 'group',
      x: AVATAR_SIZE + CELL_GAP,
      y: 0,
      w: NAME_WIDTH,
      h: ROW_HEIGHT,
      clip: true,
      children: [
        {
          kind: 'text',
          x: 0,
          y: sub ? 20 : 29,
          text: fitText(character.name, sceneFont(nameFont), NAME_WIDTH, measure),
          ...nameFont,
          fill: ROSTER_COLORS.name,
        },
        ...(sub
          ? [{ kind: 'text', x: 0, y: 36, text: sub, ...subFont, fill: ROSTER_COLORS.muted } satisfies SceneNode]
          : []),
      ],
    })

    cell.push({
      kind: 'group',
      x: statusLeft,
      y: statusTop,
      w: painter.statusWidth,
      h: painter.statusHeight,
      ...(entry.absent ? { opacity: 0.25 } : null),
      children: painter.status(entry.current, character),
    })

    // 列表里练满了的、没定目标的目标格画成影子，提示「这里能点」；图上用不着，留空
    if (options.goal && !entry.finished && !entry.goalSame) {
      cell.push({
        kind: 'group',
        x: goalLeft,
        y: statusTop,
        w: painter.statusWidth,
        h: painter.statusHeight,
        children: painter.status(entry.goal, character, entry.current),
      })
    }

    nodes.push({ kind: 'group', x, y, w: sheet.cellWidth, h: ROW_HEIGHT, children: cell })
  })

  if (options.footer) {
    const ruleTop = sheet.gridBottom + FOOTER_SPACE_ABOVE
    nodes.push({
      kind: 'rect',
      x: MARGIN,
      y: ruleTop,
      w: sheet.contentRight - MARGIN,
      h: FOOTER_RULE,
      fill: ROSTER_COLORS.rule,
    })
    const rowTop = ruleTop + FOOTER_RULE + FOOTER_SPACE_BELOW
    const blockTop = rowTop + (FOOTER_ROW - FOOTER_LOGO) / 2
    const textLeft = MARGIN + FOOTER_LOGO + FOOTER_LOGO_GAP
    const qrLeft = sheet.contentRight - QR_SIZE
    const line1 = { size: FOOTER_LINE1_SIZE }
    const line2 = { size: FOOTER_LINE2_SIZE }
    const textWidth = qrLeft - FOOTER_TEXT_GAP - textLeft
    nodes.push(
      {
        kind: 'image',
        x: MARGIN,
        y: blockTop,
        w: FOOTER_LOGO,
        h: FOOTER_LOGO,
        image: { asset: FOOTER_LOGO_URL },
      },
      {
        kind: 'text',
        x: textLeft,
        y: blockTop + 14,
        text: fitText(texts.footer, sceneFont(line1), textWidth, measure),
        ...line1,
        fill: ROSTER_COLORS.footer,
      },
      {
        kind: 'text',
        x: textLeft,
        y: blockTop + FOOTER_LINE1_HEIGHT + 12,
        text: fitText(FOOTER_SITE_TEXT, sceneFont(line2), textWidth, measure),
        ...line2,
        fill: ROSTER_COLORS.muted,
      },
      {
        kind: 'path',
        x: qrLeft,
        y: rowTop,
        d: qrPath(SITE_QR, QR_SIZE / SITE_QR.length),
        fill: ROSTER_COLORS.footer,
      },
    )
  }

  return { width: sheet.width, height: sheet.height, background: ROSTER_COLORS.background, nodes }
}
