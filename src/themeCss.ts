/** A colour that would stay the same when the theme turns dark; src/themeCss.test.ts fails on any of them. */
export interface NeutralColour {
  /** The line the declaration starts on, counted from 1 */
  line: number
  property: string
  value: string
  reason: string
}

interface Family {
  reason: string
  pattern: RegExp
}

const hex = (codes: string[]) => `#(?:${codes.join('|')})(?:[0-9a-f]{2})?(?![0-9a-f])`
const family = (reason: string, source: string): Family => ({ reason, pattern: new RegExp(source, 'i') })

const GREYS = family(
  'light or dark grey',
  `var\\(--bp-palette-(?:light-gray-[1-5]|dark-gray-[1-5]|gray-5)(?![\\w-])|` +
    hex(['f6f7f9', 'edeff2', 'e5e8eb', 'dce0e5', 'd3d8de', '1c2127', '252a31', '2f343c', '383e47', '404854', 'c5cbd3']),
)
const GRAY_1 = family('gray-1', `var\\(--bp-palette-gray-1(?![\\w-])|${hex(['5f6b7c'])}`)
const WHITE = family(
  'white',
  `var\\(--bp-palette-white(?![\\w-])|#fff(?![0-9a-f])|${hex(['ffffff'])}|(?<![\\w-])white(?![\\w-])`,
)
const BLACK = family(
  'black',
  `var\\(--bp-palette-black(?![\\w-])|#000(?![0-9a-f])|${hex(['000000', '111418'])}|(?<![\\w-])black(?![\\w-])`,
)
const INK = family('rgba(17, 20, 24)', `rgba?\\(\\s*17[\\s,]+20[\\s,]+24(?![\\d.])`)

// White text only ever sits on a coloured fill or on art; grey, black or ink text would vanish on a dark page
const TEXT = [GREYS, GRAY_1, BLACK, INK]
// A gray-1 block reads on both themes and a black one only sits on art; white and light grey would glare
const FILL = [GREYS, WHITE, INK]
const TEXT_PROPERTIES = new Set(['color', 'fill', 'stroke', 'caret-color', 'text-decoration-color'])

function splitTopLevel(value: string): string[] {
  const layers: string[] = []
  let depth = 0
  let start = 0
  for (let i = 0; i < value.length; i++) {
    const c = value[i]
    if (c === '(') depth++
    else if (c === ')') depth--
    else if (c === ',' && depth === 0) {
      layers.push(value.slice(start, i))
      start = i + 1
    }
  }
  layers.push(value.slice(start))
  return layers
}

function check(property: string, value: string): string | undefined {
  const hit = (families: Family[], text: string) => families.find((f) => f.pattern.test(text))?.reason
  if (TEXT_PROPERTIES.has(property)) return hit(TEXT, value)
  if (/^(background|border|outline)/.test(property)) return hit(FILL, value)
  if (property !== 'box-shadow') return undefined
  for (const layer of splitTopLevel(value)) {
    // An ink drop shadow stays a shadow in both themes; an inset ink layer draws a line
    const reason = hit(/(?<![\w-])inset(?![\w-])/i.test(layer) ? FILL : [GREYS, WHITE], layer)
    if (reason) return reason
  }
  return undefined
}

interface Declaration {
  property: string
  value: string
  line: number
  end: number
  underDark: boolean
}

/**
 * Finds declarations that write a neutral colour as a literal. A custom property, a rule under `.bp6-dark` and a
 * declaration with a comment starting `fixed` on its lines (after the `;` too) pass.
 */
export function findNeutralColours(css: string): NeutralColour[] {
  const comments: { line: number; text: string }[] = []
  const declarations: Declaration[] = []
  const stack: string[] = []
  let line = 1
  let text = ''
  let start = 0
  let last = 0

  const append = (chunk: string) => {
    if (!text.trim() && chunk.trim()) start = line
    text += chunk
    if (chunk.trim()) last = line
  }

  const endStatement = (end: number) => {
    const statement = text.trim()
    text = ''
    const colon = statement.indexOf(':')
    if (stack.length === 0 || colon < 0) return
    declarations.push({
      property: statement.slice(0, colon).trim().toLowerCase(),
      value: statement.slice(colon + 1).trim(),
      line: start,
      end,
      underDark: stack.some((s) => !s.startsWith('@') && /\.bp6-dark(?![\w-])/.test(s)),
    })
  }

  for (let i = 0; i < css.length; i++) {
    const c = css[i]
    if (c === '/' && css[i + 1] === '*') {
      const close = css.indexOf('*/', i + 2)
      const end = close < 0 ? css.length : close + 2
      comments.push({ line, text: css.slice(i + 2, close < 0 ? end : close).trim() })
      line += css.slice(i, end).split('\n').length - 1
      i = end - 1
    } else if (c === '"' || c === "'") {
      const close = css.indexOf(c, i + 1)
      const end = close < 0 ? css.length : close + 1
      append(css.slice(i, end))
      line += css.slice(i, end).split('\n').length - 1
      i = end - 1
    } else if (c === ';') {
      endStatement(line)
    } else if (c === '{') {
      stack.push(text.trim())
      text = ''
    } else if (c === '}') {
      endStatement(last)
      stack.pop()
    } else {
      append(c)
      if (c === '\n') line++
    }
  }

  const found: NeutralColour[] = []
  for (const d of declarations) {
    if (d.property.startsWith('--') || d.underDark) continue
    if (comments.some((c) => c.line >= d.line && c.line <= d.end && /^fixed/i.test(c.text))) continue
    const reason = check(d.property, d.value)
    if (reason) found.push({ line: d.line, property: d.property, value: d.value, reason })
  }
  return found
}
