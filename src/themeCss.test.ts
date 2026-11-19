import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { findNeutralColours } from './themeCss'

const caught = (property: string, value: string) => findNeutralColours(`.a { ${property}: ${value}; }`).length > 0

describe('findNeutralColours', () => {
  const N = [
    'var(--bp-palette-light-gray-5)',
    'var(--bp-palette-dark-gray-1)',
    'var(--bp-palette-gray-5)',
    '#F6F7F9',
    '#404854',
  ]
  const G = ['var(--bp-palette-gray-1, #5f6b7c)', '#5f6b7c']
  const W = ['var(--bp-palette-white)', '#fff', '#ffffff', '#ffffff80', 'white']
  const K = ['var(--bp-palette-black)', '#000', '#000000', '#111418', 'black']
  const INK = ['rgba(17, 20, 24, 0.15)', 'rgb(17 20 24 / 0.15)']

  it('catches grey, gray-1, black and ink text but not white text', () => {
    for (const property of ['color', 'fill', 'stroke', 'caret-color', 'text-decoration-color']) {
      for (const v of [...N, ...G, ...K, ...INK]) expect(caught(property, v), `${property}: ${v}`).toBe(true)
      for (const v of W) expect(caught(property, v), `${property}: ${v}`).toBe(false)
    }
  })

  it('catches grey, white and ink fills and lines but not gray-1 or black ones', () => {
    for (const property of ['background', 'background-color', 'border', 'border-top-color', 'outline']) {
      for (const v of [...N, ...W, ...INK]) expect(caught(property, `1px solid ${v}`), `${property}: ${v}`).toBe(true)
      for (const v of [...G, ...K]) expect(caught(property, `1px solid ${v}`), `${property}: ${v}`).toBe(false)
    }
  })

  it('catches ink in an inset shadow only, and grey or white in any shadow', () => {
    expect(caught('box-shadow', '0 1px 2px rgba(17, 20, 24, 0.2)')).toBe(false)
    expect(caught('box-shadow', 'inset 0 -1px 0 rgba(17, 20, 24, 0.15)')).toBe(true)
    expect(caught('box-shadow', '0 1px 2px rgba(17, 20, 24, 0.2), inset 0 0 0 1px rgba(17, 20, 24, 0.1)')).toBe(true)
    expect(caught('box-shadow', '0 0 0 2px #fff')).toBe(true)
    expect(caught('box-shadow', '0 0 0 1px var(--bp-palette-light-gray-1)')).toBe(true)
    expect(caught('box-shadow', '0 2px 4px black, 0 0 0 1px var(--bp-palette-gray-1)')).toBe(false)
  })

  it('leaves other properties, translucent white and other colours alone', () => {
    expect(caught('white-space', 'nowrap')).toBe(false)
    expect(caught('filter', 'drop-shadow(0 0 1px black)')).toBe(false)
    expect(caught('background', 'rgba(255, 255, 255, 0.6)')).toBe(false)
    expect(caught('color', 'var(--bp-palette-gray-2)')).toBe(false)
    expect(caught('color', 'var(--bp-palette-light-gray-50)')).toBe(false)
    expect(caught('background', 'var(--bp-palette-blue-3)')).toBe(false)
  })

  it('lets a declaration through with a fixed comment on its lines', () => {
    expect(findNeutralColours('.a { color: #fff; background: #fff; /* fixed: on art */ }')).toEqual([])
    expect(findNeutralColours('.a {\n  background: #fff; /* fixed: on art */\n}')).toEqual([])
    expect(findNeutralColours('.a {\n  /* fixed: on art */\n  background: #fff;\n}')).toHaveLength(1)
    expect(findNeutralColours('.a {\n  background: #fff; /* the page */\n}')).toHaveLength(1)
  })

  it('lets rules under .bp6-dark and custom properties through', () => {
    expect(findNeutralColours(':root.bp6-dark .a { background: var(--bp-palette-dark-gray-1); }')).toEqual([])
    expect(findNeutralColours('.bp6-dark { .a { color: #5f6b7c } }')).toEqual([])
    expect(findNeutralColours(':root { --x: #fff; }')).toEqual([])
  })

  it('checks rules inside @media', () => {
    expect(findNeutralColours('@media (pointer: coarse) {\n  .a {\n    color: #5f6b7c;\n  }\n}')).toEqual([
      { line: 3, property: 'color', value: '#5f6b7c', reason: 'gray-1' },
    ])
    expect(findNeutralColours('@media (prefers-color-scheme: dark) { .bp6-dark-ish { color: #000 } }')).toHaveLength(1)
  })

  it('reports where a declaration starts, past comments and strings', () => {
    const css = [
      '/* a { color: #000 } */',
      ".a::before { content: 'a; b { c'; }",
      '.b {',
      '  box-shadow:',
      '    0 0 0 1px #fff,',
      '    inset 0 0 0 1px rgba(17, 20, 24, 0.1);',
      '}',
    ].join('\n')
    expect(findNeutralColours(css)).toEqual([
      {
        line: 4,
        property: 'box-shadow',
        value: '0 0 0 1px #fff,\n    inset 0 0 0 1px rgba(17, 20, 24, 0.1)',
        reason: 'white',
      },
    ])
  })
})

describe('the stylesheets under src/', () => {
  it('write white, greys and the ink only through the theme tokens', () => {
    const src = fileURLToPath(new URL('.', import.meta.url))
    const root = join(src, '..')
    const files = readdirSync(src, { recursive: true, encoding: 'utf8' })
      .filter((f) => f.endsWith('.css'))
      .map((f) => relative(root, join(src, f)).split('\\').join('/'))
      .filter((f) => f !== 'src/theme.css')
      .sort()
    expect(files).toEqual(expect.arrayContaining(['src/App.css', 'src/components/arknights/style.css']))
    const found = files.flatMap((f) =>
      findNeutralColours(readFileSync(join(root, f), 'utf8')).map((x) => `${f}:${x.line} ${x.property}: ${x.value}`),
    )
    expect(found).toEqual([])
  })
})
