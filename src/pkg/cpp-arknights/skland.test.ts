import { describe, expect, it } from 'vitest'
import type { Character } from './DataManager'
import { SklandCharacterNotFoundError, SklandData, mergeSklandData, parseSklandData } from './skland'
import type { ArknightsCharacterStatus } from './types'

const fakeCharacter = (key: string, opts: { skills?: string[]; equips?: string[][]; hasPatches?: boolean } = {}) =>
  ({
    key,
    modUnlockLevel: 60,
    hasPatches: !!opts.hasPatches,
    skills: (opts.skills || []).map((skillId, charSkillIndex) => ({ rawCharId: key, skillId, charSkillIndex })),
    uniEquips: (opts.equips || []).map(([equipId, phase]) => ({
      rawCharId: key,
      equipId,
      equip: { raw: { unlockEvolvePhase: phase } },
    })),
  }) as unknown as Character

const characters: Record<string, Character> = {
  char_010_chen: fakeCharacter('char_010_chen', {
    skills: ['skchr_chen_1', 'skchr_chen_2', 'skchr_chen_3'],
    equips: [
      ['uniequip_001_chen', 'PHASE_0'],
      ['uniequip_002_chen', 'PHASE_2'],
      ['uniequip_003_chen', 'PHASE_2'],
    ],
  }),
  char_002_amiya: fakeCharacter('char_002_amiya', { skills: ['skchr_amiya_1'], hasPatches: true }),
  char_009_12fce: fakeCharacter('char_009_12fce'),
}
const ga = {
  getRealCharacterKey: (id: string) => id,
  getCharacter: (key: string) => characters[key],
  getItem: (key: string) => (['4001', '30012'].includes(key) ? {} : undefined),
}
const empty: ArknightsCharacterStatus = Object.freeze({
  elite: 0,
  level: 0,
  skillLevel: 1,
  skillMaster: {},
  modLevel: {},
  potentialRank: 0,
})
const status = (s: Partial<ArknightsCharacterStatus>) => ({ ...JSON.parse(JSON.stringify(empty)), ...s })

const chen = {
  charId: 'char_010_chen',
  level: 70,
  evolvePhase: 2,
  potentialRank: 2,
  mainSkillLvl: 7,
  skills: [
    { id: 'skchr_chen_1', specializeLevel: 0 },
    { id: 'skchr_chen_2', specializeLevel: 2 },
    { id: 'skchr_chen_3', specializeLevel: 3 },
  ],
  equip: [
    { id: 'uniequip_001_chen', level: 1 },
    { id: 'uniequip_002_chen', level: 2 },
    { id: 'uniequip_003_chen', level: 1 },
  ],
  defaultEquipId: 'uniequip_002_chen',
}
const sklandData = (data: Partial<SklandData>): SklandData => ({ chars: [], ...data })

describe('parseSklandData', () => {
  it('reads the data with or without the response envelope', () => {
    const data = { chars: [chen] }
    expect(parseSklandData(JSON.stringify(data))).toEqual(data)
    expect(parseSklandData(JSON.stringify({ code: 0, message: 'OK', data }))).toEqual(data)
  })

  it('rejects data of another shape', () => {
    expect(() => parseSklandData('{"chars":[{"charId":"char_010_chen"}]}')).toThrow()
    expect(() => parseSklandData('[{"id":"char_010_chen","own":true}]')).toThrow()
  })
})

describe('mergeSklandData', () => {
  it('writes chars and removes characters it does not list', () => {
    const draft = {
      current: {
        char_010_chen: status({ skillMaster: { skchr_chen_1: 1 }, modLevel: { uniequip_003_chen: 2 } }),
        char_009_12fce: status({ elite: 1, level: 1 }),
      },
      items: {},
    }
    const result = mergeSklandData(ga, draft, empty, sklandData({ chars: [chen] }))
    expect(result).toEqual({ ambiguousEquip: true, trainingAmiya: false })
    expect(draft.current).toEqual({
      char_010_chen: status({
        elite: 2,
        level: 70,
        skillLevel: 7,
        potentialRank: 2,
        skillMaster: { skchr_chen_2: 2, skchr_chen_3: 3 },
        // uniequip_003 只报了 1 级且不是默认模组，分不清开没开，保留原值
        modLevel: { uniequip_002_chen: 2, uniequip_003_chen: 2 },
      }),
    })
  })

  it('reads 1-level modules by their locked flag', () => {
    const draft = { current: {} as Record<string, ArknightsCharacterStatus>, items: {} }
    const data = sklandData({
      chars: [
        {
          ...chen,
          equip: [
            { id: 'uniequip_002_chen', level: 1, locked: false },
            { id: 'uniequip_003_chen', level: 1, locked: true },
          ],
        },
      ],
    })
    expect(mergeSklandData(ga, draft, empty, data).ambiguousEquip).toBe(false)
    expect(draft.current.char_010_chen.modLevel).toEqual({ uniequip_003_chen: 1 })
  })

  it('writes cultivate characters and items', () => {
    const draft = {
      current: { char_009_12fce: status({ elite: 1, level: 1 }) },
      items: { '4001': 1, '30013': 5 } as Record<string, number>,
    }
    const data = sklandData({
      chars: [chen],
      cultivate: {
        characters: [
          {
            id: 'char_010_chen',
            level: 60,
            evolvePhase: 2,
            mainSkillLevel: 7,
            skills: [{ id: 'skchr_chen_3', level: 1 }],
            equips: [{ id: 'uniequip_003_chen', level: 1 }],
            potentialRank: 0,
          },
        ],
        items: [
          { id: '4001', count: '10836' },
          { id: '30012', count: '7' },
          { id: '99999', count: '1' },
        ],
      },
    })
    const result = mergeSklandData(ga, draft, empty, data)
    expect(result).toEqual({ ambiguousEquip: false, trainingAmiya: false })
    expect(draft.current).toEqual({
      char_010_chen: status({
        elite: 2,
        level: 60,
        skillLevel: 7,
        skillMaster: { skchr_chen_3: 1 },
        modLevel: { uniequip_003_chen: 1 },
      }),
    })
    expect(draft.items).toEqual({ '4001': 10836, '30012': 7 })
  })

  it('stops at a character cpp does not know', () => {
    const draft = { current: {}, items: {} }
    const data = sklandData({ chars: [{ ...chen, charId: 'char_9999_new' }] })
    expect(() => mergeSklandData(ga, draft, empty, data)).toThrow(SklandCharacterNotFoundError)
    expect(() => mergeSklandData(ga, draft, empty, data)).toThrow('char_9999_new')
  })

  it('adds the mastery level the training room is working on', () => {
    const draft = { current: {}, items: {} } as { current: Record<string, ArknightsCharacterStatus>; items: {} }
    const data = sklandData({
      chars: [chen],
      building: { training: { trainee: { charId: 'char_010_chen', targetSkill: 1 }, remainPoint: 1 } },
    })
    expect(mergeSklandData(ga, draft, empty, data)).toEqual({ ambiguousEquip: true, trainingAmiya: false })
    expect(draft.current.char_010_chen.skillMaster).toEqual({ skchr_chen_2: 3, skchr_chen_3: 3 })
  })

  it('leaves Amiya in the training room alone, and reports what it cannot read', () => {
    const amiya = { ...chen, charId: 'char_002_amiya', skills: [], equip: [], defaultEquipId: '' }
    const training = (charId: string, targetSkill: number) =>
      sklandData({ chars: [chen, amiya], building: { training: { trainee: { charId, targetSkill }, remainPoint: 1 } } })

    const amiyaResult = mergeSklandData(ga, { current: {}, items: {} }, empty, training('char_002_amiya', 0))
    expect(amiyaResult.trainingAmiya).toBe(true)
    expect(amiyaResult.trainingError).toBeUndefined()

    const mastered = mergeSklandData(ga, { current: {}, items: {} }, empty, training('char_010_chen', 2))
    expect(mastered.trainingError).toContain('"charId":"char_010_chen"')
    expect(mastered.trainingError).toContain('Skill already mastered to level 3')
  })
})
