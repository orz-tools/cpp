import { describe, expect, it, vi } from 'vitest'
import type { ICharacter } from '../../pkg/cpp-basic'
import {
  FOOTER_LOGO_URL,
  FOOTER_SITE_TEXT,
  Measure,
  RosterEntry,
  RosterOptions,
  buildRosterScene,
  fitText,
  rosterEntries,
} from './build'
import { FOOTER_HEIGHT, QR_SIZE } from './layout'
import { RosterImagePainter, Scene, SceneNode, walkScene } from './scene'

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
const options: RosterOptions = { columns: 1, order: 'rows', goal: false, header: '', footer: false }

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

  it('draws a character listed twice once', () => {
    const p = painter()
    const entries = rosterEntries(['a', 'b', 'a'], (k) => entry(k))
    const scene = buildRosterScene(entries, options, p, measure, texts)
    expect(fills(scene).filter((f) => f === 'avatar:a')).toHaveLength(1)
    expect(p.avatar).toHaveBeenCalledTimes(2)
  })
})
