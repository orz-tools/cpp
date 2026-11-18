import { describe, expect, it } from 'vitest'
import type { ArknightsCharacterStatus } from '../../pkg/cpp-arknights/types'
import { modCompare, skillCompare } from './peekCompare'

const status = (s: Partial<ArknightsCharacterStatus>): ArknightsCharacterStatus => ({
  elite: 2,
  level: 1,
  skillLevel: 7,
  skillMaster: {},
  modLevel: {},
  ...s,
})

describe('skillCompare', () => {
  it('compares against a goal that raises the skill level', () => {
    const current = status({ elite: 1, skillLevel: 4 })
    const goal = status({ elite: 2, skillLevel: 7 })
    expect(skillCompare(current, goal, 's2', true, 7)).toEqual({
      from: { skillLevel: 4, mastery: 0 },
      to: { skillLevel: 7, mastery: 0 },
      target: 'goal',
    })
  })

  it('compares against a goal that masters only this skill', () => {
    const current = status({ skillMaster: { s2: 1 } })
    const goal = status({ skillMaster: { s2: 2 } })
    expect(skillCompare(current, goal, 's2', true, 7)).toEqual({
      from: { skillLevel: 7, mastery: 1 },
      to: { skillLevel: 7, mastery: 2 },
      target: 'goal',
    })
  })

  it('compares against the top level when the goal masters another skill', () => {
    const current = status({ skillMaster: { s2: 1 } })
    const goal = status({ skillMaster: { s1: 3, s2: 1 } })
    expect(skillCompare(current, goal, 's2', true, 7)).toEqual({
      from: { skillLevel: 7, mastery: 1 },
      to: { skillLevel: 7, mastery: 3 },
      target: 'max',
    })
  })

  it('compares against the top level without a plan', () => {
    expect(skillCompare(status({ skillLevel: 1, elite: 0 }), undefined, 's1', true, 7)).toEqual({
      from: { skillLevel: 1, mastery: 0 },
      to: { skillLevel: 7, mastery: 3 },
      target: 'max',
    })
  })

  it('has a single column for a skill already at the top', () => {
    const current = status({ skillMaster: { s3: 3 } })
    expect(skillCompare(current, undefined, 's3', true, 7).to).toBeNull()
    expect(skillCompare(current, status({ skillMaster: { s3: 3 } }), 's3', true, 7).to).toBeNull()
  })

  it('stops at level 7 for an operator without masteries', () => {
    expect(skillCompare(status({ skillLevel: 5 }), undefined, 's1', false, 7).to).toEqual({ skillLevel: 7, mastery: 0 })
    expect(skillCompare(status({ skillLevel: 7 }), undefined, 's1', false, 7).to).toBeNull()
  })

  it('stops at level 4 for an operator that stays at elite 0', () => {
    expect(skillCompare(status({ elite: 0, skillLevel: 2 }), undefined, 's1', false, 4).to).toEqual({
      skillLevel: 4,
      mastery: 0,
    })
  })
})

describe('modCompare', () => {
  it('plans the levels a goal raises', () => {
    expect(modCompare(status({ modLevel: { m: 1 } }), status({ modLevel: { m: 3 } }), 'm')).toEqual({
      from: 1,
      to: 3,
      planned: true,
    })
  })

  it('plans nothing without a goal', () => {
    expect(modCompare(status({ modLevel: { m: 2 } }), undefined, 'm')).toEqual({ from: 2, to: 2, planned: false })
    expect(modCompare(status({}), undefined, 'm')).toEqual({ from: 0, to: 0, planned: false })
  })

  it('plans nothing when the goal keeps the level', () => {
    expect(modCompare(status({ modLevel: { m: 2 } }), status({ modLevel: { m: 2 } }), 'm')).toEqual({
      from: 2,
      to: 2,
      planned: false,
    })
  })
})
