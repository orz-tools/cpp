import { describe, expect, it, vi } from 'vitest'
import { ArknightsSnapshot, Character, Skill, UniEquip, generateBaseBuffs } from './DataManager'
import { ArknightsAdapter } from './GameAdapter'

vi.mock('localforage', () => ({
  default: {
    dropInstance: () => Promise.resolve(),
    createInstance: () => ({ removeItem: () => Promise.resolve() }),
  },
}))

function snapshot(skillName: string): ArknightsSnapshot {
  const s = {
    raw: { exPatchCharacters: { infos: {}, patchChars: {} } },
    getItemValue: () => undefined,
  } as unknown as ArknightsSnapshot
  s.data = {
    skills: { skchr_test_1: new Skill('skchr_test_1', { levels: [{ name: skillName }] } as any, null, s) },
  } as unknown as ArknightsSnapshot['data']
  return s
}

describe('data objects', () => {
  it('keep reading the snapshot they were built from', () => {
    const a = snapshot('A')
    const character = new Character('char_test', { skills: [{ skillId: 'skchr_test_1' }] } as any, null, a)
    snapshot('B')
    expect(character.skills[0].skill.name).toBe('A')
  })
})

function missionSnapshot(withMissions: boolean): ArknightsSnapshot {
  const mission = (sort: number, desc: string) => ({
    template: 'EquipmentSquadNoAnyDead',
    desc,
    paramList: [],
    uniEquipId: 'uniequip_002_test',
    uniEquipMissionSort: sort,
    jumpStageId: null,
  })
  return {
    raw: {
      exPatchCharacters: { infos: {}, patchChars: {} },
      exUniEquips: withMissions
        ? { missionList: { uniequip_002_test_1: mission(2, '第二条'), uniequip_002_test_2: mission(1, '第一条') } }
        : {},
      local: withMissions ? { exUniEquips: { missionList: { uniequip_002_test_2: mission(1, 'the first') } } } : null,
    },
    getItemValue: () => undefined,
  } as unknown as ArknightsSnapshot
}

describe('module missions', () => {
  it('come sorted by uniEquipMissionSort, in the local language where it has them', () => {
    const s = missionSnapshot(true)
    const raw = {
      charId: 'char_test',
      missionList: ['uniequip_002_test_1', 'uniequip_002_test_2', 'uniequip_002_gone'],
    }
    const equip = new UniEquip('uniequip_002_test', raw as any, null, s)
    expect(equip.missions.map((x) => [x.id, x.desc])).toEqual([
      ['uniequip_002_test_2', 'the first'],
      ['uniequip_002_test_1', '第二条'],
    ])
    expect(equip.formId).toBe('char_test')
  })

  it('read as none in data published before them', () => {
    const s = missionSnapshot(false)
    const equip = new UniEquip('uniequip_002_test', { charId: 'char_test' } as any, null, s)
    expect(equip.missions).toEqual([])
    expect(equip.tmplId).toBeNull()
    const character = new Character('char_test', { skills: [] } as any, null, s)
    expect(character.position).toBe('NONE')
    expect(character.getPatchPosition('char_test')).toBe('NONE')
  })
})

function baseSkillSnapshot(): ArknightsSnapshot {
  const buff = (buffName: string) => ({
    buffName,
    roomType: 'MANUFACTURE',
    skillIcon: 'bskill_man_spd1',
    efficiency: 15,
    sortId: 1,
  })
  const slot = (...ids: [string, string, number][]) => ({
    buffData: ids.map(([buffId, phase, level]) => ({ buffId, cond: { phase, level } })),
  })
  const s = {
    raw: {
      exPatchCharacters: { infos: {}, patchChars: {} },
      exBuilding: {
        buffs: { 'manu_prod_spd[000]': buff('标准化·α'), 'manu_prod_spd[010]': buff('标准化·β') },
        chars: {
          char_cn: { buffChar: [slot(['manu_prod_spd[000]', 'PHASE_0', 1], ['manu_prod_spd[010]', 'PHASE_2', 1])] },
          char_both: { buffChar: [slot(['manu_prod_spd[000]', 'PHASE_0', 1])] },
        },
      },
      local: {
        exBuilding: {
          buffs: { 'manu_prod_spd[000]': buff('Standardization α') },
          chars: {
            // The region has not given it its second skill yet; the empty slot and the unknown skill are left out
            char_both: {
              buffChar: [{ buffData: [] }, slot(['manu_prod_spd[000]', 'PHASE_0', 1], ['manu_gone', 'PHASE_2', 1])],
            },
          },
        },
      },
    },
    getItemValue: () => undefined,
  } as unknown as ArknightsSnapshot
  s.data = { baseBuffs: generateBaseBuffs(s) } as unknown as ArknightsSnapshot['data']
  return s
}

describe('base skills', () => {
  const s = baseSkillSnapshot()
  const slots = (key: string) =>
    new Character(key, {} as any, null, s).baseSkills.map((x) =>
      x.map((y) => [y.buff.id, y.slot, y.index, y.elite, y.level]),
    )

  it("take the region's slots when it has the character, and zh_CN's otherwise", () => {
    expect(slots('char_both')).toEqual([[['manu_prod_spd[000]', 0, 0, 0, 1]]])
    expect(slots('char_cn')).toEqual([
      [
        ['manu_prod_spd[000]', 0, 0, 0, 1],
        ['manu_prod_spd[010]', 0, 1, 2, 1],
      ],
    ])
    expect(slots('char_nobody')).toEqual([])
  })

  it("are named in the region's language where it has the skill", () => {
    expect(s.data.baseBuffs['manu_prod_spd[000]'].name).toBe('Standardization α')
    expect(s.data.baseBuffs['manu_prod_spd[010]'].name).toBe('标准化·β')
  })

  it('are missing from data published before them', () => {
    const hasBaseSkills = (exBuilding: object) =>
      ArknightsAdapter.prototype.hasBaseSkills.call({ dataManager: { raw: { exBuilding } } } as any)
    expect(hasBaseSkills({})).toBe(false)
    expect(hasBaseSkills(s.raw.exBuilding)).toBe(true)
  })
})
