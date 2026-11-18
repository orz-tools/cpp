import { describe, expect, it, vi } from 'vitest'
import type { ArknightsDataManager, Character } from './DataManager'
import { ArknightsUserDataAdapter } from './UserDataAdapter'
import { CostBreakdown, TrainingCost } from './trainingCost'
import { AK_ITEM_GOLD, AK_ITEM_VIRTUAL_EXP, ArknightsCharacterStatus } from './types'

const cost = (id: string, count: number) => ({ id, count })

// 每级的经验、龙门币：精零 1 / 10，精一 2 / 20，精二 3 / 30
const constants = {
  characterExpMap: [1, 2, 3].map((x) => Array<number>(100).fill(x)),
  characterUpgradeCostMap: [10, 20, 30].map((x) => Array<number>(100).fill(x)),
  evolveGoldCost: [[], [], [100], [], [200, 400], [300, 600]],
}

const masteries = [[cost('m1', 1)], [cost('m2', 1)], [cost('m3', 1)]]

function character(key: string, rarity: number, maxLevels: number[], skills: (typeof masteries | null)[], mod = false) {
  return {
    key,
    rarity,
    maxLevels,
    maxElite: maxLevels.length - 1,
    modUnlockLevel: 60,
    raw: {
      displayNumber: key,
      phases: [{ evolveCost: null }, { evolveCost: [cost('m1', 2)] }, { evolveCost: [cost('m2', 3), cost('nv', 1)] }],
    },
    allSkillLvlup: Array.from({ length: 6 }, () => ({ lvlUpCost: [cost('s', 1)] })),
    skills: skills.map((m, i) => ({
      skillId: `${key}_s${i + 1}`,
      charSkillIndex: i,
      charSkill: { levelUpCostCond: (m ?? [[], [], []]).map((levelUpCost) => ({ levelUpCost })) },
    })),
    uniEquips: mod
      ? [
          {
            equipId: `${key}_eq`,
            equip: {
              raw: {
                unlockEvolvePhase: 'PHASE_2',
                itemCost: { 1: [cost('mod_unlock_token', 1)], 2: [cost('m3', 1)], 3: [cost('m3', 1)] },
              },
            },
          },
        ]
      : [],
  } as unknown as Character
}

const six = (key: string) => character(key, 5, [50, 80, 90], [masteries, masteries, masteries], true)

const characters: Record<string, Character> = {
  c6: six('c6'),
  c6b: six('c6b'),
  c6c: six('c6c'),
  c6d: six('c6d'),
  // 特殊干员，像机械师：游戏数据照样列了材料
  sp: Object.assign(six('sp'), { isSpecialOperator: true }),
  // 第二个技能专精不花材料
  c5: character('c5', 4, [50, 70, 80], [masteries, null]),
  c3: character('c3', 2, [40, 55], [null]),
}

const values: Record<string, number | undefined> = {
  [AK_ITEM_VIRTUAL_EXP]: 0.01,
  [AK_ITEM_GOLD]: 0.001,
  m1: 1,
  m2: 2,
  m3: 4,
  s: 0.5,
}

function setup(valuesOk = true) {
  const dm = { data: { characters, constants } } as unknown as ArknightsDataManager
  const uda = new ArknightsUserDataAdapter(dm)
  const tc = new TrainingCost({
    getCharacter: (key) => characters[key],
    getItem: (key) => ({ valueAsAp: values[key] }),
    getItemValues: () =>
      valuesOk
        ? { status: 'ok', values: new Map(), pricedCount: 0, droppedStages: [], elapsedMs: 0 }
        : { status: 'error', reason: 'test' },
    getUserDataAdapter: () => uda,
  })
  return { tc, uda, empty: uda.getFrozenEmptyCharacterStatus() }
}

const status = (
  elite: number,
  level: number,
  rest: Partial<ArknightsCharacterStatus> = {},
): ArknightsCharacterStatus => ({
  elite,
  level,
  skillLevel: elite > 0 ? 7 : 4,
  skillMaster: {},
  modLevel: {},
  potentialRank: 0,
  ...rest,
})
const zero = status(0, 1, { skillLevel: 1 })

const itemsOf = (x: CostBreakdown | null | undefined) => Object.fromEntries(x?.items ?? [])
const valueOf = (items: Record<string, number>) =>
  Object.entries(items).reduce((sum, [k, n]) => sum + (values[k] ?? 0) * n, 0)
/** 几段的材料加起来 */
const sumItems = (...xs: (CostBreakdown | undefined)[]) => {
  const sum: Record<string, number> = {}
  for (const x of xs) for (const [k, n] of x?.items ?? []) sum[k] = (sum[k] ?? 0) + n
  return sum
}

describe('costBetween', () => {
  it('adds up the quantities times the item values, with the levelling experience as one item', () => {
    const { tc } = setup()
    const r = tc.costBetween('c6', zero, status(1, 1, { skillLevel: 1 }))
    // 精零 1 → 50 级：49 级经验和龙门币；精一：300 龙门币和 2 个 m1
    expect(itemsOf(r)).toEqual({ [AK_ITEM_VIRTUAL_EXP]: 49, [AK_ITEM_GOLD]: 490 + 300, m1: 2 })
    expect(r.value).toBeCloseTo(valueOf(itemsOf(r)))
    expect(r.unvalued).toEqual([])
  })

  it('counts an item without a value as 0 and names it', () => {
    const { tc } = setup()
    const r = tc.costBetween('c6', status(1, 1), status(2, 1))
    expect(itemsOf(r)).toEqual({ [AK_ITEM_VIRTUAL_EXP]: 79 * 2, [AK_ITEM_GOLD]: 79 * 20 + 600, m2: 3, nv: 1 })
    expect(r.value).toBeCloseTo(valueOf(itemsOf(r)))
    expect(r.unvalued).toEqual(['nv'])
  })

  it('has no value while the item values cannot be computed, and the same items', () => {
    const ok = setup().tc.costBetween('c6', status(1, 1), status(2, 1))
    const { tc } = setup(false)
    expect(tc.valuesOk).toBe(false)
    const r = tc.costBetween('c6', status(1, 1), status(2, 1))
    expect(r.value).toBeNaN()
    expect(itemsOf(r)).toEqual(itemsOf(ok))
  })
})

describe('elite2Saving', () => {
  it('starts from E0 level 1 for a character not held', () => {
    const { tc, empty } = setup()
    expect(itemsOf(tc.elite2Saving(characters.c6, empty))).toEqual(
      itemsOf(tc.costBetween('c6', zero, { ...zero, elite: 2, level: 1 })),
    )
  })

  it('starts from the current level', () => {
    const { tc } = setup()
    const current = status(1, 60)
    const r = tc.elite2Saving(characters.c6, current)
    expect(itemsOf(r)).toEqual(itemsOf(tc.costBetween('c6', current, { ...current, elite: 2, level: 1 })))
    expect(r!.items.get(AK_ITEM_VIRTUAL_EXP)).toBe(20 * 2)
  })

  it('has nothing for E2 or for 1–3 stars', () => {
    const { tc, empty } = setup()
    expect(tc.elite2Saving(characters.c6, status(2, 1))).toBeNull()
    expect(tc.elite2Saving(characters.c3, empty)).toBeNull()
  })

  it('has no items for a special operator', () => {
    const { tc, empty } = setup()
    expect(tc.elite2Saving(characters.sp, empty)!.items.size).toBe(0)
    expect(tc.elite2Saving(characters.sp, empty)!.value).toBe(0)
  })
})

describe('mastery3Saving', () => {
  it('counts the remaining mastery levels only', () => {
    const { tc } = setup()
    const current = status(2, 40, { skillMaster: { c6_s1: 1 } })
    expect(itemsOf(tc.mastery3Saving(characters.c6, current, 0))).toEqual({ m2: 1, m3: 1 })
  })

  it('leaves out E2 and the skill levels when the voucher cannot be used yet', () => {
    const { tc, empty } = setup()
    for (const current of [status(2, 1, { skillLevel: 6 }), status(1, 70), empty]) {
      expect(itemsOf(tc.mastery3Saving(characters.c6, current, 1))).toEqual({ m1: 1, m2: 1, m3: 1 })
    }
  })

  it('has nothing for a skill at M3, and no items for a mastery that costs nothing', () => {
    const { tc, empty } = setup()
    expect(tc.mastery3Saving(characters.c6, status(2, 1, { skillMaster: { c6_s3: 3 } }), 2)).toBeNull()
    expect(tc.mastery3Saving(characters.c5, empty, 1)!.items.size).toBe(0)
    expect(tc.mastery3Saving(characters.c3, empty, 0)).toBeNull()
  })
})

describe('levelMaxSaving', () => {
  it('starts from the current E2 level, or from E2 level 1', () => {
    const { tc } = setup()
    expect(itemsOf(tc.levelMaxSaving(characters.c6, status(2, 30)))).toEqual({
      [AK_ITEM_VIRTUAL_EXP]: 60 * 3,
      [AK_ITEM_GOLD]: 60 * 30,
    })
    expect(itemsOf(tc.levelMaxSaving(characters.c6, status(1, 70)))).toEqual({
      [AK_ITEM_VIRTUAL_EXP]: 89 * 3,
      [AK_ITEM_GOLD]: 89 * 30,
    })
    expect(tc.levelMaxSaving(characters.c6, status(2, 90))).toBeNull()
  })
})

describe('invested', () => {
  it('is from E0 level 1 to now, and nothing for a character not held', () => {
    const { tc, empty } = setup()
    expect(tc.invested(characters.c6, empty)).toBeNull()
    const current = status(2, 30, { skillMaster: { c6_s1: 1 } })
    expect(itemsOf(tc.invested(characters.c6, current))).toEqual(itemsOf(tc.costBetween('c6', zero, current)))
  })
})

describe('costMatrix', () => {
  const cells = (m: ReturnType<TrainingCost['costMatrix']>) => Object.keys(m.cells).sort()

  it('has every cell with a plan, and the track adds up to zero → full', () => {
    const { tc } = setup()
    const m = tc.costMatrix(characters.c6, status(1, 50), status(2, 1, { skillMaster: { c6_s1: 3 } }))
    expect(cells(m)).toEqual(['goalFull', 'nowFull', 'nowGoal', 'zeroFull', 'zeroGoal', 'zeroNow'])
    expect(m.defaultCell).toBe('nowGoal')
    expect(m.track.invested).toBe(m.cells.zeroNow)
    expect(m.track.remaining).toBe(m.cells.nowGoal)
    expect(m.track.rest).toBe(m.cells.goalFull)
    expect(sumItems(m.track.invested, m.track.remaining, m.track.rest)).toEqual(itemsOf(m.cells.zeroFull))
    expect(m.track.invested!.value + m.track.remaining!.value + m.track.rest.value).toBeCloseTo(m.cells.zeroFull!.value)
  })

  it('has no goal cells without a plan', () => {
    const { tc } = setup()
    const m = tc.costMatrix(characters.c6, status(2, 1), undefined)
    expect(cells(m)).toEqual(['nowFull', 'zeroFull', 'zeroNow'])
    expect(m.defaultCell).toBe('nowFull')
    expect(m.track.remaining).toBeUndefined()
    expect(m.track.rest).toBe(m.cells.nowFull)
    expect(sumItems(m.track.invested, m.track.rest)).toEqual(itemsOf(m.cells.zeroFull))
  })

  it('has no current cells for a character not held', () => {
    const { tc, empty } = setup()
    const planned = tc.costMatrix(characters.c6, empty, status(1, 1))
    expect(cells(planned)).toEqual(['goalFull', 'zeroFull', 'zeroGoal'])
    expect(planned.defaultCell).toBe('zeroGoal')
    expect(planned.track.invested).toBeUndefined()
    expect(planned.track.remaining).toBe(planned.cells.zeroGoal)
    expect(sumItems(planned.track.remaining, planned.track.rest)).toEqual(itemsOf(planned.cells.zeroFull))

    const unplanned = tc.costMatrix(characters.c6, empty, undefined)
    expect(cells(unplanned)).toEqual(['zeroFull'])
    expect(unplanned.defaultCell).toBe('zeroFull')
    expect(unplanned.track.rest).toBe(unplanned.cells.zeroFull)
  })

  it('has no items anywhere for a special operator', () => {
    const { tc } = setup()
    const m = tc.costMatrix(characters.sp, status(1, 50), status(2, 1, { skillMaster: { sp_s1: 3 } }))
    expect(cells(m)).toEqual(['goalFull', 'nowFull', 'nowGoal', 'zeroFull', 'zeroGoal', 'zeroNow'])
    expect(Object.values(m.cells).filter((x) => x.items.size > 0)).toEqual([])
  })
})

describe('rarityRank', () => {
  const currents = {
    c6: status(1, 1),
    c6c: status(2, 1, { skillMaster: { c6c_s1: 3, c6c_s2: 1 } }),
  }

  it('compares with the same rarity only, from where each can use the voucher', () => {
    const { tc } = setup()
    // c6b、c6d 没持有，从零算，并列第一；c6 精一 1 级，省得最少；c6c 已精二、sp 是特殊干员，都不算
    const fromZero = tc.elite2Saving(characters.c6b, setup().empty)!.value
    const c6 = tc.elite2Saving(characters.c6, currents.c6)!.value
    expect(tc.rarityRank('elite2', characters.c6b, undefined, currents)).toEqual({
      values: [fromZero, fromZero, c6],
      rank: 1,
      count: 3,
    })
    expect(tc.rarityRank('elite2', characters.c6d, undefined, currents)!.rank).toBe(1)
    expect(tc.rarityRank('elite2', characters.c6, undefined, currents)!.rank).toBe(3)
    expect(tc.rarityRank('elite2', characters.c6c, undefined, currents)).toBeNull()
    expect(tc.rarityRank('elite2', characters.c5, undefined, currents)!.count).toBe(1)
  })

  it('ranks every skill, leaving out the ones at M3 and the free ones', () => {
    const { tc } = setup()
    // c6、c6b、c6d 各三个技能都是专零；c6c 一技能已专三，二技能专一；sp 是特殊干员，不算
    const r = tc.rarityRank('mastery3', characters.c6c, 1, currents)!
    expect(r.count).toBe(11)
    expect(r.rank).toBe(11)
    expect(tc.rarityRank('mastery3', characters.c6c, 0, currents)).toBeNull()
    expect(tc.rarityRank('mastery3', characters.sp, 0, currents)).toBeNull()
    expect(tc.rarityRank('mastery3', characters.c5, 0, currents)!.count).toBe(1)
    expect(tc.rarityRank('mastery3', characters.c5, 1, currents)).toBeNull()
  })

  it('has no rank while the item values cannot be computed', () => {
    const { tc } = setup(false)
    expect(tc.rarityRank('elite2', characters.c6b, undefined, currents)).toBeNull()
  })

  it('computes the peers once per currents object', () => {
    const { tc, uda } = setup()
    const spy = vi.spyOn(uda, 'generateTasksForCharacter')
    tc.rarityRank('mastery3', characters.c6, 0, currents)
    const calls = spy.mock.calls.length
    expect(calls).toBeGreaterThan(0)
    tc.rarityRank('mastery3', characters.c6b, 2, currents)
    expect(spy.mock.calls.length).toBe(calls)
  })
})
