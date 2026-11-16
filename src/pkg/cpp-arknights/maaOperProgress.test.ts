import { describe, expect, it } from 'vitest'
import { MaaOperProgressCharacter, buildMaaOperProgressPlans, formatMaaOperProgressPlans } from './maaOperProgress'
import { ArknightsCharacterStatus } from './types'

function char(
  key: string,
  name: string,
  profession: MaaOperProgressCharacter['raw']['profession'],
  skillIds: (string | null)[],
  hasPatches = false,
): MaaOperProgressCharacter {
  return {
    key,
    hasPatches,
    raw: { name, profession },
    skills: skillIds.flatMap((skillId, charSkillIndex) =>
      skillId ? [{ skillId, rawCharId: key, charSkillIndex }] : [],
    ),
  }
}

function st(partial: Partial<ArknightsCharacterStatus>): ArknightsCharacterStatus {
  return { elite: 0, level: 1, skillLevel: 1, skillMaster: {}, modLevel: {}, ...partial }
}

const chars: Record<string, MaaOperProgressCharacter> = {
  chen: char('chen', '陈', 'WARRIOR', ['s1', 's2', 's3']),
  ptilo: char('ptilo', '白面鸮', 'MEDIC', ['p1', 'p2']),
  amiya: char('amiya', '阿米娅', 'CASTER', ['a1', 'a2', 'a3'], true),
  gap: char('gap', '空格', 'SPECIAL', [null, 'g2']),
}

function build(current: Record<string, ArknightsCharacterStatus>, goal: Record<string, ArknightsCharacterStatus>) {
  return buildMaaOperProgressPlans(Object.keys(goal), current, goal, (key) => chars[key])
}

describe('buildMaaOperProgressPlans', () => {
  it('exports only the targets that are ahead of current', () => {
    const r = build(
      { chen: st({ elite: 1, level: 50, skillLevel: 7, skillMaster: { s1: 3 } }) },
      { chen: st({ elite: 2, level: 1, skillLevel: 7, skillMaster: { s1: 3, s3: 3 } }) },
    )
    expect(r).toEqual({
      plans: [{ role: 'Warrior', name: '陈', elite: 2, skill_mastery: [0, 0, 3] }],
      partial: 0,
      excluded: 0,
    })
  })

  it('places mastery by skill slot and follows goal order', () => {
    const r = buildMaaOperProgressPlans(
      ['gap', 'ptilo'],
      { gap: st({ elite: 2, skillLevel: 7 }), ptilo: st({ elite: 1, skillLevel: 4 }) },
      { gap: st({ elite: 2, skillLevel: 7, skillMaster: { g2: 2 } }), ptilo: st({ elite: 1, skillLevel: 7 }) },
      (key) => chars[key],
    )
    expect(r.plans).toEqual([
      { role: 'Special', name: '空格', skill_mastery: [0, 2, 0] },
      { role: 'Medic', name: '白面鸮', skill_level: 7 },
    ])
  })

  it('counts level and module targets as partial', () => {
    const r = build(
      {
        chen: st({ elite: 2, level: 1, skillLevel: 7 }),
        ptilo: st({ elite: 1, level: 20, skillLevel: 4 }),
        gap: st({ elite: 2, level: 60, skillLevel: 7 }),
      },
      {
        chen: st({ elite: 2, level: 90, skillLevel: 7 }),
        ptilo: st({ elite: 2, level: 30, skillLevel: 4 }),
        gap: st({ elite: 2, level: 60, skillLevel: 7, modLevel: { m: 3 } }),
      },
    )
    expect(r).toEqual({ plans: [{ role: 'Medic', name: '白面鸮', elite: 2 }], partial: 3, excluded: 0 })
  })

  it('excludes characters not yet owned and Amiya', () => {
    const r = build(
      { amiya: st({ elite: 1, skillLevel: 4 }), chen: st({ level: 0 }) },
      { amiya: st({ elite: 2, skillLevel: 7 }), chen: st({ elite: 2, skillLevel: 7 }), ptilo: st({ elite: 1 }) },
    )
    expect(r).toEqual({ plans: [], partial: 0, excluded: 3 })
  })
})

describe('formatMaaOperProgressPlans', () => {
  it('writes one plan per line as a JSON array', () => {
    const text = formatMaaOperProgressPlans([
      { role: 'Warrior', name: '陈', elite: 2 },
      { role: 'Medic', name: '白面鸮', skill_level: 7 },
    ])
    expect(text).toBe(
      '[\n  {"role":"Warrior","name":"陈","elite":2},\n  {"role":"Medic","name":"白面鸮","skill_level":7}\n]',
    )
    expect(JSON.parse(text)).toHaveLength(2)
  })
})
