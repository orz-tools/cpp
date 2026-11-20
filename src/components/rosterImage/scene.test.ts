import { describe, expect, it } from 'vitest'
import { Scene, SceneImage, SceneNode, SvgEmbedder, collectSceneImages, imageKey, sceneToSvg } from './scene'

const avatar: SceneImage = { blob: { normal: { id: 'a', urls: ['https://example.com/a.png'] } } }
const shine: SceneImage = { asset: '/assets/shining_blue.png' }

function scene(nodes: SceneNode[]): Scene {
  return { width: 100, height: 50, background: '#ffffff', nodes }
}

const embedAll: SvgEmbedder = (image) => ({
  href: `data:image/png;base64,${btoa(imageKey(image))}`,
  width: 80,
  height: 80,
})

const count = (text: string, pattern: RegExp) => text.match(pattern)?.length ?? 0

describe('sceneToSvg', () => {
  it('embeds an image used twice once', () => {
    const svg = sceneToSvg(
      scene([
        { kind: 'image', x: 0, y: 0, w: 40, h: 40, image: avatar },
        { kind: 'image', x: 50, y: 0, w: 40, h: 40, image: { ...avatar } },
      ]),
      embedAll,
    )
    expect(count(svg, /<symbol /g)).toBe(1)
    expect(count(svg, /<use /g)).toBe(2)
    expect(count(svg, /<image /g)).toBe(1)
  })

  it('gives grayscale and cover their own symbols', () => {
    const svg = sceneToSvg(
      scene([
        { kind: 'image', x: 0, y: 0, w: 40, h: 40, image: shine },
        { kind: 'image', x: 0, y: 0, w: 40, h: 40, image: { ...shine, grayscale: true } },
        { kind: 'image', x: 0, y: 0, w: 40, h: 40, image: shine, fit: 'cover' },
      ]),
      embedAll,
    )
    expect(count(svg, /<symbol /g)).toBe(3)
    expect(count(svg, /preserveAspectRatio="xMidYMid slice"/g)).toBe(1)
    expect(count(svg, /preserveAspectRatio="none"/g)).toBe(2)
    // 去色的是另一张图，嵌两份；同一张图的 fill 和 cover 共用一次 embed
    expect(count(svg, /<image /g)).toBe(3)
  })

  it('escapes text', () => {
    const svg = sceneToSvg(
      scene([{ kind: 'text', x: 1, y: 2, text: `<b> & "it's"`, size: 14, fill: '#000' }]),
      embedAll,
    )
    expect(svg).toContain('&lt;b&gt; &amp; &quot;it&apos;s&quot;</text>')
    expect(svg).not.toContain('<b>')
  })

  it('writes the text attributes', () => {
    const svg = sceneToSvg(
      scene([
        { kind: 'text', x: 1, y: 2, text: 'a', size: 14, fill: '#000', bold: true, mono: true, anchor: 'middle' },
      ]),
      embedAll,
    )
    expect(svg).toMatch(/<text x="1" y="2" font-family="ui-monospace[^"]*" font-size="14" font-weight="bold"/)
    expect(svg).toContain('text-anchor="middle"')
  })

  it('renders group opacity, clip and glow', () => {
    const svg = sceneToSvg(
      scene([
        {
          kind: 'group',
          x: 10,
          y: 20,
          w: 30,
          h: 40,
          opacity: 0.25,
          clip: true,
          children: [{ kind: 'image', x: 0, y: 0, w: 18, h: 18, image: shine, glow: true }],
        },
      ]),
      embedAll,
    )
    expect(svg).toContain(
      '<g transform="translate(10 20)" opacity="0.25"><svg width="30" height="40" overflow="hidden">',
    )
    expect(svg).toContain('filter="url(#cpp-glow)"')
    expect(count(svg, /<feDropShadow /g)).toBe(2)
  })

  it('leaves the glow filter out when nothing glows', () => {
    const svg = sceneToSvg(scene([{ kind: 'image', x: 0, y: 0, w: 18, h: 18, image: shine }]), embedAll)
    expect(svg).not.toContain('<filter')
  })

  it('translates a path', () => {
    const svg = sceneToSvg(scene([{ kind: 'path', x: 3, y: 4, d: 'M0 0h2v2h-2z', fill: '#1c2127' }]), embedAll)
    expect(svg).toContain('<path transform="translate(3 4)" d="M0 0h2v2h-2z" fill="#1c2127"/>')
  })

  it('draws no use for an image that did not load', () => {
    const svg = sceneToSvg(
      scene([
        { kind: 'image', x: 0, y: 0, w: 40, h: 40, image: avatar },
        { kind: 'image', x: 0, y: 0, w: 40, h: 40, image: shine },
      ]),
      (image) => ('blob' in image ? undefined : embedAll(image)),
    )
    expect(count(svg, /<use /g)).toBe(1)
    expect(count(svg, /<symbol /g)).toBe(1)
  })

  it('sizes the root and paints the background first', () => {
    const svg = sceneToSvg(scene([]), embedAll)
    expect(svg).toMatch(
      /^<svg xmlns="http:\/\/www.w3.org\/2000\/svg"[^>]* width="100" height="50" viewBox="0 0 100 50">/,
    )
    expect(svg).toContain('<rect x="0" y="0" width="100" height="50" fill="#ffffff"/></svg>')
  })

  it('rounds coordinates', () => {
    const svg = sceneToSvg(scene([{ kind: 'rect', x: 1 / 3, y: 0, w: 77 / 3, h: 40, fill: '#313131' }]), embedAll)
    expect(svg).toContain('<rect x="0.333" y="0" width="25.667" height="40" fill="#313131"/>')
  })
})

describe('collectSceneImages', () => {
  it('keeps the largest size and every fit of an image, inside groups too', () => {
    const uses = collectSceneImages(
      scene([
        { kind: 'image', x: 0, y: 0, w: 40, h: 20, image: shine },
        {
          kind: 'group',
          x: 0,
          y: 0,
          w: 100,
          h: 100,
          children: [{ kind: 'image', x: 0, y: 0, w: 30, h: 40, image: shine, fit: 'cover' }],
        },
        { kind: 'image', x: 0, y: 0, w: 18, h: 18, image: avatar },
      ]),
    )
    expect(uses).toHaveLength(2)
    expect(uses[0]).toMatchObject({ width: 40, height: 40, fits: ['fill', 'cover'] })
    expect(uses[1]).toMatchObject({ width: 18, height: 18, fits: ['fill'] })
  })

  it('tells grayscale apart', () => {
    const uses = collectSceneImages(
      scene([
        { kind: 'image', x: 0, y: 0, w: 40, h: 40, image: shine },
        { kind: 'image', x: 0, y: 0, w: 40, h: 40, image: { ...shine, grayscale: true } },
      ]),
    )
    expect(uses.map((x) => x.key)).toEqual([imageKey(shine), imageKey({ ...shine, grayscale: true })])
  })
})
