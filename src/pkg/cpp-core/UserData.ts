import produce, { Draft } from 'immer'
import { atom, PrimitiveAtom, Setter } from 'jotai'
import { atomFamily } from 'jotai/utils'
import deepEqual from 'deep-equal'
import { Constructor, Inject } from '../container'
import { txatom } from '../txatom'
import { Character, DataManager } from './DataManager'

const UserDataAtoms = class UserDataAtoms {} as Constructor<ReturnType<typeof buildAtoms>> &
  ReturnType<typeof buildAtoms>

export class UserDataAtomHolder extends UserDataAtoms {
  dataManager = Inject(DataManager)
  rootAtom!: PrimitiveAtom<UserData>

  public setAtom(atom: PrimitiveAtom<UserData>) {
    this.rootAtom = atom
    Object.assign(this, buildAtoms(this.rootAtom, this.dataManager))
  }
}

export const emptyCharacterStatus = Object.freeze<CharacterStatus>({
  elite: 0,
  level: 0,
  skillLevel: 1,
  skillMaster: Object.freeze({}),
  modLevel: Object.freeze({}),
})

function buildAtoms(rootAtom: PrimitiveAtom<UserData>, dm: DataManager) {
  const tx = txatom(rootAtom)
  const { dataAtom } = tx

  const doRewrite = (charId: string, data: Draft<UserData>) => {
    const [c, g] = rewriteCharacters(dm, charId, data.current[charId], data.goal[charId])
    if (c) {
      data.current[charId]
    } else {
      delete data.current[charId]
    }
    if (g) {
      data.goal[charId] = g
    } else {
      delete data.goal[charId]
    }
  }

  const currentCharacter = atomFamily(
    (charId: string) =>
      atom(
        (get) => get(dataAtom).current[charId] || emptyCharacterStatus,
        (get, set, value: (draft: Draft<CharacterStatus>) => any) => {
          set(dataAtom, 'transact', () => {
            set(dataAtom, 'modify', (data) => {
              data.current[charId] =
                produce(data.current[charId] || emptyCharacterStatus, value) || emptyCharacterStatus
            })
            set(dataAtom, 'modify', (data) => {
              data.goal[charId] = produce(data.goal[charId] || data.current[charId], () => {}) || data.current[charId]
            })
            set(dataAtom, 'modify', (data) => {
              doRewrite(charId, data)
            })
          })
        },
      ),
    (a, b) => a === b,
  )

  const goalCharacter = atomFamily(
    (charId: string) =>
      atom(
        (get) => get(dataAtom).goal[charId] || get(currentCharacter(charId)),
        (get, set, value: (draft: Draft<CharacterStatus>) => any) => {
          set(dataAtom, 'transact', () => {
            set(dataAtom, 'modify', (data) => {
              data.current[charId] =
                produce(data.current[charId] || emptyCharacterStatus, () => {}) || emptyCharacterStatus
            })
            set(dataAtom, 'modify', (data) => {
              data.goal[charId] = produce(data.goal[charId] || data.current[charId], value) || data.current[charId]
            })
            set(dataAtom, 'modify', (data) => {
              doRewrite(charId, data)
            })
          })
        },
      ),
    (a, b) => a === b,
  )

  return {
    ...tx,
    currentCharacter,
    goalCharacter,
  }
}

function rewriteCharacter(char: Character, status: Draft<CharacterStatus>) {
  if (status.elite < 0 || !isFinite(status.elite)) status.elite = 0
  if (status.level < 0 || !isFinite(status.level)) status.level = 0

  if (status.elite === 0 && status.level === 0) {
    status.elite = 0
    status.level = 0
    status.skillLevel = 1
    status.skillMaster = {}
    status.modLevel = {}
    return
  }

  if (status.elite > char.maxElite) {
    status.elite = char.maxElite
    status.level = char.maxLevels[status.elite]
  }

  if (status.level < 1 || !isFinite(status.level)) status.level = 1
  if (status.level > char.maxLevels[status.elite]) {
    status.level = char.maxLevels[status.elite]
  }

  status.skillLevel = parseInt(String(status.skillLevel))
  if (!isFinite(status.skillLevel)) status.skillLevel = 1
  if (status.skillLevel < 1) status.skillLevel = 1
  if (char.skills.length == 0) {
    status.skillLevel = 1
  } else {
    if (status.elite < 1) {
      if (status.skillLevel > 4) status.skillLevel = 4
    } else {
      if (status.skillLevel > 7) status.skillLevel = 7
    }
  }

  if (char.rarity < 3 || status.elite < 2) {
    status.modLevel = {}
  } else {
    for (const mod of char.uniEquips) {
      const key = mod.key
      if (!(key in status.modLevel)) continue
      status.modLevel[key] = parseInt(String(status.modLevel[key]))
      if (status.modLevel[key] < 0 || !isFinite(status.modLevel[key])) {
        delete status.modLevel[key]
        continue
      }
      if (status.modLevel[key] > 3) status.modLevel[key] = 3
    }
  }

  if (char.rarity < 3 || status.skillLevel < 7) {
    status.skillMaster = {}
  } else {
    for (const [, skill] of char.skills) {
      const key = skill.key
      if (!(key in status.skillMaster)) continue
      status.skillMaster[key] = parseInt(String(status.skillMaster[key]))
      if (status.skillMaster[key] < 0 || !isFinite(status.skillMaster[key])) {
        delete status.skillMaster[key]
        continue
      }
      if (status.skillMaster[key] > 3) status.skillMaster[key] = 3
    }
  }
}

function rewriteGoal(char: Character, current: Draft<CharacterStatus>, goal: Draft<CharacterStatus>) {
  if (goal.elite < current.elite) {
    goal.elite = current.elite
    goal.level = current.level
  }

  if (goal.elite === current.elite && goal.level < current.level) {
    goal.level = current.level
  }

  if (goal.skillLevel < current.skillLevel) {
    goal.skillLevel = current.skillLevel
  }

  for (const mod of char.uniEquips) {
    const key = mod.key
    if ((goal.modLevel[key] || 0) < (current.modLevel[key] || 0)) {
      goal.modLevel[key] = current.modLevel[key]
    }
  }

  for (const [, skill] of char.skills) {
    const key = skill.key
    if ((goal.skillMaster[key] || 0) < (current.skillMaster[key] || 0)) {
      goal.skillMaster[key] = current.skillMaster[key]
    }
  }
}

function rewriteCharacters(
  dm: DataManager,
  charId: string,
  current: Draft<CharacterStatus> | undefined,
  goal: Draft<CharacterStatus> | undefined,
) {
  if (!current || !goal) return [current, goal] as const

  const char = dm.data.characters[charId]
  if (!char) return [undefined, undefined] as const

  rewriteCharacter(char, current)
  rewriteCharacter(char, goal)
  rewriteGoal(char, current, goal)
  if (deepEqual(current, goal, { strict: true })) {
    goal = undefined
  }
  if (current.elite === 0 && current.level === 0) current = undefined

  return [current, goal] as const
}

export interface UserData {
  current: Record<string, CharacterStatus>
  goal: Record<string, CharacterStatus>
}

export interface CharacterStatus {
  elite: number
  level: number
  skillLevel: number
  skillMaster: Record<string, number>
  modLevel: Record<string, number>
}

export interface CharacterLevel {
  elite: number
  level: number
}

export function newUserData(): UserData {
  return {
    current: {},
    goal: {},
  }
}
