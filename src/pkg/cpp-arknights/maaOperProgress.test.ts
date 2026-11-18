import { describe, expect, it } from 'vitest'
import {
  MaaOperProgressCharacter,
  MaaOperProgressImportCharacter,
  MaaOperProgressPlanInput,
  buildMaaOperProgressPlans,
  formatMaaOperProgressPlans,
  mergeMaaOperProgressPlans,
  parseMaaOperProgressPlans,
} from './maaOperProgress'
import { ArknightsCharacterStatus } from './types'

function char(
  key: string,
  name: string,
  profession: MaaOperProgressCharacter['raw']['profession'],
  skillIds: (string | null)[],
  hasPatches = false,
  isSpecialOperator = false,
): MaaOperProgressCharacter {
  return {
    key,
    hasPatches,
    isSpecialOperator,
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
  mcnist: char('mcnist', '机械师', 'TANK', ['n1', 'n2', 'n3'], false, true),
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
      special: 0,
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
    expect(r).toEqual({ plans: [{ role: 'Medic', name: '白面鸮', elite: 2 }], partial: 3, excluded: 0, special: 0 })
  })

  it('excludes characters not yet owned and Amiya', () => {
    const r = build(
      { amiya: st({ elite: 1, skillLevel: 4 }), chen: st({ level: 0 }) },
      { amiya: st({ elite: 2, skillLevel: 7 }), chen: st({ elite: 2, skillLevel: 7 }), ptilo: st({ elite: 1 }) },
    )
    expect(r).toEqual({ plans: [], partial: 0, excluded: 3, special: 0 })
  })

  it('leaves out special operators', () => {
    const r = build(
      { mcnist: st({ elite: 1, level: 50, skillLevel: 4 }) },
      { mcnist: st({ elite: 2, skillLevel: 7, skillMaster: { n1: 3 } }) },
    )
    expect(r).toEqual({ plans: [], partial: 0, excluded: 0, special: 1 })
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

describe('parseMaaOperProgressPlans', () => {
  it('reads the plan MAA takes from the clipboard', () => {
    expect(
      parseMaaOperProgressPlans('[{"role":"Warrior","name":"陈","elite":2,"skill_level":7,"skill_mastery":[0,0,3]}]'),
    ).toEqual([{ role: 'Warrior', name: '陈', elite: 2, skill_level: 7, skill_mastery: [0, 0, 3] }])
  })

  it('rejects the MAA operator box export, extra keys and nulls', () => {
    expect(() =>
      parseMaaOperProgressPlans('[{"id":"char_010_chen","name":"陈","own":true,"elite":2,"level":90,"potential":1}]'),
    ).toThrow()
    expect(() => parseMaaOperProgressPlans('[{"name":"陈","elite":null}]')).toThrow()
    expect(() => parseMaaOperProgressPlans('[]')).toThrow()
  })
})

describe('mergeMaaOperProgressPlans', () => {
  function importChar(
    key: string,
    names: { name: string; appellation: string; local?: string },
    forms: Record<
      string,
      { profession: MaaOperProgressImportCharacter['raw']['profession']; skills: (string | [string, false])[] }
    >,
    maxElite = 2,
  ): MaaOperProgressImportCharacter {
    return {
      key,
      maxElite,
      charIds: Object.keys(forms),
      raw: { name: names.name, appellation: names.appellation, profession: forms[key].profession },
      rawLocal: names.local ? { name: names.local } : null,
      skills: Object.entries(forms).flatMap(([rawCharId, f]) =>
        f.skills.map((s, charSkillIndex) => {
          const [skillId, masterable] = typeof s === 'string' ? [s, true] : s
          return { skillId, rawCharId, charSkillIndex, charSkill: { levelUpCostCond: masterable ? [1, 2, 3] : [] } }
        }),
      ),
      getPatchProfession: (charId) => forms[charId]?.profession || 'TOKEN',
    }
  }

  const importChars = [
    importChar(
      'chen',
      { name: '陈', appellation: "Ch'en", local: '陳' },
      {
        chen: { profession: 'WARRIOR', skills: ['s1', 's2', 's3'] },
      },
    ),
    importChar(
      'amiya',
      { name: '阿米娅', appellation: 'Amiya' },
      {
        amiya: { profession: 'CASTER', skills: ['a1', 'a2', 'a3'] },
        amiya2: { profession: 'WARRIOR', skills: ['g1', 'g2'] },
        amiya3: { profession: 'MEDIC', skills: ['h1', 'h2'] },
      },
    ),
    importChar(
      'fang',
      { name: '芬', appellation: 'Fang' },
      { fang: { profession: 'PIONEER', skills: [['f1', false]] } },
      1,
    ),
  ]

  const empty: ArknightsCharacterStatus = Object.freeze({
    elite: 0,
    level: 0,
    skillLevel: 1,
    skillMaster: {},
    modLevel: {},
    potentialRank: 0,
  })

  function merge(
    current: Record<string, ArknightsCharacterStatus>,
    goal: Record<string, ArknightsCharacterStatus>,
    plans: MaaOperProgressPlanInput[],
  ) {
    const data = { current, goal, goalOrder: Object.keys(goal) }
    const result = mergeMaaOperProgressPlans(importChars, data, empty, plans)
    return { data, result }
  }

  it('raises goals and keeps targets the plan does not mention', () => {
    const { data, result } = merge(
      { chen: st({ elite: 1, level: 50, skillLevel: 7 }) },
      { chen: st({ elite: 1, level: 70, skillLevel: 7, skillMaster: { s1: 3 }, modLevel: { m: 1 } }) },
      [{ role: 'Warrior', name: '陈', elite: 2, skill_level: 5, skill_mastery: [1, 0, 3] }],
    )
    expect(result).toEqual({ unknown: [], invalid: [], inferred: [] })
    expect(data.goal.chen).toEqual(
      st({ elite: 2, level: 1, skillLevel: 7, skillMaster: { s1: 3, s3: 3 }, modLevel: { m: 1 } }),
    )
  })

  it('matches English and local names, and picks Amiya forms by role', () => {
    const { data, result } = merge(
      { chen: st({ elite: 2, skillLevel: 7 }), amiya: st({ elite: 2, skillLevel: 7 }) },
      {},
      [
        { name: "ch'en", skill_mastery: [3] },
        { name: '陳', skill_mastery: [0, 2] },
        { role: 'Medic', name: '阿米娅', skill_mastery: [0, 3] },
        { name: 'Amiya', skill_mastery: [1] },
      ],
    )
    expect(result.unknown).toEqual([])
    expect(data.goal.chen.skillMaster).toEqual({ s1: 3, s2: 2 })
    expect(data.goal.amiya.skillMaster).toEqual({ h2: 3, a1: 1 })
    expect(data.goalOrder).toEqual(['chen', 'amiya'])
  })

  it('infers the minimum state for characters not yet owned', () => {
    const { data, result } = merge({}, {}, [
      { role: 'Warrior', name: '陈', skill_mastery: [0, 0, 3] },
      { role: 'Caster', name: '阿米娅', elite: 1, skill_level: 7 },
    ])
    expect(result.inferred).toEqual(['chen', 'amiya'])
    expect(data.current.chen).toMatchObject({ elite: 2, level: 1, skillLevel: 7, skillMaster: {} })
    expect(data.goal.chen).toMatchObject({ elite: 2, level: 1, skillLevel: 7, skillMaster: { s3: 3 } })
    expect(data.current.amiya).toMatchObject({ elite: 0, level: 1, skillLevel: 1 })
    expect(data.goal.amiya).toMatchObject({ elite: 1, level: 1, skillLevel: 7 })
  })

  it('skips unknown names, targets beyond what the character has, and empty plans', () => {
    const { data, result } = merge({ fang: st({}) }, {}, [
      { name: '不存在' },
      { name: '芬', elite: 2 },
      { name: '芬', skill_mastery: [1] },
      { role: 'Warrior', name: '陈', skill_mastery: [0, 0, 0] },
    ])
    expect(result).toEqual({ unknown: ['不存在'], invalid: ['芬', '芬'], inferred: [] })
    expect(data.goal).toEqual({})
    expect(data.current.chen).toBeUndefined()
  })
})
