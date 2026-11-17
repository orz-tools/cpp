import type { Character, CharacterLevel } from './DataManager'
import type { ArknightsCharacterStatus } from './types'

type Status = ArknightsCharacterStatus

/** What the editor reads of a character; tests pass plain objects. */
export type EditedCharacter = Pick<Character, 'maxLevels' | 'modUnlockLevel' | 'rarity'> & {
  skills: readonly { skillId: string }[]
  uniEquips: readonly { equipId: string; equip: { raw: { unlockEvolvePhase: string } } }[]
}

export function maxEliteOf(character: EditedCharacter) {
  return character.maxLevels.length - 1
}

/** Skills reach 7 from E1; an operator that stays at E0 stops at 4, which rewriteCharacter enforces. */
export function maxSkillLevel(character: EditedCharacter) {
  return maxEliteOf(character) >= 1 ? 7 : 4
}

export function hasMasteries(character: EditedCharacter) {
  return character.rarity >= 3 && character.skills.length > 0
}

/** Modules that are not there from the start: the initial one unlocks at E0 and has no levels. */
export function editableUniEquips<T extends EditedCharacter['uniEquips'][number]>(character: {
  uniEquips: readonly T[]
}) {
  return character.uniEquips.filter((x) => x.equip.raw.unlockEvolvePhase > 'PHASE_0')
}

export function compareLevel(a: CharacterLevel, b: CharacterLevel) {
  return a.elite - b.elite || a.level - b.level
}

export function setOwned(draft: Status, owned: boolean) {
  draft.elite = 0
  draft.level = owned ? 1 : 0
}

export function setEliteLevel(draft: Status, { elite, level }: CharacterLevel) {
  draft.elite = elite
  draft.level = level
}

export function setSkillLevel(draft: Status, level: number) {
  if (level >= 5 && draft.elite < 1) {
    draft.elite = 1
    draft.level = 1
  }
  draft.skillLevel = level
}

export function setMastery(draft: Status, skillId: string, mastery: number) {
  if (mastery > 0) {
    if (draft.elite < 2) {
      draft.elite = 2
      draft.level = 1
    }
    if (draft.skillLevel < 7) draft.skillLevel = 7
  }
  draft.skillMaster[skillId] = mastery
}

export function setMod(draft: Status, character: Pick<Character, 'modUnlockLevel'>, modId: string, level: number) {
  if (level > 0) {
    if (draft.elite < 2) {
      draft.elite = 2
      draft.level = 1
    }
    if (draft.level < character.modUnlockLevel) draft.level = character.modUnlockLevel
  }
  draft.modLevel[modId] = level
}

export function setPotential(draft: Status, potentialRank: number) {
  draft.potentialRank = potentialRank
}

export type Cell =
  | { kind: 'skillLevel'; level: number }
  | { kind: 'mastery'; skillId: string; mastery: number }
  | { kind: 'mod'; modId: string; level: number }

export function applyCell(draft: Status, character: Pick<Character, 'modUnlockLevel'>, cell: Cell) {
  switch (cell.kind) {
    case 'skillLevel':
      return setSkillLevel(draft, cell.level)
    case 'mastery':
      return setMastery(draft, cell.skillId, cell.mastery)
    case 'mod':
      return setMod(draft, character, cell.modId, cell.level)
  }
}

/** What clicking a cell raises besides itself; null when it raises nothing. */
export interface Prerequisite {
  eliteLevel: CharacterLevel | null
  skillLevel: number | null
}

export function raisesPrerequisite(
  status: Status,
  character: Pick<Character, 'modUnlockLevel'>,
  cell: Cell,
): Prerequisite | null {
  const after: Status = { ...status, skillMaster: { ...status.skillMaster }, modLevel: { ...status.modLevel } }
  applyCell(after, character, cell)
  const eliteLevel = compareLevel(after, status) !== 0 ? { elite: after.elite, level: after.level } : null
  const skillLevel = cell.kind !== 'skillLevel' && after.skillLevel !== status.skillLevel ? after.skillLevel : null
  return eliteLevel || skillLevel ? { eliteLevel, skillLevel } : null
}

/**
 * have: at or below the current value in a goal, gray. on: reached (current status) or planned (goal), blue.
 * off: not chosen, white. A goal cannot go below the current value, so cells under it are disabled.
 */
export type CellState = 'have' | 'on' | 'off'

export function cellState(value: number, status: number, current?: number): { state: CellState; disabled: boolean } {
  if (current === undefined) return { state: value <= status ? 'on' : 'off', disabled: false }
  if (value <= current) return { state: 'have', disabled: value < current }
  return { state: value <= status ? 'on' : 'off', disabled: false }
}

export type SectionId = 'elite' | 'skill' | 'mod'

/** In a goal, a section whose current value is already at the top collapses to one line. */
export function sectionCollapsed(section: SectionId, character: EditedCharacter, current: Status) {
  switch (section) {
    case 'elite': {
      const maxElite = maxEliteOf(character)
      return current.elite === maxElite && current.level >= character.maxLevels[maxElite]
    }
    case 'skill':
      return (
        current.skillLevel >= maxSkillLevel(character) &&
        (!hasMasteries(character) || character.skills.every((s) => (current.skillMaster[s.skillId] || 0) >= 3))
      )
    case 'mod': {
      const mods = editableUniEquips(character)
      return mods.length > 0 && mods.every((m) => (current.modLevel[m.equipId] || 0) >= 3)
    }
  }
}

export type SkillChange =
  | { kind: 'skillLevel'; from: number; to: number }
  | { kind: 'mastery'; skillId: string; from: number; to: number }

/** What a goal plans in the 技能 section, for its summary: one change is spelled out, more are counted. */
export function skillChanges(character: EditedCharacter, current: Status, goal: Status): SkillChange[] {
  const changes: SkillChange[] = []
  if (goal.skillLevel > current.skillLevel) {
    changes.push({ kind: 'skillLevel', from: current.skillLevel, to: goal.skillLevel })
  }
  if (hasMasteries(character)) {
    for (const { skillId } of character.skills) {
      const from = current.skillMaster[skillId] || 0
      const to = goal.skillMaster[skillId] || 0
      if (to > from) changes.push({ kind: 'mastery', skillId, from, to })
    }
  }
  return changes
}

export function modChanges(character: EditedCharacter, current: Status, goal: Status) {
  const changes: { modId: string; from: number; to: number }[] = []
  for (const { equipId } of editableUniEquips(character)) {
    const from = current.modLevel[equipId] || 0
    const to = goal.modLevel[equipId] || 0
    if (to > from) changes.push({ modId: equipId, from, to })
  }
  return changes
}

const maxOf = (character: EditedCharacter, elite: number) => character.maxLevels[elite]

/** Never below floor nor above the top level. */
function clampLevel(character: EditedCharacter, at: CharacterLevel, floor: CharacterLevel): CharacterLevel {
  const maxElite = maxEliteOf(character)
  const top = { elite: maxElite, level: maxOf(character, maxElite) }
  if (compareLevel(at, floor) < 0) return { ...floor }
  if (compareLevel(at, top) > 0) return top
  return at
}

/**
 * ±1 steps one level, crossing into the next elite phase past a phase's top level (精一满级 + 1 = 精二 1) and back.
 * ±10 snaps to the next multiple of 10 inside the phase, and crosses only from the phase's first or top level.
 */
export function stepLevel(
  character: EditedCharacter,
  { elite, level }: CharacterLevel,
  delta: 1 | -1 | 10 | -10,
  floor: CharacterLevel,
): CharacterLevel {
  const max = maxOf(character, elite)
  let next: CharacterLevel
  if (delta > 0 && level >= max) {
    next = elite < maxEliteOf(character) ? { elite: elite + 1, level: 1 } : { elite, level: max }
  } else if (delta < 0 && level <= 1) {
    next = elite > 0 ? { elite: elite - 1, level: maxOf(character, elite - 1) } : { elite, level: 1 }
  } else if (delta === 1 || delta === -1) {
    next = { elite, level: level + delta }
  } else if (delta > 0) {
    next = { elite, level: Math.min(max, Math.floor((level + 10) / 10) * 10) }
  } else {
    next = { elite, level: Math.max(1, Math.ceil((level - 10) / 10) * 10) }
  }
  return clampLevel(character, next, floor)
}

/** Gap between two phases of the level rail, px */
export const RAIL_GAP = 3

/** Each phase gets a length in proportion to its top level, so a level sits at level / top of its phase. */
export function railLayout(character: EditedCharacter, width: number) {
  const maxLevels = character.maxLevels
  const total = maxLevels.reduce((a, b) => a + b, 0)
  const usable = width - RAIL_GAP * (maxLevels.length - 1)
  let start = 0
  return maxLevels.map((max, elite) => {
    const w = (usable * max) / total
    const seg = { elite, max, start, width: w }
    start += w + RAIL_GAP
    return seg
  })
}

export function levelToRail(character: EditedCharacter, { elite, level }: CharacterLevel, width: number) {
  const seg = railLayout(character, width)[elite]
  return seg.start + (seg.width * Math.min(Math.max(level, 0), seg.max)) / seg.max
}

/** The snap points of a phase: its first level, every multiple of 10, and its top level. */
export function snapLevels(max: number) {
  const levels = [1]
  for (let l = 10; l < max; l += 10) levels.push(l)
  if (max > 1) levels.push(max)
  return levels
}

/** The level a point on the rail picks, snapped to the nearest snap point of the phase under it. */
export function railToLevel(character: EditedCharacter, x: number, width: number): CharacterLevel {
  const segs = railLayout(character, width)
  let seg = segs[0]
  for (const s of segs) {
    // In a gap, the nearer phase wins.
    if (x >= s.start - RAIL_GAP / 2) seg = s
  }
  const raw = ((x - seg.start) / seg.width) * seg.max
  let best = 1
  for (const l of snapLevels(seg.max)) {
    if (Math.abs(l - raw) < Math.abs(best - raw)) best = l
  }
  return { elite: seg.elite, level: best }
}

export interface Elite2LevelBucket {
  from: number
  to: number
  share: number
  /** The bucket holds exactly the top level, so its share is the share at max level. */
  isMax: boolean
}

/**
 * Heybox reports E2 levels as 1–69, 70–89 and 90. Cut to the operator's top level: a 4★ (70) keeps 1–69 and 70, a 5★
 * (80) keeps 1–69 and 70–80, where its top level cannot be told from 70–79.
 */
export function elite2LevelBuckets(
  character: Pick<Character, 'maxLevels'>,
  shares: readonly (number | null | undefined)[] | null | undefined,
): Elite2LevelBucket[] {
  const max = character.maxLevels[2]
  if (max == null || !shares) return []
  const ranges = [
    [1, 69],
    [70, 89],
    [90, 90],
  ]
  const buckets: Elite2LevelBucket[] = []
  ranges.forEach(([from, to], i) => {
    const share = shares[i]
    if (from > max || share == null || !Number.isFinite(share)) return
    const end = Math.min(to, max)
    buckets.push({ from, to: end, share, isMax: from === max && end === max })
  })
  return buckets
}
