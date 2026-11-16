import { describe, expect, it } from 'vitest'
import type { Character } from './DataManager'
import { mergeMAAOperBox, parseMAADepot, parseMAAOperBox } from './maa'
import type { ArknightsCharacterStatus } from './types'

describe('parseMAADepot', () => {
  const expected = { '4001': 10836, '3003': 30 }

  it('reads the 明日方舟工具箱 export', () => {
    expect(parseMAADepot('{"4001":10836,"3003":30}')).toEqual(expected)
  })

  it('reads the 企鹅物流刷图规划 export', () => {
    expect(
      parseMAADepot(
        '{"@type":"@penguin-statistics/depot","items":[{"id":"4001","have":10836,"name":"龙门币"},{"id":"3003","have":30,"name":"赤金"}]}',
      ),
    ).toEqual(expected)
  })

  it('reads the CSV export', () => {
    expect(parseMAADepot('ID,Name,Count\r\n4001,龙门币,10836\r\n3003,"赤,金",30')).toEqual(expected)
  })

  it('reads the Markdown export', () => {
    expect(
      parseMAADepot(
        '# Arknights Depot Export\n\n| ID | Name | Count |\n| --- | --- | --- |\n| 4001 | 龙门币 | 10836 |\n| 3003 | 赤金 | 30 |',
      ),
    ).toEqual(expected)
  })

  it('rejects text it cannot read', () => {
    expect(() => parseMAADepot('hello')).toThrow()
    expect(() => parseMAADepot('[1,2]')).toThrow()
  })
})

const fakeCharacter = (key: string, opts: { skills?: string[][]; equips?: (string | null)[][] } = {}) =>
  ({
    key,
    modUnlockLevel: 60,
    skills: (opts.skills || []).map(([rawCharId, skillId]) => ({ rawCharId, skillId })),
    uniEquips: (opts.equips || []).map(([rawCharId, equipId, phase, typeName2]) => ({
      rawCharId,
      equipId,
      equip: { raw: { unlockEvolvePhase: phase, typeName2 } },
    })),
  }) as unknown as Character

const characters: Record<string, Character> = {
  char_2024_chyue: fakeCharacter('char_2024_chyue', {
    skills: [
      ['char_2024_chyue', 'skchr_chyue_1'],
      ['char_2024_chyue', 'skchr_chyue_2'],
    ],
    equips: [
      ['char_2024_chyue', 'uniequip_001_chyue', 'PHASE_0', null],
      ['char_2024_chyue', 'uniequip_002_chyue', 'PHASE_2', 'x'],
      ['char_2024_chyue', 'uniequip_003_chyue', 'PHASE_2', 'y'],
    ],
  }),
  char_002_amiya: fakeCharacter('char_002_amiya'),
  char_009_12fce: fakeCharacter('char_009_12fce'),
  char_010_chen: fakeCharacter('char_010_chen'),
}
const lookup = {
  getRealCharacterKey: (id: string) => (id === 'char_1001_amiya2' ? 'char_002_amiya' : id),
  getCharacter: (key: string) => characters[key],
}
const empty: ArknightsCharacterStatus = {
  elite: 0,
  level: 0,
  skillLevel: 1,
  skillMaster: {},
  modLevel: {},
  potentialRank: 0,
}
const status = (s: Partial<ArknightsCharacterStatus>) => ({ ...JSON.parse(JSON.stringify(empty)), ...s })

describe('mergeMAAOperBox', () => {
  it('keeps skill and module data the screenshot recognition does not have', () => {
    const current = {
      char_2024_chyue: status({
        elite: 2,
        level: 60,
        skillLevel: 7,
        skillMaster: { skchr_chyue_2: 3 },
        modLevel: { uniequip_002_chyue: 2 },
        potentialRank: 0,
      }),
    }
    const opers = parseMAAOperBox(
      '[{"id":"char_2024_chyue","name":"重岳","elite":2,"level":90,"own":true,"potential":2,"rarity":6}]',
    )
    const result = mergeMAAOperBox(lookup, current, empty, opers)
    expect(result).toEqual({ unknown: [], hasDetails: false })
    expect(current.char_2024_chyue).toEqual(
      status({
        elite: 2,
        level: 90,
        skillLevel: 7,
        skillMaster: { skchr_chyue_2: 3 },
        modLevel: { uniequip_002_chyue: 2 },
        potentialRank: 1,
      }),
    )
  })

  it('writes skill and module data from yituliu', () => {
    const current: Record<string, ArknightsCharacterStatus> = {
      char_2024_chyue: status({ skillMaster: { skchr_chyue_1: 1 }, modLevel: { uniequip_003_chyue: 1 } }),
    }
    const opers = parseMAAOperBox(
      JSON.stringify([
        {
          id: 'char_2024_chyue',
          elite: 2,
          level: 60,
          own: true,
          potential: 6,
          mainSkillLevel: 7,
          skills: [
            { id: 'skchr_chyue_1', level: 0 },
            { id: 'skchr_chyue_2', level: 3 },
          ],
          equips: [{ id: 'uniequip_002_chyue', type: 'X', level: 3 }],
        },
      ]),
    )
    expect(mergeMAAOperBox(lookup, current, empty, opers).hasDetails).toBe(true)
    expect(current.char_2024_chyue).toEqual(
      status({
        elite: 2,
        level: 60,
        skillLevel: 7,
        skillMaster: { skchr_chyue_2: 3 },
        modLevel: { uniequip_002_chyue: 3 },
        potentialRank: 5,
      }),
    )
  })

  it('matches modules by branch letter when the id is not a uniequip id', () => {
    const current: Record<string, ArknightsCharacterStatus> = {}
    const opers = parseMAAOperBox(
      '[{"id":"char_2024_chyue","elite":2,"level":90,"own":true,"potential":1,"equips":[{"id":"y","type":"Y","level":2}]}]',
    )
    mergeMAAOperBox(lookup, current, empty, opers)
    expect(current.char_2024_chyue.modLevel).toEqual({ uniequip_003_chyue: 2 })
  })

  it('removes characters marked not owned, but not a patch form whose other form is owned', () => {
    const current = {
      char_002_amiya: status({ elite: 1 }),
      char_009_12fce: status({ elite: 1 }),
      char_010_chen: status({ elite: 2 }),
    }
    const opers = parseMAAOperBox(
      JSON.stringify([
        { id: 'char_1001_amiya2', elite: 2, level: 1, own: true, potential: 6 },
        { id: 'char_002_amiya', elite: 0, level: 0, own: false, potential: 0 },
        { id: 'char_009_12fce', elite: 0, level: 0, own: false, potential: 0 },
        { id: 'char_9999_new', name: '新干员', elite: 0, level: 1, own: true, potential: 1 },
      ]),
    )
    expect(mergeMAAOperBox(lookup, current, empty, opers).unknown).toEqual(['新干员'])
    expect(Object.keys(current).sort()).toEqual(['char_002_amiya', 'char_010_chen'])
    expect(current.char_002_amiya).toMatchObject({ elite: 2, level: 1, potentialRank: 5 })
  })
})
