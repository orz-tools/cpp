import { describe, expect, it, vi } from 'vitest'
import { ArknightsSnapshot, Character, Skill } from './DataManager'

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
