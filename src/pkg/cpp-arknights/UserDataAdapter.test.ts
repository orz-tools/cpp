import { describe, expect, it } from 'vitest'
import type { ArknightsDataManager, Character } from './DataManager'
import { ArknightsUserDataAdapter } from './UserDataAdapter'
import { ArknightsCharacterStatus } from './types'

const cost = (id: string, count: number) => ({ id, count })

const constants = {
  characterExpMap: [1, 2, 3].map((x) => Array<number>(100).fill(x)),
  characterUpgradeCostMap: [10, 20, 30].map((x) => Array<number>(100).fill(x)),
  evolveGoldCost: [[], [100], [], [], [], [300, 600]],
}

function character(key: string, rarity: number, maxLevels: number[], skillCount: number) {
  return {
    key,
    rarity,
    maxLevels,
    maxElite: maxLevels.length - 1,
    modUnlockLevel: 60,
    raw: {
      phases: [{ evolveCost: null }, { evolveCost: [cost('m1', 2)] }, { evolveCost: [cost('m2', 3)] }],
    },
    // 没有技能的干员在游戏数据里就是空表
    allSkillLvlup: skillCount > 0 ? Array.from({ length: 6 }, () => ({ lvlUpCost: [cost('s', 1)] })) : [],
    skills: Array.from({ length: skillCount }, (_, i) => ({
      skillId: `${key}_s${i + 1}`,
      charSkillIndex: i,
      charSkill: { levelUpCostCond: [1, 2, 3].map((n) => ({ levelUpCost: [cost(`m${n}`, 1)] })) },
    })),
    uniEquips: [],
  } as unknown as Character
}

const characters: Record<string, Character> = {
  six: character('six', 5, [50, 80, 90], 3),
  // 两星，像黑角：只到精零 30 级，没有技能
  two: character('two', 1, [30], 0),
}

function setup() {
  const dm = { data: { characters, constants } } as unknown as ArknightsDataManager
  return new ArknightsUserDataAdapter(dm)
}

const status = (
  elite: number,
  level: number,
  rest: Partial<ArknightsCharacterStatus> = {},
): ArknightsCharacterStatus => ({
  elite,
  level,
  skillLevel: 1,
  skillMaster: {},
  modLevel: {},
  potentialRank: 0,
  ...rest,
})

const typesOf = (
  uda: ArknightsUserDataAdapter,
  charId: string,
  from: ArknightsCharacterStatus,
  to: ArknightsCharacterStatus,
) => uda.generateTasksForCharacter(charId, from, to).map((x) => x.type)

describe('generateTasksForCharacter', () => {
  it('has no skill levels to pay for on an operator without skills, whatever the stored skill level', () => {
    const uda = setup()
    const levelled = [{ _: 'level', elite: 0, from: 1, to: 25 }]
    expect(typesOf(uda, 'two', status(0, 1), status(0, 25, { skillLevel: 4 }))).toEqual(levelled)
    expect(typesOf(uda, 'two', status(0, 1, { skillLevel: 2 }), status(0, 25, { skillLevel: 7 }))).toEqual(levelled)
  })

  it('stops at the end of the skill level, mastery and elite tables', () => {
    const uda = setup()
    const from = status(1, 80, { skillLevel: 7 })
    expect(typesOf(uda, 'six', from, status(1, 80, { skillLevel: 9 }))).toEqual([])
    expect(typesOf(uda, 'six', from, status(3, 1, { skillLevel: 7 }))).toEqual(
      typesOf(uda, 'six', from, status(2, 1, { skillLevel: 7 })),
    )
    const e2 = status(2, 1, { skillLevel: 7 })
    expect(typesOf(uda, 'six', e2, { ...e2, skillMaster: { six_s1: 5 } })).toEqual(
      typesOf(uda, 'six', e2, { ...e2, skillMaster: { six_s1: 3 } }),
    )
  })
})

describe('rewriteCharacters', () => {
  it('corrects a character without a plan, as imports write them', () => {
    const uda = setup()
    expect(uda.rewriteCharacters('two', status(0, 25, { skillLevel: 4 }), undefined)).toEqual([
      status(0, 25),
      undefined,
    ])
    expect(uda.rewriteCharacters('six', status(0, 40, { skillLevel: 7 }), undefined)).toEqual([
      status(0, 40, { skillLevel: 4 }),
      undefined,
    ])
  })

  it('keeps a character without a plan that the game data does not know', () => {
    const current = status(0, 25, { skillLevel: 4 })
    const [c, g] = setup().rewriteCharacters('new', current, undefined)
    expect(c).toBe(current)
    expect(c).toEqual(status(0, 25, { skillLevel: 4 }))
    expect(g).toBeUndefined()
  })

  it('drops a character without a plan that is not held', () => {
    expect(setup().rewriteCharacters('two', status(0, 0, { skillLevel: 4 }), undefined)).toEqual([undefined, undefined])
  })
})
