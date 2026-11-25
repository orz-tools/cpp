import type { Blackboard } from './details'

export type RichStyle = 'vup' | 'vdown' | 'rem' | 'kw'

export interface RichSegment {
  text: string
  /** The value at the target level, when a placeholder differs between the two blackboards */
  to?: string
  style?: RichStyle
  /** id of the enclosing <$…> term, for its explanation */
  term?: string
  br?: true
}

// <@cc.kw> and the like carry the same meaning as their <@ba.*> namesakes. <@ba.talpu> marks what a potential adds to
// a talent, which the game colours as vup.
const styles: Record<string, RichStyle> = { vup: 'vup', kw: 'kw', vdown: 'vdown', rem: 'rem', talpu: 'vup' }

const TOKEN = /<([@$])([^<>]+)>|<\/>|\{(-?)([^{}:]+)(?::([^{}]*))?\}|\\n|\n/g

function lookup(bb: Blackboard | undefined) {
  return new Map((bb || []).map(([k, v]) => [k.toLowerCase(), v]))
}

/** Formats a blackboard value the way the game's templates ask: {key}, {key:0%}, {key:0.0}, {-key:0%} and so on. */
export function formatValue(value: number, format: string | undefined, negate = false) {
  let v = negate ? -value : value
  let suffix = ''
  let f = format ?? ''
  if (f.endsWith('%')) {
    v *= 100
    suffix = '%'
    f = f.slice(0, -1)
  }
  const fixed = /^0(?:\.(0+))?$/.exec(f)
  if (fixed) return v.toFixed(fixed[1]?.length ?? 0).replace(/^-(0(?:\.0*)?)$/, '$1') + suffix
  // A bare {key} prints the value as it is; the data stores float32s, so 0.15 arrives as 0.15000000596.
  return String(parseFloat(v.toPrecision(6))) + suffix
}

/**
 * Splits a game description into styled runs. Placeholders take their values from bb; where bbTarget gives a
 * different value, the run carries both, and a sign right before it (and a % right after) moves into both values,
 * so it reads "+45 → +60" rather than "+45 → 60". Markup it does not know is dropped and its text kept.
 */
export function parseRichText(template: string, bb?: Blackboard, bbTarget?: Blackboard): RichSegment[] {
  const values = lookup(bb)
  const targets = bbTarget ? lookup(bbTarget) : null
  const out: RichSegment[] = []
  const stack: { style?: RichStyle; term?: string }[] = []

  const context = () => {
    let style: RichStyle | undefined
    let term: string | undefined
    for (const x of stack) {
      if (x.style) style = x.style
      if (x.term) term = x.term
    }
    return { style, term }
  }

  const push = (segment: RichSegment) => {
    if (!segment.text && !segment.br && segment.to === undefined) return
    const prev = out[out.length - 1]
    if (
      prev &&
      !prev.br &&
      !segment.br &&
      prev.to === undefined &&
      segment.to === undefined &&
      sameContext(prev, segment)
    ) {
      prev.text += segment.text
    } else {
      out.push(segment)
    }
  }

  let last = 0
  for (const m of template.matchAll(TOKEN)) {
    push({ text: template.slice(last, m.index), ...context() })
    last = m.index + m[0].length

    if (m[1] === '@') {
      stack.push({ style: styles[m[2].split('.').pop()!] })
    } else if (m[1] === '$') {
      stack.push({ term: m[2] })
    } else if (m[0] === '</>') {
      stack.pop()
    } else if (m[4] !== undefined) {
      const key = m[4].trim()
      const negate = m[3] === '-'
      const value = values.get(key.toLowerCase())
      if (value === undefined) {
        push({ text: key, ...context() })
        continue
      }
      const text = formatValue(value, m[5], negate)
      const target = targets?.get(key.toLowerCase())
      const to = target === undefined ? text : formatValue(target, m[5], negate)
      if (to === text) {
        push({ text, ...context() })
      } else {
        const ctx = context()
        const prev = out[out.length - 1]
        let sign = ''
        if (prev && !prev.br && prev.to === undefined && sameContext(prev, ctx) && /[+-]$/.test(prev.text)) {
          sign = prev.text.slice(-1)
          prev.text = prev.text.slice(0, -1)
          if (!prev.text) out.pop()
        }
        out.push({ text: sign + text, to: sign + to, ...ctx })
      }
    } else {
      push({ text: '', br: true })
    }
  }
  push({ text: template.slice(last), ...context() })

  for (let i = 1; i < out.length; i++) {
    const prev = out[i - 1]
    const seg = out[i]
    if (prev.to !== undefined && seg.to === undefined && !seg.br && sameContext(prev, seg) && seg.text[0] === '%') {
      if (!prev.text.endsWith('%')) {
        prev.text += '%'
        prev.to += '%'
      }
      seg.text = seg.text.slice(1)
    }
  }
  return out.filter((x) => x.br || x.text || x.to !== undefined)
}

function sameContext(a: { style?: RichStyle; term?: string }, b: { style?: RichStyle; term?: string }) {
  return a.style === b.style && a.term === b.term
}

/** The plain text of segments, at the current value. */
export function richTextToString(segments: RichSegment[]) {
  return segments.map((x) => (x.br ? '\n' : x.text)).join('')
}

/** Fills the placeholders in and keeps the markup, so texts of different levels can be compared and merged. */
export function resolvePlaceholders(template: string, bb?: Blackboard) {
  const values = lookup(bb)
  return template.replace(/\{(-?)([^{}:]+)(?::([^{}]*))?\}/g, (whole, minus: string, key: string, format?: string) => {
    const value = values.get(key.trim().toLowerCase())
    return value === undefined ? whole : formatValue(value, format, minus === '-')
  })
}

export type MergedLevelTexts =
  | { merged: true; text: string }
  | { merged: false; texts: { level: number; text: string }[] }

const NUMBER = /\d+(?:\.\d+)?%?/g

/**
 * One text for several levels when only numbers change: the first level's number, then each later level where it
 * changes, e.g. "70%（3 级 60%）". Otherwise each level on its own. levelLabel formats the "3 级 60%" part.
 */
export function mergeLevelTexts(
  entries: { level: number; text: string }[],
  levelLabel: (level: number, value: string) => string,
  join: (first: string, changes: string[]) => string,
): MergedLevelTexts {
  if (entries.length === 0) return { merged: false, texts: [] }
  const shapes = entries.map((x) => x.text.replace(NUMBER, '#'))
  if (shapes.some((x) => x !== shapes[0])) return { merged: false, texts: entries }

  const numbers = entries.map((x) => x.text.match(NUMBER) ?? [])
  let i = 0
  const text = entries[0].text.replace(NUMBER, (first) => {
    const n = i++
    const changes: string[] = []
    for (let k = 1; k < entries.length; k++) {
      if (numbers[k][n] !== numbers[k - 1][n]) changes.push(levelLabel(entries[k].level, numbers[k][n]))
    }
    return changes.length ? join(first, changes) : first
  })
  return { merged: true, text }
}
