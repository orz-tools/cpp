import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const ROOTS = /^(?:html|body|:root|#root)$/
// svh is the height with the browser's toolbar shown, which is all the page ever gets; the others grow past it
const TALL_HEIGHT = /(?:^|;)\s*((?:min-|max-)?height\s*:[^;]*?\d(?:[ld]?vh)\b[^;]*)/gi

function rootHeights(css: string): string[] {
  const found: string[] = []
  for (const [, selectors, body] of css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!selectors.split(',').some((s) => ROOTS.test(s.trim()))) continue
    for (const [, declaration] of body.matchAll(TALL_HEIGHT))
      found.push(`${selectors.trim()} { ${declaration.trim()} }`)
  }
  return found
}

describe('rootHeights', () => {
  it('catches a root element sized in vh, lvh or dvh', () => {
    expect(rootHeights('body {\n  margin: 0;\n  min-height: 100vh;\n}')).toEqual(['body { min-height: 100vh }'])
    expect(rootHeights('html, .a { height: calc(100dvh - 1px) }')).toEqual(['html, .a { height: calc(100dvh - 1px) }'])
    expect(rootHeights('@media (x) {\n  #root { max-height: 50lvh }\n}')).toEqual(['#root { max-height: 50lvh }'])
  })

  it('leaves svh, other elements, other properties and comments alone', () => {
    expect(rootHeights('body { min-height: 100svh }')).toEqual([])
    expect(rootHeights('body .a { height: 100vh }')).toEqual([])
    expect(rootHeights('.a { height: 100vh }')).toEqual([])
    expect(rootHeights('body { width: 100vw; line-height: 1.5 }')).toEqual([])
    expect(rootHeights('/* body { height: 100vh } */')).toEqual([])
  })
})

describe('the stylesheets under src/', () => {
  // On a phone the document would scroll by the toolbar's height and carry the app up under the fixed navbar
  it('never make the page taller than the screen it gets', () => {
    const src = fileURLToPath(new URL('.', import.meta.url))
    const files = readdirSync(src, { recursive: true, encoding: 'utf8' }).filter((f) => f.endsWith('.css'))
    expect(files).toEqual(expect.arrayContaining(['index.css', 'App.css']))
    expect(files.flatMap((f) => rootHeights(readFileSync(join(src, f), 'utf8')).map((x) => `${f}: ${x}`))).toEqual([])
  })
})
