import { describe, expect, it } from 'vitest'
import type { Character } from '../../pkg/cpp-arknights'
import { moduleSlots, unlockedUniEquips } from './moduleSlots'

function char(...types: string[]): Pick<Character, 'uniEquips'> {
  return {
    uniEquips: [
      { equipId: 'uniequip_001', equip: { raw: { unlockEvolvePhase: 'PHASE_0', typeName2: null } } },
      ...types.map((t) => ({ equipId: t, equip: { raw: { unlockEvolvePhase: 'PHASE_2', typeName2: t } } })),
    ],
  } as unknown as Pick<Character, 'uniEquips'>
}

const ids = (c: Pick<Character, 'uniEquips'>) => moduleSlots(c).map((x) => x?.equipId)

describe('moduleSlots', () => {
  it('leaves the X and Y columns empty without modules', () => {
    expect(ids(char())).toEqual([undefined, undefined])
  })

  it('puts X and Y in their own columns', () => {
    expect(ids(char('X'))).toEqual(['X', undefined])
    expect(ids(char('Y', 'X'))).toEqual(['X', 'Y'])
  })

  it('puts any other branch into a third column', () => {
    expect(ids(char('X', 'Y', 'D'))).toEqual(['X', 'Y', 'D'])
    expect(ids(char('D'))).toEqual([undefined, undefined, 'D'])
  })

  it('borrows an empty X or Y column when the third is taken', () => {
    expect(ids(char('A', 'B'))).toEqual([undefined, 'A', 'B'])
    expect(ids(char('X', 'A', 'B'))).toEqual(['X', 'A', 'B'])
  })

  it('reads the type case-insensitively', () => {
    expect(ids(char('x', 'y'))).toEqual(['x', 'y'])
  })
})

describe('unlockedUniEquips', () => {
  it('leaves out the initial module', () => {
    expect(unlockedUniEquips(char('X', 'Y')).map((x) => x.equipId)).toEqual(['X', 'Y'])
  })
})
