import type { Blackboard, PotentialDetail } from './details'
import { parseRichText, type RichSegment } from './richText'

/** One talent changed by a potential: its name at that potential, and its text */
export interface PotentialTalentChange {
  name: string | null
  /** null when the talent has no text at that potential */
  segments: RichSegment[] | null
}

/** One potential the operator can reach */
export interface PotentialStep {
  /** 2–6, as the game numbers potentials */
  potential: number
  /** The rank's own text, e.g. 攻击力+28 or 第一天赋效果增强 */
  text: string
  talents: PotentialTalentChange[]
}

export function potentialSteps(detail: PotentialDetail): PotentialStep[] {
  return detail.ranks.map((text, i) => ({
    potential: i + 2,
    text,
    talents: detail.talents.flatMap(({ candidates }) => {
      const at = candidates.findIndex((c) => c.potential === i + 1)
      if (at < 0) return []
      const after = candidates[at]
      const before = at > 0 ? candidates[at - 1].desc : null
      return [{ name: after.name, segments: talentChange(before, after.desc) }]
    }),
  }))
}

/** potentialRank is the status's, 0 for 潜能 1 */
export function potentialReached(potentialRank: number, potential: number) {
  return potentialRank >= potential - 1
}

const TALPU = /(\s*)<@ba\.talpu>(.*?)<\/>/g
// A sign right before the number: （+1）, (-3), (+1s), （+0.5%）
const INCREMENT = /\s*[（(][+-]\d[^（）()]*[）)]/g

/** The text inside each <@ba.talpu> run, without the bracketed increment, e.g. 7<@ba.talpu>（+1）</>秒 → 7秒 */
export function stripIncrements(text: string) {
  return text.replace(TALPU, (_, space: string, inner: string) => {
    const kept = inner.replace(INCREMENT, '')
    // "12 <@ba.talpu>(-3)</> seconds" keeps one space between 12 and seconds, not two.
    return kept.trim() ? space + kept : ''
  })
}

const MARKUP = /(<[@$][^<>]*>|<\/>)/
const NUMBER = /\d+(?:\.\d+)?/g

/** The text between markup, where numbers are looked for: a tag's name has numbers too (<$ba.dt.apoptosis2>). */
function numbersOf(text: string) {
  // The capture group keeps the markup at the odd indices.
  const parts = text.split(MARKUP)
  const values: string[] = []
  const shape = parts
    .map((part, i) => (i % 2 ? part : part.replace(NUMBER, (n) => (values.push(n), '#'))))
    .join('')
    .replace(/\s+/g, '')
  return { parts, values, shape }
}

/**
 * The talent's text after a potential, its numbers written "before → after" where the potential changes them. When the
 * wording changes too, or no number does, the text after the potential as it is.
 */
export function talentChange(before: string | null, after: string | null): RichSegment[] | null {
  if (after == null) return null
  if (before == null) return parseRichText(after)
  const from = numbersOf(stripIncrements(before))
  const to = numbersOf(stripIncrements(after))
  if (from.shape !== to.shape || from.values.every((n, i) => n === to.values[i])) return parseRichText(after)

  // Each changed number becomes a placeholder with a value on either side, so that parseRichText moves a sign before
  // it and a % after it into both, as for a skill's levels.
  const bb: Blackboard = []
  const bbTarget: Blackboard = []
  let k = 0
  const template = from.parts
    .map((part, i) =>
      i % 2
        ? part
        : part.replace(NUMBER, (n) => {
            const target = to.values[k++]
            if (target === n) return n
            const key = `cpp_n${bb.length + 1}`
            bb.push([key, Number(n)])
            bbTarget.push([key, Number(target)])
            return `{${key}}`
          }),
    )
    .join('')
  return parseRichText(template, bb, bbTarget)
}
