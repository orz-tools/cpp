import deepEqual from 'deep-equal'
import produce, { Draft } from 'immer'
import { Atom, atom, PrimitiveAtom, WritableAtom } from 'jotai'
import { atomFamily } from 'jotai/utils'
import { AtomFamily } from 'jotai/vanilla/utils/atomFamily'
import { sum, T } from 'ramda'
import { SetStateAction } from 'react'
import { Constructor, Inject } from '../container'
import { txatom } from '../txatom'
import { Character, DataManager, ITEM_GOLD, ITEM_VIRTUAL_EXP } from './DataManager'

function withDebugLabel<T extends Atom<any>>(t: T, label?: string): T {
  t.debugLabel = label
  return t
}

const UserDataAtoms = class UserDataAtoms {} as Constructor<ReturnType<typeof buildAtoms>> &
  ReturnType<typeof buildAtoms>

export class UserDataAtomHolder extends UserDataAtoms {
  dataManager = Inject(DataManager)
  baseAtom!: PrimitiveAtom<UserData | undefined>

  public setAtom(atom: PrimitiveAtom<UserData | undefined>) {
    this.baseAtom = atom
    Object.assign(this, buildAtoms(this.baseAtom, this.dataManager))
  }
}

export const emptyCharacterStatus = Object.freeze<CharacterStatus>({
  elite: 0,
  level: 0,
  skillLevel: 1,
  skillMaster: Object.freeze({}),
  modLevel: Object.freeze({}),
})

function buildAtoms(baseAtom: PrimitiveAtom<UserData | undefined>, dm: DataManager) {
  const rootAtom: PrimitiveAtom<UserData> = withDebugLabel(
    atom(
      (get) => {
        let value = get(baseAtom)
        if (!value) {
          value = newUserData()
        }
        if (!value.items) value.items = {}
        return value
      },
      (get, set, value) =>
        set(baseAtom, (v) => {
          if (typeof value === 'function') return value(get(rootAtom))
          return value
        }),
    ),
    'rootAtom',
  )

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

  const itemQuantities = withDebugLabel(
    atom((get) => get(dataAtom).items),
    'itemQuantities',
  )

  const itemQuantity: AtomFamily<string, WritableAtom<number, [value: SetStateAction<number>], void>> = atomFamily<
    string,
    WritableAtom<number, [value: SetStateAction<number>], void>
  >(
    (itemId: string) => {
      if (itemId == ITEM_VIRTUAL_EXP) {
        return withDebugLabel(
          atom(
            (get) => {
              return sum(
                Object.values(dm.raw.exItems.expItems).map((x) => (get(itemQuantity(x.id)) as number) * x.gainExp),
              )
            },
            (get, set, value: SetStateAction<number>) => {},
          ),
          `itemQuantity(${itemId})`,
        )
      }
      return withDebugLabel(
        atom(
          (get) => get(dataAtom).items[itemId] || 0,
          (get, set, value: SetStateAction<number>) => {
            set(dataAtom, 'modify', (data) => {
              data.items[itemId] = typeof value === 'function' ? value(data.items[itemId] || 0) : value
            })
          },
        ),
        `itemQuantity(${itemId})`,
      )
    },
    (a, b) => a === b,
  )

  const currentCharacter = atomFamily(
    (charId: string) =>
      withDebugLabel(
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
        `currentCharacter(${charId})`,
      ),
    (a, b) => a === b,
  )

  const goalCharacter = atomFamily(
    (charId: string) =>
      withDebugLabel(
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
        `goalCharacter(${charId})`,
      ),
    (a, b) => a === b,
  )

  const characterFinishedStatus = atomFamily(
    (charId: string) =>
      withDebugLabel(
        atom((get) => {
          return finishedCharacterStatus(dm.data.characters[charId])
        }),
        `characterFinishedStatus(${charId})`,
      ),
    (a, b) => a === b,
  )

  const isCharacterFinished = atomFamily(
    (charId: string) =>
      withDebugLabel(
        atom((get) => {
          // if (charId == 'char_278_orchid') {
          //   console.log(
          //     get(currentCharacter(charId)),
          //     get(characterFinishedStatus(charId)),
          //     deepEqual(get(currentCharacter(charId)), get(characterFinishedStatus(charId))),
          //   )
          // }
          return deepEqual(get(currentCharacter(charId)), get(characterFinishedStatus(charId)))
        }),
        `isCharacterFinished(${charId})`,
      ),
    (a, b) => a === b,
  )

  const currentCharacters = withDebugLabel(
    atom((get) => get(dataAtom).current),
    `currentCharacters`,
  )
  const goalCharacters = withDebugLabel(
    atom((get) => get(dataAtom).goal),
    `goalCharacters`,
  )
  const finishedCharacters = withDebugLabel(
    atom((get) => {
      return Object.fromEntries(get(allCharacterIds).map((k) => [k, get(characterFinishedStatus(k))]))
    }),
    `finishedCharacters`,
  )

  const goalTasks = atomFamily(
    (charId: string) =>
      withDebugLabel(
        atom((get) => {
          // console.log('regen goalTasks', charId)
          const current = get(currentCharacter(charId))
          const goal = get(goalCharacter(charId))
          return generateTasks(dm, dm.data.characters[charId], current, goal)
        }),
        `goalTasks(${charId})`,
      ),
    (a, b) => a === b,
  )

  const finishedTasks = atomFamily(
    (charId: string) =>
      withDebugLabel(
        atom((get) => {
          // console.log('regen finishedTasks', charId)
          const current = get(currentCharacter(charId))
          const finished = get(characterFinishedStatus(charId))
          return generateTasks(dm, dm.data.characters[charId], current, finished)
        }),
        `finishedTasks(${charId})`,
      ),
    (a, b) => a === b,
  )

  const allCharacterIds = withDebugLabel(
    atom((get) => {
      return Object.entries(dm.data.characters)
        .filter(([, v]) => !!v.raw.displayNumber)
        .map(([k]) => k)
    }),
    `allCharacterIds`,
  )

  const allGoalTasks = withDebugLabel(
    atom((get) => {
      return Object.keys(get(goalCharacters)).flatMap((x) => get(goalTasks(x)))
    }),
    `allGoalTasks`,
  )

  const allFinishedTasks = withDebugLabel(
    atom((get) => {
      return get(allCharacterIds).flatMap((x) => get(finishedTasks(x)))
    }),
    `allFinishedTasks`,
  )

  const allGoalTaskRequirements = withDebugLabel(
    atom((get) => {
      const result: Record<string, number> = {}
      get(allGoalTasks).forEach((x) =>
        x.requires?.forEach((y) => (result[y.itemId] = (result[y.itemId] || 0) + y.quantity)),
      )
      return result
    }),
    'allGoalTaskRequirements',
  )

  const allFinishedTaskRequirements = withDebugLabel(
    atom((get) => {
      const result: Record<string, number> = {}
      get(allFinishedTasks).forEach((x) =>
        x.requires?.forEach((y) => (result[y.itemId] = (result[y.itemId] || 0) + y.quantity)),
      )
      return result
    }),
    'allFinishedTaskRequirements',
  )

  return {
    ...tx,
    rootAtom,
    itemQuantities,
    itemQuantity,
    currentCharacter,
    goalCharacter,
    characterFinishedStatus,
    isCharacterFinished,
    currentCharacters,
    goalCharacters,
    finishedCharacters,
    goalTasks,
    finishedTasks,
    allCharacterIds,
    allGoalTasks,
    allFinishedTasks,
    allGoalTaskRequirements,
    allFinishedTaskRequirements,
  }
}

function finishedCharacterStatus(char: Character) {
  return {
    elite: char.maxElite,
    level: char.maxLevels[char.maxElite],
    skillLevel: char.skills.length > 0 ? 7 : 1,
    skillMaster: char.maxElite >= 2 ? Object.fromEntries(char.skills.map(([, skill]) => [skill.key, 3])) : {},
    modLevel:
      char.maxElite >= 2
        ? Object.fromEntries(char.uniEquips.filter((x) => x.raw.unlockEvolvePhase > 0).map((mod) => [mod.key, 3]))
        : {},
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

  if (char.rarity < 3 || status.elite < 2 || status.level < char.modUnlockLevel) {
    status.modLevel = {}
  } else {
    for (const mod of char.uniEquips) {
      const key = mod.key
      if (!(key in status.modLevel)) continue
      status.modLevel[key] = parseInt(String(status.modLevel[key]))
      if (status.modLevel[key] <= 0 || !isFinite(status.modLevel[key])) {
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
      if (status.skillMaster[key] <= 0 || !isFinite(status.skillMaster[key])) {
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
  items: Record<string, number>
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
    items: {},
  }
}

export interface Task {
  id: string
  charId: string
  type: TaskType
  requires: { itemId: string; quantity: number }[]
  depends: Task[]
}

export type TaskType =
  | { _: 'join' }
  | { _: 'elite'; elite: number }
  | { _: 'level'; elite: number; from: number; to: number }
  | { _: 'skill'; to: number }
  | { _: 'skillMaster'; skillId: string; to: number }
  | { _: 'mod'; modId: string; to: number }

const isTask = (i: Task | undefined): i is Task => !!i

function generateTasks(
  dataManager: DataManager,
  character: Character,
  current: CharacterStatus,
  goal: CharacterStatus,
) {
  if (current == goal) return []

  const tasks: Task[] = []
  const add = (type: TaskType, requires: Task['requires'], ...depends: (Task | undefined)[]): Task => {
    const task: Task = {
      id: character.key + JSON.stringify(type),
      charId: character.key,
      type,
      requires,
      depends: depends.filter(isTask),
    }
    tasks.push(task)
    return task
  }

  let elite = current.elite
  let level = current.level
  let dep: Task | undefined = undefined

  const meetEliteLevel = (goalElite: number, goalLevel: number) => {
    if (elite > goalElite || (elite === goalElite && level >= goalLevel)) return

    while (elite < goalElite) {
      const goalLevel = character.maxLevels[elite]
      if (level < goalLevel) {
        dep = add(
          { _: 'level', elite: elite, from: level, to: goalLevel },
          [
            {
              itemId: ITEM_VIRTUAL_EXP,
              quantity: sum(dataManager.data.constants.characterExpMap[elite].slice(level - 1, goalLevel - 1)),
            },
            {
              itemId: ITEM_GOLD,
              quantity: sum(dataManager.data.constants.characterUpgradeCostMap[elite].slice(level - 1, goalLevel - 1)),
            },
          ],
          dep,
        )
        level = goalLevel
      }

      const price = dataManager.data.constants.evolveGoldCost[character.rarity][elite]
      console.assert(price > 0)
      dep = add(
        { _: 'elite', elite: elite + 1 },
        [
          {
            itemId: ITEM_GOLD,
            quantity: dataManager.data.constants.evolveGoldCost[character.rarity][elite],
          },
          ...(character.raw.phases[elite + 1].evolveCost || []).map((x) => ({ itemId: x.id, quantity: x.count })),
        ],
        dep,
      )
      elite++
      level = 1
    }

    if (level < goalLevel) {
      dep = add(
        { _: 'level', elite: elite, from: level, to: goalLevel },
        [
          {
            itemId: ITEM_VIRTUAL_EXP,
            quantity: sum(dataManager.data.constants.characterExpMap[elite].slice(level - 1, goalLevel - 1)),
          },
          {
            itemId: ITEM_GOLD,
            quantity: sum(dataManager.data.constants.characterUpgradeCostMap[elite].slice(level - 1, goalLevel - 1)),
          },
        ],
        dep,
      )
      level = goalLevel
    }
  }

  if (elite === 0 && level === 0 && goal.level > 0) {
    dep = add({ _: 'join' }, [], dep)
    level = 1
  }

  let skillLevel = current.skillLevel
  let skillDep: typeof dep = undefined
  {
    while (skillLevel < goal.skillLevel) {
      if (skillLevel === 4) {
        meetEliteLevel(1, 1)
      }
      skillDep = add(
        { _: 'skill', to: skillLevel + 1 },
        [
          ...(character.raw.allSkillLvlup[skillLevel - 1].lvlUpCost || []).map((x) => ({
            itemId: x.id,
            quantity: x.count,
          })),
        ],
        dep,
        skillDep,
      )
      skillLevel++
    }
  }

  const skillIds = new Set([...Object.keys(current.skillMaster), ...Object.keys(goal.skillMaster)])
  for (const skillId of skillIds) {
    let sc = current.skillMaster[skillId] || 0
    const sg = goal.skillMaster[skillId] || sc
    let sDep: typeof dep = undefined
    if (sg > 0) meetEliteLevel(2, 1)
    while (sc < sg) {
      sDep = add(
        { _: 'skillMaster', skillId: skillId, to: sc + 1 },
        [
          ...(character.skills.find((x) => x[0].skillId == skillId)?.[0].levelUpCostCond[sc].levelUpCost || []).map(
            (x) => ({
              itemId: x.id,
              quantity: x.count,
            }),
          ),
        ],
        dep,
        skillDep,
        sDep,
      )
      sc++
    }
  }

  const modIds = new Set([...Object.keys(current.modLevel), ...Object.keys(goal.modLevel)])
  for (const modId of modIds) {
    let mc = current.modLevel[modId] || 0
    const mg = goal.modLevel[modId] || mc
    let mDep: typeof dep = undefined
    if (mg > 0) meetEliteLevel(2, character.modUnlockLevel)
    while (mc < mg) {
      mDep = add(
        { _: 'mod', modId: modId, to: mc + 1 },
        [
          ...(character.uniEquips.find((x) => x.key == modId)?.raw.itemCost?.[mc + 1] || []).map((x) => ({
            itemId: x.id,
            quantity: x.count,
          })),
        ],
        dep,
        mDep,
      )
      mc++
    }
  }

  meetEliteLevel(goal.elite, goal.level)

  return tasks
}
