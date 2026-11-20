import { describe, expect, it, vi } from 'vitest'
import type { ICharacter } from '../../pkg/cpp-basic'
import {
  FOOTER_LOGO_URL,
  FOOTER_SITE_TEXT,
  Measure,
  ROSTER_PALETTES,
  RosterEntry,
  RosterOptions,
  buildRosterScene,
  fitText,
  rosterEntries,
} from './build'
import { COLUMN_GAP, FOOTER_HEIGHT, QR_PLATE, QR_QUIET, QR_SIZE, cellWidth } from './layout'
import { RosterImagePainter, Scene, SceneNode, walkScene } from './scene'
import { SITE_QR, qrPath } from './siteQr'

/** 字数 × 字号 × 0.6 */
const measure: Measure = (text, font) => Array.from(text).length * Number(/(\d+)px/.exec(font)![1]) * 0.6

function painter() {
  return {
    statusWidth: 100,
    statusHeight: 42,
    avatar: vi.fn((c: ICharacter): SceneNode[] => [
      { kind: 'rect', x: 0, y: 0, w: 40, h: 40, fill: `avatar:${c.key}` },
    ]),
    status: vi.fn((s: { tag: string }, _c: ICharacter, current?: { tag: string }): SceneNode[] => [
      { kind: 'rect', x: 0, y: 0, w: 100, h: 42, fill: `status:${s.tag}${current ? `<${current.tag}` : ''}` },
    ]),
  } satisfies RosterImagePainter
}

function entry(key: string, extra: Partial<RosterEntry> = {}): RosterEntry {
  return {
    key,
    character: { key, name: `name-${key}`, appellation: `sub-${key}`, avatar: undefined, rarity: 5 },
    current: { tag: `${key}-current` },
    goal: { tag: `${key}-goal` },
    goalSame: false,
    absent: false,
    finished: false,
    ...extra,
  }
}

const texts = { footer: '练度图由 Closure++ 生成', current: '当前', goal: '目标' }
const options: RosterOptions = { columns: 1, order: 'rows', goal: false, header: '', footer: false, scheme: 'light' }

function all(scene: Scene): SceneNode[] {
  const nodes: SceneNode[] = []
  walkScene(scene.nodes, (n) => nodes.push(n))
  return nodes
}

const textsOf = (scene: Scene) => all(scene).flatMap((n) => (n.kind === 'text' ? [n.text] : []))
const fills = (scene: Scene) => all(scene).flatMap((n) => (n.kind === 'rect' ? [n.fill] : []))

/** 找到 fill 为 tag 的 rect 外面那一组 */
function groupAround(scene: Scene, tag: string): Extract<SceneNode, { kind: 'group' }> | undefined {
  let found: Extract<SceneNode, { kind: 'group' }> | undefined
  walkScene(scene.nodes, (n) => {
    if (n.kind === 'group' && n.children.some((c) => c.kind === 'rect' && c.fill === tag)) found = n
  })
  return found
}

describe('rosterEntries', () => {
  it('keeps the first row of each character in order and skips the ones it cannot read', () => {
    const read = (key: string) => (key === 'gone' ? undefined : entry(key))
    expect(rosterEntries(['b', 'a', 'b', 'gone', 'c', 'a'], read).map((x) => x.key)).toEqual(['b', 'a', 'c'])
  })
})

describe('fitText', () => {
  const font = '10px sans-serif'

  it('keeps text that fits', () => {
    expect(fitText('abcde', font, 30, measure)).toBe('abcde')
  })

  it('cuts text that does not fit and adds an ellipsis within the width', () => {
    const fitted = fitText('abcdefghij', font, 30, measure)
    expect(fitted).toBe('abcd…')
    expect(measure(fitted, font)).toBeLessThanOrEqual(30)
  })

  it('does not split a surrogate pair', () => {
    const fitted = fitText('😀😀😀😀😀😀', font, 20, measure)
    expect(fitted).toBe('😀😀…')
    expect(Array.from(fitted).every((c) => c === '😀' || c === '…')).toBe(true)
  })
})

describe('buildRosterScene', () => {
  it('cuts a long name with an ellipsis and clips the name column', () => {
    const long = entry('a', {
      character: { key: 'a', name: '很长很长很长很长很长很长的名字', appellation: '', avatar: undefined, rarity: 0 },
    })
    const scene = buildRosterScene([long], options, painter(), measure, texts)
    const name = textsOf(scene).find((t) => t.startsWith('很长'))!
    expect(name.endsWith('…')).toBe(true)
    expect(measure(name, 'bold 14px x')).toBeLessThanOrEqual(120)
    expect(all(scene).some((n) => n.kind === 'group' && n.clip && n.w === 120)).toBe(true)
  })

  it('draws the current cell of an absent character at 25%', () => {
    const scene = buildRosterScene([entry('a', { absent: true }), entry('b')], options, painter(), measure, texts)
    expect(groupAround(scene, 'status:a-current')?.opacity).toBe(0.25)
    expect(groupAround(scene, 'status:b-current')?.opacity).toBeUndefined()
  })

  it('leaves the goal cell empty for a finished character and one without a goal', () => {
    const p = painter()
    const scene = buildRosterScene(
      [entry('a', { finished: true }), entry('b', { goalSame: true }), entry('c')],
      { ...options, goal: true },
      p,
      measure,
      texts,
    )
    const drawn = fills(scene)
    expect(drawn).not.toContain('status:a-goal<a-current')
    expect(drawn).not.toContain('status:b-goal<b-current')
    expect(drawn).toContain('status:c-goal<c-current')
    expect(p.status).toHaveBeenCalledWith({ tag: 'c-goal' }, expect.anything(), { tag: 'c-current' })
  })

  it('has column heads and a wider cell only with goals', () => {
    const without = buildRosterScene([entry('a')], options, painter(), measure, texts)
    const withGoal = buildRosterScene([entry('a')], { ...options, goal: true }, painter(), measure, texts)
    expect(textsOf(without)).not.toContain('当前')
    expect(textsOf(withGoal).filter((t) => t === '当前' || t === '目标')).toEqual(['当前', '目标'])
    expect(withGoal.width - without.width).toBe(8 + 100)
    expect(withGoal.height - without.height).toBe(20)
  })

  it('writes one set of column heads a column', () => {
    const scene = buildRosterScene(
      [entry('a'), entry('b'), entry('c')],
      { ...options, goal: true, columns: 2 },
      painter(),
      measure,
      texts,
    )
    expect(textsOf(scene).filter((t) => t === '当前')).toHaveLength(2)
  })

  it('draws the header when there is one', () => {
    const scene = buildRosterScene([entry('a')], { ...options, header: '  博士的练度  ' }, painter(), measure, texts)
    expect(textsOf(scene)).toContain('博士的练度')
    const none = buildRosterScene([entry('a')], { ...options, header: '   ' }, painter(), measure, texts)
    expect(scene.height - none.height).toBe(48)
  })

  describe('footer', () => {
    const footerOn = { ...options, footer: true }
    const qr = (scene: Scene) => all(scene).find((n) => n.kind === 'path')

    it('draws the rule, the logo, two lines and the QR code', () => {
      const scene = buildRosterScene([entry('a')], footerOn, painter(), measure, texts)
      expect(fills(scene)).toContain('#e5e8eb')
      expect(
        all(scene).some((n) => n.kind === 'image' && 'asset' in n.image && n.image.asset === FOOTER_LOGO_URL),
      ).toBe(true)
      expect(textsOf(scene)).toEqual(expect.arrayContaining([texts.footer, FOOTER_SITE_TEXT]))
      expect(qr(scene)).toBeDefined()
    })

    it('lines the QR code up with the right edge of the content', () => {
      for (const columns of [1, 3]) {
        const scene = buildRosterScene(
          [entry('a'), entry('b'), entry('c')],
          { ...footerOn, columns },
          painter(),
          measure,
          texts,
        )
        const code = qr(scene)!
        expect(code.x + QR_SIZE).toBe(scene.width - 16)
        expect(code.y + QR_SIZE).toBe(scene.height - 16)
        const rule = all(scene).find((n) => n.kind === 'rect' && n.fill === '#e5e8eb')!
        expect(rule.kind === 'rect' && rule.x + rule.w).toBe(scene.width - 16)
      }
    })

    it('cuts a long first line and keeps 16 px from the QR code', () => {
      const long = { ...texts, footer: 'Roster image made with Closure++ '.repeat(5) }
      const scene = buildRosterScene([entry('a')], footerOn, painter(), measure, long)
      const line = all(scene).find((n) => n.kind === 'text' && n.text.startsWith('Roster'))!
      if (line.kind !== 'text') throw new Error()
      expect(line.text.endsWith('…')).toBe(true)
      expect(line.x + measure(line.text, '13px x')).toBeLessThanOrEqual(qr(scene)!.x - 16)
    })

    it('leaves all of it out when off, 93 px shorter', () => {
      const on = buildRosterScene([entry('a')], footerOn, painter(), measure, texts)
      const off = buildRosterScene([entry('a')], options, painter(), measure, texts)
      expect(on.height - off.height).toBe(FOOTER_HEIGHT)
      expect(FOOTER_HEIGHT).toBe(93)
      expect(qr(off)).toBeUndefined()
      expect(fills(off)).not.toContain('#e5e8eb')
      expect(textsOf(off)).not.toContain(texts.footer)
      expect(all(off).some((n) => n.kind === 'image')).toBe(false)
    })
  })

  describe('scheme', () => {
    const full = { ...options, footer: true, goal: true, header: '博士的练度' }
    const qr = (scene: Scene) => all(scene).find((n) => n.kind === 'path')
    const fillOf = (scene: Scene, text: string) =>
      all(scene).find((n): n is Extract<SceneNode, { kind: 'text' }> => n.kind === 'text' && n.text === text)?.fill

    it('paints the light scheme on white, with the QR code straight on it', () => {
      const scene = buildRosterScene([entry('a')], full, painter(), measure, texts)
      expect(scene.background).toBe('#ffffff')
      expect(fillOf(scene, 'name-a')).toBe('#1c2127')
      expect(fillOf(scene, 'sub-a')).toBe('#5f6b7c')
      expect(qr(scene)).toMatchObject({
        x: scene.width - 16 - QR_SIZE,
        y: scene.height - 16 - QR_SIZE,
        d: qrPath(SITE_QR, QR_SIZE / SITE_QR.length),
        fill: '#1c2127',
      })
      expect(fills(scene)).not.toContain('#ffffff')
    })

    it('paints the dark scheme in the colours of the app in dark mode', () => {
      const scene = buildRosterScene([entry('a')], { ...full, scheme: 'dark' }, painter(), measure, texts)
      expect(ROSTER_PALETTES.dark).toMatchObject({
        background: '#2f343c',
        name: '#f6f7f9',
        muted: '#abb3bf',
        footer: '#f6f7f9',
        rule: '#444850',
      })
      expect(scene.background).toBe('#2f343c')
      for (const text of ['博士的练度', 'name-a', texts.footer]) expect(fillOf(scene, text)).toBe('#f6f7f9')
      for (const text of ['sub-a', '当前', '目标', FOOTER_SITE_TEXT]) expect(fillOf(scene, text)).toBe('#abb3bf')
      expect(fills(scene)).toContain('#444850')
      expect(fills(scene)).not.toContain('#e5e8eb')
      // 练度格是游戏画的，不跟配色
      expect(fills(scene)).toContain('status:a-current')
    })

    it('puts the full-size QR code on a light plate with a quiet zone of four modules', () => {
      const scene = buildRosterScene([entry('a')], { ...full, scheme: 'dark' }, painter(), measure, texts)
      const module = QR_SIZE / SITE_QR.length
      expect(QR_QUIET).toBeGreaterThanOrEqual(4 * module)
      const plate = all(scene).find((n) => n.kind === 'rect' && n.fill === '#ffffff')
      // 底板和内容的右缘、图的下边距对齐
      expect(plate).toEqual({
        kind: 'rect',
        x: scene.width - 16 - QR_PLATE,
        y: scene.height - 16 - QR_PLATE,
        w: QR_PLATE,
        h: QR_PLATE,
        fill: '#ffffff',
      })
      if (plate?.kind !== 'rect') throw new Error()
      const code = qr(scene)!
      expect(code).toMatchObject({
        x: plate.x + QR_QUIET,
        y: plate.y + QR_QUIET,
        d: qrPath(SITE_QR, module),
        fill: '#1c2127',
      })
      expect(code.x + QR_SIZE + QR_QUIET).toBe(plate.x + plate.w)
      // 底板画在码下面
      const nodes = all(scene)
      expect(nodes.indexOf(plate)).toBeLessThan(nodes.indexOf(code))
    })

    it('makes the footer as much taller as the plate, centres the logo in it and keeps the text off the plate', () => {
      const light = buildRosterScene([entry('a')], full, painter(), measure, texts)
      const dark = buildRosterScene([entry('a')], { ...full, scheme: 'dark' }, painter(), measure, texts)
      expect(dark.height - light.height).toBe(QR_PLATE - QR_SIZE)
      expect(dark.width).toBe(light.width)
      const logo = all(dark).find((n) => n.kind === 'image')!
      const plate = all(dark).find((n) => n.kind === 'rect' && n.fill === '#ffffff')!
      if (logo.kind !== 'image' || plate.kind !== 'rect') throw new Error()
      expect(logo.y + logo.h / 2).toBe(plate.y + plate.h / 2)

      const long = { ...texts, footer: 'Roster image made with Closure++ '.repeat(5) }
      const cut = buildRosterScene([entry('a')], { ...full, scheme: 'dark' }, painter(), measure, long)
      const line = all(cut).find((n) => n.kind === 'text' && n.text.startsWith('Roster'))!
      if (line.kind !== 'text') throw new Error()
      expect(line.x + measure(line.text, '13px x')).toBeLessThanOrEqual(plate.x - 16)

      const noFooter = { ...full, footer: false }
      expect(buildRosterScene([entry('a')], { ...noFooter, scheme: 'dark' }, painter(), measure, texts).height).toBe(
        buildRosterScene([entry('a')], noFooter, painter(), measure, texts).height,
      )
    })
  })

  describe('room for the status shadow', () => {
    // 列表的 box-shadow: 0 3px 6px
    const shadow = { dx: 0, dy: 3, blur: 6, color: '#313131' }
    const shadowed = (): RosterImagePainter => ({
      ...painter(),
      status: () => [{ kind: 'rect', x: 0, y: 0, w: 100, h: 42, fill: '#313131', shadow }],
    })

    /** 每个带影子的框连影子在图上占到哪里 */
    function shadowBoxes(scene: Scene) {
      const reach = shadow.blur * 1.5
      const boxes: { left: number; top: number; right: number; bottom: number }[] = []
      const visit = (nodes: readonly SceneNode[], ox: number, oy: number) => {
        for (const n of nodes) {
          if (n.kind === 'rect' && n.shadow) {
            const x = ox + n.x + n.shadow.dx
            const y = oy + n.y + n.shadow.dy
            boxes.push({ left: x - reach, top: y - reach, right: x + n.w + reach, bottom: y + n.h + reach })
          } else if (n.kind === 'group') visit(n.children, ox + n.x, oy + n.y)
        }
      }
      visit(scene.nodes, 0, 0)
      return boxes
    }

    const layouts = [1, 3].flatMap((columns) =>
      [false, true].flatMap((goal) =>
        [false, true].flatMap((footer) =>
          ['', '博士'].flatMap((header) =>
            (['light', 'dark'] as const).map((scheme) => ({ ...options, columns, goal, footer, header, scheme })),
          ),
        ),
      ),
    )
    const entries = [entry('a'), entry('b', { absent: true }), entry('c'), entry('d'), entry('e')]

    it('keeps every shadow inside the image, above the footer rule and clear of the next column', () => {
      for (const layout of layouts) {
        const scene = buildRosterScene(entries, layout, shadowed(), measure, texts)
        const boxes = shadowBoxes(scene)
        expect(boxes).toHaveLength(entries.length + (layout.goal ? entries.length : 0))
        const rule = all(scene).find((n) => n.kind === 'rect' && n.fill === ROSTER_PALETTES[layout.scheme].rule)
        expect(!!rule).toBe(layout.footer)
        const step = cellWidth(100, layout.goal) + COLUMN_GAP
        for (const box of boxes) {
          expect(box.left, JSON.stringify(layout)).toBeGreaterThanOrEqual(0)
          expect(box.top).toBeGreaterThanOrEqual(0)
          expect(box.right).toBeLessThanOrEqual(scene.width)
          expect(box.bottom).toBeLessThanOrEqual(scene.height)
          if (rule?.kind === 'rect') expect(box.bottom).toBeLessThanOrEqual(rule.y)
          const col = Math.floor((box.left - 16) / step)
          expect(box.right).toBeLessThanOrEqual(16 + (col + 1) * step)
        }
      }
    })
  })

  it('draws a character listed twice once', () => {
    const p = painter()
    const entries = rosterEntries(['a', 'b', 'a'], (k) => entry(k))
    const scene = buildRosterScene(entries, options, p, measure, texts)
    expect(fills(scene).filter((f) => f === 'avatar:a')).toHaveLength(1)
    expect(p.avatar).toHaveBeenCalledTimes(2)
  })
})
