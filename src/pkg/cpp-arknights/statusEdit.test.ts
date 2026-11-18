import { produce } from 'immer'
import { describe, expect, it } from 'vitest'
import {
  EditedCharacter,
  cellState,
  elite2LevelBuckets,
  levelToRail,
  maxSkillLevel,
  modChanges,
  raisesPrerequisite,
  railLayout,
  railToLevel,
  sectionCollapsed,
  setEliteLevel,
  setMastery,
  setMod,
  setOwned,
  setSkillLevel,
  skillChanges,
  skillLevelSteps,
  snapLevels,
  stepLevel,
} from './statusEdit'
import type { ArknightsCharacterStatus } from './types'

const equip = (equipId: string, unlockEvolvePhase = 'PHASE_2') => ({ equipId, equip: { raw: { unlockEvolvePhase } } })

// 夏栎: 5★, top levels 50 / 70 / 80, modules from E2 50
const quercus: EditedCharacter = {
  rarity: 4,
  maxLevels: [50, 70, 80],
  modUnlockLevel: 50,
  skills: [{ skillId: 's1' }, { skillId: 's2' }],
  uniEquips: [equip('m0', 'PHASE_0'), equip('mx')],
}

// A 6★: top levels 50 / 80 / 90, modules from E2 60
const six: EditedCharacter = {
  rarity: 5,
  maxLevels: [50, 80, 90],
  modUnlockLevel: 60,
  skills: [{ skillId: 's1' }, { skillId: 's2' }, { skillId: 's3' }],
  uniEquips: [equip('mx'), equip('my')],
}

// A 3★ that stops at E1
const three: EditedCharacter = {
  rarity: 2,
  maxLevels: [40, 55],
  modUnlockLevel: -1,
  skills: [{ skillId: 's1' }],
  uniEquips: [],
}

const four = { maxLevels: [45, 60, 70] }

function status(patch: Partial<ArknightsCharacterStatus> = {}): ArknightsCharacterStatus {
  return { elite: 0, level: 1, skillLevel: 1, skillMaster: {}, modLevel: {}, potentialRank: 0, ...patch }
}

describe('cell setters', () => {
  it('owns at E0 1 and disowns at E0 0', () => {
    expect(produce(status({ elite: 2, level: 40 }), (d) => setOwned(d, true))).toMatchObject({ elite: 0, level: 1 })
    expect(produce(status(), (d) => setOwned(d, false))).toMatchObject({ elite: 0, level: 0 })
  })

  it('sets elite and level alone', () => {
    const s = status({ elite: 2, level: 40, skillLevel: 7, skillMaster: { s1: 3 } })
    expect(produce(s, (d) => setEliteLevel(d, { elite: 1, level: 30 }))).toEqual({ ...s, elite: 1, level: 30 })
  })

  it('raises E0 to E1 1 for skill levels 5–7', () => {
    expect(produce(status(), (d) => setSkillLevel(d, 4))).toMatchObject({ elite: 0, level: 1, skillLevel: 4 })
    expect(produce(status(), (d) => setSkillLevel(d, 5))).toMatchObject({ elite: 1, level: 1, skillLevel: 5 })
    expect(produce(status({ elite: 1, level: 30 }), (d) => setSkillLevel(d, 7))).toMatchObject({
      elite: 1,
      level: 30,
      skillLevel: 7,
    })
  })

  it('raises E2 and skill level 7 for a mastery', () => {
    expect(produce(status({ elite: 1, level: 40, skillLevel: 4 }), (d) => setMastery(d, 's2', 3))).toMatchObject({
      elite: 2,
      level: 1,
      skillLevel: 7,
      skillMaster: { s2: 3 },
    })
    expect(produce(status({ elite: 2, level: 40, skillLevel: 7 }), (d) => setMastery(d, 's2', 0))).toMatchObject({
      elite: 2,
      level: 40,
      skillMaster: { s2: 0 },
    })
  })

  it('raises E2 and the module unlock level for a module', () => {
    expect(produce(status({ elite: 2, level: 40 }), (d) => setMod(d, quercus, 'mx', 2))).toMatchObject({
      elite: 2,
      level: 50,
      modLevel: { mx: 2 },
    })
    expect(produce(status({ elite: 1, level: 70 }), (d) => setMod(d, six, 'mx', 1))).toMatchObject({
      elite: 2,
      level: 60,
    })
    expect(produce(status({ elite: 2, level: 70 }), (d) => setMod(d, quercus, 'mx', 3))).toMatchObject({
      elite: 2,
      level: 70,
    })
  })
})

describe('raisesPrerequisite', () => {
  it('names what a cell raises besides itself', () => {
    expect(
      raisesPrerequisite(status({ elite: 2, level: 40 }), quercus, { kind: 'mod', modId: 'mx', level: 1 }),
    ).toEqual({ eliteLevel: { elite: 2, level: 50 }, skillLevel: null })
    expect(
      raisesPrerequisite(status({ elite: 1, level: 40, skillLevel: 4 }), quercus, {
        kind: 'mastery',
        skillId: 's1',
        mastery: 1,
      }),
    ).toEqual({ eliteLevel: { elite: 2, level: 1 }, skillLevel: 7 })
    expect(
      raisesPrerequisite(status({ elite: 2, level: 1, skillLevel: 6 }), quercus, {
        kind: 'mastery',
        skillId: 's1',
        mastery: 1,
      }),
    ).toEqual({ eliteLevel: null, skillLevel: 7 })
    expect(raisesPrerequisite(status(), quercus, { kind: 'skillLevel', level: 6 })).toEqual({
      eliteLevel: { elite: 1, level: 1 },
      skillLevel: null,
    })
  })

  it('returns null when nothing else moves', () => {
    expect(raisesPrerequisite(status(), quercus, { kind: 'skillLevel', level: 4 })).toBeNull()
    expect(raisesPrerequisite(status({ elite: 2, level: 60 }), quercus, { kind: 'mod', modId: 'mx', level: 3 })).toBe(
      null,
    )
    expect(raisesPrerequisite(status(), quercus, { kind: 'mastery', skillId: 's1', mastery: 0 })).toBeNull()
  })

  it('leaves the status alone', () => {
    const s = status({ elite: 1, level: 40, skillLevel: 4 })
    raisesPrerequisite(s, quercus, { kind: 'mastery', skillId: 's1', mastery: 1 })
    expect(s).toEqual(status({ elite: 1, level: 40, skillLevel: 4 }))
  })
})

describe('cellState', () => {
  it('in the current status, reached cells are on', () => {
    expect(cellState(0, 1)).toEqual({ state: 'on', disabled: false })
    expect(cellState(1, 1)).toEqual({ state: 'on', disabled: false })
    expect(cellState(2, 1)).toEqual({ state: 'off', disabled: false })
  })

  it('in a goal, what the current status has is gray and cannot be gone below', () => {
    // current 1, goal 2
    expect(cellState(0, 2, 1)).toEqual({ state: 'have', disabled: true })
    expect(cellState(1, 2, 1)).toEqual({ state: 'have', disabled: false })
    expect(cellState(2, 2, 1)).toEqual({ state: 'on', disabled: false })
    expect(cellState(3, 2, 1)).toEqual({ state: 'off', disabled: false })
  })
})

describe('sections', () => {
  it('collapses what the current status has maxed', () => {
    expect(sectionCollapsed('elite', quercus, status({ elite: 2, level: 80 }))).toBe(true)
    expect(sectionCollapsed('elite', quercus, status({ elite: 2, level: 79 }))).toBe(false)
    expect(sectionCollapsed('elite', three, status({ elite: 1, level: 55 }))).toBe(true)

    const maxed = { elite: 2, level: 80, skillLevel: 7, skillMaster: { s1: 3, s2: 3 }, modLevel: { mx: 3 } }
    expect(sectionCollapsed('skill', quercus, status(maxed))).toBe(true)
    expect(sectionCollapsed('skill', quercus, status({ ...maxed, skillMaster: { s1: 3 } }))).toBe(false)
    expect(sectionCollapsed('skill', three, status({ elite: 1, level: 1, skillLevel: 7 }))).toBe(true)
    expect(sectionCollapsed('mod', quercus, status(maxed))).toBe(true)
    expect(sectionCollapsed('mod', quercus, status({ ...maxed, modLevel: {} }))).toBe(false)
  })

  it('lists the changes a goal plans', () => {
    const current = status({ elite: 2, level: 40, skillLevel: 7 })
    expect(skillChanges(quercus, current, status({ ...current, skillMaster: { s2: 3 } }))).toEqual([
      { kind: 'mastery', skillId: 's2', from: 0, to: 3 },
    ])
    expect(
      skillChanges(quercus, status({ skillLevel: 4 }), status({ elite: 2, skillLevel: 7, skillMaster: { s1: 1 } })),
    ).toEqual([
      { kind: 'skillLevel', from: 4, to: 7 },
      { kind: 'mastery', skillId: 's1', from: 0, to: 1 },
    ])
    expect(skillChanges(quercus, current, current)).toEqual([])
    expect(modChanges(quercus, current, status({ ...current, modLevel: { mx: 2, m0: 1 } }))).toEqual([
      { modId: 'mx', from: 0, to: 2 },
    ])
  })

  it('stops skill levels at 4 for an operator that stays at E0', () => {
    expect(maxSkillLevel(quercus)).toBe(7)
    expect(maxSkillLevel({ ...three, maxLevels: [30] })).toBe(4)
  })

  it("offers a special operator only its missions' skill levels", () => {
    const special = { ...six, specialOperator: { skillLevels: [{ level: 4 }, { level: 7 }] } }
    expect(skillLevelSteps(special)).toEqual([1, 4, 7])
    expect(skillLevelSteps({ ...special, maxLevels: [50] })).toEqual([1, 4])
    expect(skillLevelSteps(six)).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(skillLevelSteps({ ...three, maxLevels: [30] })).toEqual([1, 2, 3, 4])
  })
})

describe('stepLevel', () => {
  const floor = { elite: 0, level: 1 }

  it('crosses elite phases one level at a time', () => {
    expect(stepLevel(quercus, { elite: 2, level: 1 }, -1, floor)).toEqual({ elite: 1, level: 70 })
    expect(stepLevel(quercus, { elite: 1, level: 70 }, 1, floor)).toEqual({ elite: 2, level: 1 })
    expect(stepLevel(quercus, { elite: 0, level: 50 }, 1, floor)).toEqual({ elite: 1, level: 1 })
    expect(stepLevel(quercus, { elite: 1, level: 1 }, -1, floor)).toEqual({ elite: 0, level: 50 })
    expect(stepLevel(quercus, { elite: 2, level: 40 }, 1, floor)).toEqual({ elite: 2, level: 41 })
  })

  it('stops at the floor and at the top', () => {
    expect(stepLevel(quercus, { elite: 0, level: 1 }, -1, floor)).toEqual({ elite: 0, level: 1 })
    expect(stepLevel(quercus, { elite: 2, level: 80 }, 1, floor)).toEqual({ elite: 2, level: 80 })
    expect(stepLevel(quercus, { elite: 2, level: 40 }, -1, { elite: 2, level: 40 })).toEqual({ elite: 2, level: 40 })
    expect(stepLevel(quercus, { elite: 2, level: 1 }, -1, { elite: 2, level: 1 })).toEqual({ elite: 2, level: 1 })
    expect(stepLevel(three, { elite: 1, level: 55 }, 1, floor)).toEqual({ elite: 1, level: 55 })
  })

  it('snaps ±10 to multiples of 10', () => {
    expect(stepLevel(quercus, { elite: 2, level: 43 }, 10, floor)).toEqual({ elite: 2, level: 50 })
    expect(stepLevel(quercus, { elite: 2, level: 50 }, 10, floor)).toEqual({ elite: 2, level: 60 })
    expect(stepLevel(quercus, { elite: 2, level: 75 }, 10, floor)).toEqual({ elite: 2, level: 80 })
    expect(stepLevel(quercus, { elite: 2, level: 1 }, 10, floor)).toEqual({ elite: 2, level: 10 })
    expect(stepLevel(quercus, { elite: 2, level: 43 }, -10, floor)).toEqual({ elite: 2, level: 40 })
    expect(stepLevel(quercus, { elite: 2, level: 50 }, -10, floor)).toEqual({ elite: 2, level: 40 })
    expect(stepLevel(quercus, { elite: 2, level: 8 }, -10, floor)).toEqual({ elite: 2, level: 1 })
    expect(stepLevel(quercus, { elite: 1, level: 70 }, 10, floor)).toEqual({ elite: 2, level: 1 })
    expect(stepLevel(quercus, { elite: 2, level: 1 }, -10, floor)).toEqual({ elite: 1, level: 70 })
    expect(stepLevel(quercus, { elite: 2, level: 43 }, -10, { elite: 2, level: 41 })).toEqual({ elite: 2, level: 41 })
  })
})

describe('level rail', () => {
  it('lays phases out in proportion to their top levels', () => {
    expect(railLayout(quercus, 236).map((s) => [s.start, s.width])).toEqual([
      [0, 57.5],
      [60.5, 80.5],
      [144, 92],
    ])
    expect(levelToRail(quercus, { elite: 2, level: 40 }, 236)).toBe(190)
    expect(levelToRail(quercus, { elite: 2, level: 70 }, 236)).toBe(224.5)
  })

  it('snaps to the first level, multiples of 10 and the top level', () => {
    expect(snapLevels(80)).toEqual([1, 10, 20, 30, 40, 50, 60, 70, 80])
    expect(snapLevels(55)).toEqual([1, 10, 20, 30, 40, 50, 55])
    expect(railToLevel(quercus, 190, 236)).toEqual({ elite: 2, level: 40 })
    expect(railToLevel(quercus, 192, 236)).toEqual({ elite: 2, level: 40 })
    expect(railToLevel(quercus, 196, 236)).toEqual({ elite: 2, level: 50 })
    expect(railToLevel(quercus, 144.2, 236)).toEqual({ elite: 2, level: 1 })
    expect(railToLevel(quercus, 236, 236)).toEqual({ elite: 2, level: 80 })
    expect(railToLevel(quercus, 300, 236)).toEqual({ elite: 2, level: 80 })
    expect(railToLevel(quercus, -5, 236)).toEqual({ elite: 0, level: 1 })
  })

  it('gives a point in a gap to the nearer phase', () => {
    expect(railToLevel(quercus, 141, 236)).toEqual({ elite: 1, level: 70 })
    expect(railToLevel(quercus, 143.5, 236)).toEqual({ elite: 2, level: 1 })
  })

  it('works with one or two phases', () => {
    expect(railLayout(three, 236).map((s) => s.elite)).toEqual([0, 1])
    expect(railToLevel(three, 236, 236)).toEqual({ elite: 1, level: 55 })
    const one = { ...three, maxLevels: [30] }
    expect(railLayout(one, 236)).toEqual([{ elite: 0, max: 30, start: 0, width: 236 }])
    expect(railToLevel(one, 118, 236)).toEqual({ elite: 0, level: 10 })
    expect(railToLevel(one, 236, 236)).toEqual({ elite: 0, level: 30 })
  })
})

describe('elite2LevelBuckets', () => {
  const shares = [0.6, 0.3, 0.1]

  it('keeps three buckets for a 6★, the 90 one at max level', () => {
    expect(elite2LevelBuckets(six, shares)).toEqual([
      { from: 1, to: 69, share: 0.6, isMax: false },
      { from: 70, to: 89, share: 0.3, isMax: false },
      { from: 90, to: 90, share: 0.1, isMax: true },
    ])
  })

  it('cuts a 5★ at 80, where max level cannot be told apart', () => {
    expect(elite2LevelBuckets(quercus, [0.752, 0.248, 0])).toEqual([
      { from: 1, to: 69, share: 0.752, isMax: false },
      { from: 70, to: 80, share: 0.248, isMax: false },
    ])
  })

  it('cuts a 4★ at 70, which is exactly its max level', () => {
    expect(elite2LevelBuckets(four, shares)).toEqual([
      { from: 1, to: 69, share: 0.6, isMax: false },
      { from: 70, to: 70, share: 0.3, isMax: true },
    ])
  })

  it('is empty without data or without E2', () => {
    expect(elite2LevelBuckets(six, null)).toEqual([])
    expect(elite2LevelBuckets(six, undefined)).toEqual([])
    expect(elite2LevelBuckets(three, shares)).toEqual([])
  })
})
