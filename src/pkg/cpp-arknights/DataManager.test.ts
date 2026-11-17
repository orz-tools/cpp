import { describe, expect, it, vi } from 'vitest'
import { ArknightsSnapshot, Character, Skill, UniEquip } from './DataManager'

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
