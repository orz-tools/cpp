import { describe, expect, it } from 'vitest'
import {
  ArkntoolsCharacter,
  buildArkntoolsBackup,
  decodeArkntoolsBackup,
  encodeArkntoolsBackup,
  isArkntoolsStageBlacklistDifferent,
  mergeArkntoolsBackup,
} from './arkntools'
import { ArknightsCharacterStatus } from './types'

type Char = ArkntoolsCharacter & { charIds: string[]; isSpecialOperator: boolean }

function char(
  key: string,
  rarity: number,
  forms: Record<string, { skills: (string | [string, false])[]; mods?: string[] }>,
  isSpecialOperator = false,
): Char {
  const entries = Object.entries(forms)
  return {
    key,
    rarity,
    modUnlockLevel: 60,
    charIds: entries.map(([id]) => id),
    isSpecialOperator,
    skills: entries.flatMap(([rawCharId, f]) =>
      f.skills.map((s) => {
        const [skillId, masterable] = typeof s === 'string' ? [s, true] : s
        return { skillId, rawCharId, charSkill: { levelUpCostCond: masterable ? [1, 2, 3] : [] } }
      }),
    ),
    uniEquips: entries.flatMap(([rawCharId, f]) => [
      { equipId: `uniequip_001_${rawCharId}`, rawCharId, equip: { raw: { unlockEvolvePhase: 'PHASE_0' } } },
      ...(f.mods || []).map((equipId) => ({ equipId, rawCharId, equip: { raw: { unlockEvolvePhase: 'PHASE_2' } } })),
    ]),
  }
}

const chars: Record<string, Char> = {
  char_010_chen: char('char_010_chen', 5, { char_010_chen: { skills: ['s1', 's2', 's3'], mods: ['m_chen_x'] } }),
  char_002_amiya: char('char_002_amiya', 4, {
    char_002_amiya: { skills: ['a1', 'a2', 'a3'] },
    char_1001_amiya2: { skills: ['g1', 'g2'], mods: ['m_amiya2'] },
  }),
  char_123_fang: char('char_123_fang', 2, { char_123_fang: { skills: [['f1', false]] } }),
  char_285_medic2: char('char_285_medic2', 0, { char_285_medic2: { skills: [] } }),
  char_4230_mcnist: char('char_4230_mcnist', 5, { char_4230_mcnist: { skills: ['n1', 'n2', 'n3'] } }, true),
}

const ga = {
  getRealCharacterKey: (id: string) => (id === 'char_1001_amiya2' ? 'char_002_amiya' : id),
  getCharacter: (key: string) => chars[key],
}

const empty: ArknightsCharacterStatus = Object.freeze({
  elite: 0,
  level: 0,
  skillLevel: 1,
  skillMaster: {},
  modLevel: {},
  potentialRank: 0,
})

function st(partial: Partial<ArknightsCharacterStatus>): ArknightsCharacterStatus {
  return { elite: 0, level: 1, skillLevel: 1, skillMaster: {}, modLevel: {}, potentialRank: 0, ...partial }
}

function preset(name: string, setting: object) {
  return {
    name,
    setting: {
      evolve: [false, false],
      skills: { normal: [false, 1, 7], elite: [] },
      uniequip: {},
      state: 'edit',
      focus: false,
      ...setting,
    },
  }
}

function encode(json: object) {
  return Buffer.from(JSON.stringify(json), 'utf-8').toString('base64')
}

describe('decodeArkntoolsBackup', () => {
  it('reads the base64 text and older field shapes', () => {
    const text = encode({
      inputs: { '30012': [10, 3], '30013': { need: '', have: '7' } },
      presets: [preset('010_chen', { skills: { normal: [true, '4', '7'] }, uniequip: { m_chen_x: true } })],
      planStageBlacklist: ['1-7'],
    })
    const backup = decodeArkntoolsBackup(`\n${text.slice(0, 20)}\n${text.slice(20)}  `)
    expect(backup.inputs).toEqual({ '30012': [10, 3], '30013': [0, 7] })
    expect(backup.presets![0].setting.skills).toEqual({ normal: [true, 4, 7], elite: [] })
    expect(backup.presets![0].setting.uniequip).toEqual({ m_chen_x: [true, 0, 3] })
    expect(backup.planStageBlacklist).toEqual(['1-7'])
  })

  it('fills in the settings a preset leaves out', () => {
    const backup = decodeArkntoolsBackup(JSON.stringify({ presets: [{ name: '010_chen', setting: {} }] }))
    expect(backup.presets![0].setting).toEqual({
      evolve: [],
      skills: { normal: [false, 1, 7], elite: [] },
      uniequip: {},
    })
  })

  it('round-trips through its own encoding, also as plain JSON', () => {
    const backup = decodeArkntoolsBackup(JSON.stringify({ inputs: { '3301': [1, 2] } }))
    expect(decodeArkntoolsBackup(encodeArkntoolsBackup(backup))).toEqual(backup)
  })

  it('rejects text that is not a backup', () => {
    expect(() => decodeArkntoolsBackup('hello')).toThrow()
    expect(() => decodeArkntoolsBackup(encode({ presets: 'x' }))).toThrow()
  })
})

describe('mergeArkntoolsBackup', () => {
  function merge(data: Parameters<typeof mergeArkntoolsBackup>[1], json: object) {
    return mergeArkntoolsBackup(ga, data, empty, decodeArkntoolsBackup(encode(json)), (id) => id !== '30099')
  }

  it('replaces tracked inventory and keeps what arkntools does not track', () => {
    const data = { current: {}, goal: {}, items: { '30011': 5, '30012': 1, '4001': 100000, '2001': 3 } }
    merge(data, { inputs: { '30012': [4, 9], '3301': [3, 0], '30099': [0, 1] } })
    expect(data.items).toEqual({ '30012': 9, '3301': 0, '4001': 100000, '2001': 3 })
  })

  it('raises goals of owned characters without touching current or lowering goals', () => {
    const data = {
      current: { char_010_chen: st({ elite: 2, level: 70, skillLevel: 7, skillMaster: { s1: 1 } }) },
      goal: { char_010_chen: st({ elite: 2, level: 90, skillLevel: 7, skillMaster: { s1: 1, s2: 3 } }) },
      items: {},
    }
    merge(data, {
      presets: [
        preset('010_chen', {
          skills: {
            normal: [false, 1, 7],
            elite: [
              [true, 8, 10],
              [true, 7, 9],
              [false, 7, 10],
            ],
          },
          uniequip: { m_chen_x: [true, 0, 2] },
        }),
      ],
    })
    expect(data.current.char_010_chen).toEqual(st({ elite: 2, level: 70, skillLevel: 7, skillMaster: { s1: 1 } }))
    expect(data.goal.char_010_chen).toEqual(
      st({ elite: 2, level: 90, skillLevel: 7, skillMaster: { s1: 3, s2: 3 }, modLevel: { m_chen_x: 2 } }),
    )
  })

  it('infers current from the plan start for characters cpp has no record of', () => {
    const data = { current: {}, goal: {}, items: {} } as Parameters<typeof mergeArkntoolsBackup>[1]
    const r = merge(data, {
      presets: [
        preset('010_chen', { uniequip: { m_chen_x: [true, 1, 3] } }),
        preset('002_amiya', { evolve: [false, true], skills: { normal: [true, 6, 7], elite: [] } }),
        preset('1001_amiya2', { skills: { normal: [false, 1, 7], elite: [[true, 7, 10]] } }),
        preset('999_nobody', {}),
      ],
    })
    expect(r).toEqual({ unknown: ['999_nobody'], inferred: ['char_010_chen', 'char_002_amiya'] })
    expect(data.current.char_010_chen).toEqual(st({ elite: 2, level: 60, modLevel: { m_chen_x: 1 } }))
    expect(data.goal.char_010_chen).toEqual(st({ elite: 2, level: 60, modLevel: { m_chen_x: 3 } }))
    // 精英化和技能等级各形态共用，以本体勾选的起点为准，不用近卫形态专精推断出的精二、7 级
    expect(data.current.char_002_amiya).toEqual(st({ elite: 1, skillLevel: 6, skillMaster: { g1: 0 } }))
    expect(data.goal.char_002_amiya).toEqual(st({ elite: 2, skillLevel: 7, skillMaster: { g1: 3 } }))
  })
})

describe('buildArkntoolsBackup', () => {
  it('writes each form as a preset with ranges from current to goal', () => {
    const r = buildArkntoolsBackup(
      {
        goalOrder: ['char_002_amiya', 'char_285_medic2', 'char_010_chen'],
        current: {
          char_002_amiya: st({ elite: 1, level: 40, skillLevel: 6 }),
          char_010_chen: st({ elite: 2, level: 60, skillLevel: 7, skillMaster: { s1: 2 } }),
          char_285_medic2: st({}),
        },
        goal: {
          char_002_amiya: st({ elite: 2, level: 1, skillLevel: 7, skillMaster: { g2: 3 } }),
          char_010_chen: st({ elite: 2, level: 90, skillLevel: 7, skillMaster: { s1: 3 }, modLevel: { m_chen_x: 3 } }),
          char_285_medic2: st({ level: 30 }),
        },
        items: { '30012': 5, '4001': 99, '3301': 0 },
      },
      empty,
      (key) => chars[key],
      (key) =>
        key === 'char_010_chen'
          ? [
              { itemId: '30012', quantity: 2 },
              { itemId: '4001', quantity: 1000 },
              { itemId: '3303', quantity: 8 },
            ]
          : [{ itemId: '30012', quantity: 1 }],
      ['1-7', '1-7', 'S4-1'],
    )

    expect(r.presets).toBe(3)
    expect(r.partial).toBe(1)
    expect(r.excluded).toBe(1)
    expect(r.special).toBe(0)
    expect(r.backup).toEqual({
      inputs: { '30012': [3, 5], '3303': [8, 0] },
      presets: [
        {
          name: '002_amiya',
          setting: {
            evolve: [false, true],
            skills: {
              normal: [true, 6, 7],
              elite: [
                [false, 7, 10],
                [false, 7, 10],
                [false, 7, 10],
              ],
            },
            uniequip: {},
            focus: false,
          },
        },
        {
          name: '1001_amiya2',
          setting: {
            evolve: [false, false],
            skills: {
              normal: [false, 1, 7],
              elite: [
                [false, 7, 10],
                [true, 7, 10],
              ],
            },
            uniequip: {},
            focus: false,
          },
        },
        {
          name: '010_chen',
          setting: {
            evolve: [false, false],
            skills: {
              normal: [false, 1, 7],
              elite: [
                [true, 9, 10],
                [false, 7, 10],
                [false, 7, 10],
              ],
            },
            uniequip: { m_chen_x: [true, 0, 3] },
            focus: false,
          },
        },
      ],
      planStageBlacklist: ['1-7', 'S4-1'],
    })
  })

  it('leaves out special operators, plans and materials alike', () => {
    const r = buildArkntoolsBackup(
      {
        goalOrder: ['char_4230_mcnist'],
        current: { char_4230_mcnist: st({ elite: 1, level: 40, skillLevel: 4 }) },
        goal: { char_4230_mcnist: st({ elite: 2, level: 1, skillLevel: 7, skillMaster: { n1: 3 } }) },
        items: {},
      },
      empty,
      (key) => chars[key],
      () => [{ itemId: '30012', quantity: 1 }],
      [],
    )
    expect(r.special).toBe(1)
    expect(r.presets).toBe(0)
    expect(r.backup.inputs).toEqual({})
  })

  it('imports back to the same goals', () => {
    const current = { char_010_chen: st({ elite: 1, level: 50, skillLevel: 4 }) }
    const goal = {
      char_010_chen: st({ elite: 2, level: 60, skillLevel: 7, skillMaster: { s3: 3 }, modLevel: { m_chen_x: 1 } }),
    }
    const { backup } = buildArkntoolsBackup(
      { goalOrder: ['char_010_chen'], current, goal, items: {} },
      empty,
      (key) => chars[key],
      () => [],
      [],
    )
    const data = { current: structuredClone(current), goal: {}, items: {} }
    mergeArkntoolsBackup(ga, data, empty, decodeArkntoolsBackup(encodeArkntoolsBackup(backup)), () => true)
    expect(data.goal).toEqual(goal)
  })
})

describe('isArkntoolsStageBlacklistDifferent', () => {
  const stageCodes = { main_01_07: '1-7', tough_01_07: '1-7', main_04_06: '4-6', act_gt_05: 'GT-5' }

  it('compares by code, ignoring codes cpp does not have', () => {
    expect(isArkntoolsStageBlacklistDifferent(['1-7', 'XX-1'], ['main_01_07'], stageCodes)).toBe(false)
    expect(isArkntoolsStageBlacklistDifferent([], [], stageCodes)).toBe(false)
  })

  it('reports a stage excluded on only one side', () => {
    expect(isArkntoolsStageBlacklistDifferent(['1-7'], [], stageCodes)).toBe(true)
    expect(isArkntoolsStageBlacklistDifferent([], ['act_gt_05'], stageCodes)).toBe(true)
    expect(isArkntoolsStageBlacklistDifferent(['1-7'], ['main_04_06'], stageCodes)).toBe(true)
  })
})
