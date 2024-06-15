import deepEqual from 'deep-equal'
import { Draft } from 'immer'
import stringify from 'json-stringify-deterministic'
import { sum } from 'ramda'
import { IUserDataAdapter, Task } from '../cpp-basic'
import { gt } from '../gt'
import { ArknightsDataManager, Character } from './DataManager'
import {
  AK_ITEM_GOLD,
  AK_ITEM_VIRTUAL_EXP,
  Arknights,
  ArknightsCharacterStatus,
  ArknightsCharacterTaskType,
} from './types'

const emptyCharacterStatus = Object.freeze<ArknightsCharacterStatus>({
  elite: 0,
  level: 0,
  skillLevel: 1,
  skillMaster: Object.freeze({}),
  modLevel: Object.freeze({}),
})

export class ArknightsUserDataAdapter implements IUserDataAdapter<Arknights> {
  public constructor(public dataManager: ArknightsDataManager) {}

  public compareCharacter(
    a: Character,
    b: Character,
    stA: ArknightsCharacterStatus,
    stB: ArknightsCharacterStatus,
  ): number {
    if (a.rarity > b.rarity) return -1
    if (a.rarity < b.rarity) return 1

    if (stA.elite > stB.elite) return -1
    if (stA.elite < stB.elite) return 1

    if (stA.level > stB.level) return -1
    if (stA.level < stB.level) return 1

    return 0
  }

  public isAbsentCharacter(c: Character, st: ArknightsCharacterStatus) {
    return st.level === 0
  }

  public isFavCharacter(c: Character, st: ArknightsCharacterStatus) {
    return st.elite < 2
  }

  public getAllCharacterIds(): string[] {
    return Object.entries(this.dataManager.data.characters)
      .filter(([, v]) => !!v.raw.displayNumber)
      .map(([k]) => k)
  }

  public getFrozenEmptyCharacterStatus(): ArknightsCharacterStatus {
    return emptyCharacterStatus
  }

  public isManuallyTask(task: Task<Arknights>) {
    return task.type._ === 'join'
  }

  public generateTasksForCharacter(charId: string, current: ArknightsCharacterStatus, goal: ArknightsCharacterStatus) {
    if (current === goal) return []
    const dataManager = this.dataManager
    const character = dataManager.data.characters[charId]

    const tasks: Task<Arknights>[] = []
    const add = (
      type: ArknightsCharacterTaskType,
      requires: Task<Arknights>['requires'],
      ...depends: (Task<Arknights> | undefined)[]
    ): Task<Arknights> => {
      const task: Task<Arknights> = {
        id: `${character.key}:${stringify(type)}`,
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
    let dep: Task<Arknights> | undefined = undefined

    const meetEliteLevel = (goalElite: number, goalLevel: number) => {
      if (elite > goalElite || (elite === goalElite && level >= goalLevel)) return

      while (elite < goalElite) {
        const goalLevel = character.maxLevels[elite]
        if (level < goalLevel) {
          dep = add(
            { _: 'level', elite: elite, from: level, to: goalLevel },
            [
              {
                itemId: AK_ITEM_VIRTUAL_EXP,
                quantity: sum(dataManager.data.constants.characterExpMap[elite].slice(level - 1, goalLevel - 1)),
              },
              {
                itemId: AK_ITEM_GOLD,
                quantity: sum(
                  dataManager.data.constants.characterUpgradeCostMap[elite].slice(level - 1, goalLevel - 1),
                ),
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
              itemId: AK_ITEM_GOLD,
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
              itemId: AK_ITEM_VIRTUAL_EXP,
              quantity: sum(dataManager.data.constants.characterExpMap[elite].slice(level - 1, goalLevel - 1)),
            },
            {
              itemId: AK_ITEM_GOLD,
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
            ...(character.allSkillLvlup[skillLevel - 1].lvlUpCost || []).map((x) => ({
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
      const sdata = character.skills.find((x) => x[0].skillId === skillId)?.[0]
      const data = sdata?.levelUpCostCond
      if (!data) continue
      while (sc < sg) {
        sDep = add(
          { _: 'skillMaster', skillId: skillId, to: sc + 1 },
          [
            ...(data[sc].levelUpCost || []).map((x) => ({
              itemId: x.id,
              quantity: x.count,
            })),
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
            ...(character.uniEquips.find((x) => x.key === modId)?.raw.itemCost?.[mc + 1] || []).map((x) => ({
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

  public formatTaskAsString(type: ArknightsCharacterTaskType, charId: string) {
    const character = this.dataManager.data.characters[charId]
    switch (type._) {
      case 'join':
        return gt.pgettext('arknights task', `招募`)
      case 'skill':
        return gt
          .pgettext('arknights task', `技能 %d 级`) /* I10N: %d: number */
          .replaceAll('%d', `${type.to}`)
      case 'elite':
        return [
          gt.pgettext('arknights task', '精零'),
          gt.pgettext('arknights task', '精一'),
          gt.pgettext('arknights task', '精二'),
        ][type.elite]
      case 'level':
        return [
          gt.pgettext('arknights task', `精零等级 %d$from -> %d$to`) /* I10N: %d$from: from, %d$to: to */,
          gt.pgettext('arknights task', `精一等级 %d$from -> %d$to`) /* I10N: %d$from: from, %d$to: to */,
          gt.pgettext('arknights task', `精二等级 %d$from -> %d$to`) /* I10N: %d$from: from, %d$to: to */,
        ][type.elite]
          .replaceAll('%d$from', `${type.from}`)
          .replaceAll('%d$to', `${type.to}`)
      case 'skillMaster': {
        const skillIndex = character.skills.findIndex((x) => x[0].skillId === type.skillId)
        const skill = character.skills[skillIndex]
        return [
          gt.pgettext(
            'arknights task',
            `%d$number 技能专一: %s$name`,
          ) /* I10N: %d$number: skill number, %s$name: skill name */,
          gt.pgettext(
            'arknights task',
            `%d$number 技能专二: %s$name`,
          ) /* I10N: %d$number: skill number, %s$name: skill name */,
          gt.pgettext(
            'arknights task',
            `%d$number 技能专三: %s$name`,
          ) /* I10N: %d$number: skill number, %s$name: skill name */,
        ][type.to - 1]
          .replaceAll('%d$number', `${skillIndex + 1}`)
          .replaceAll('%s$name', `${skill[1].name}`)
      }
      case 'mod': {
        const uniEquip = character.uniEquips.find((x) => x.key === type.modId)!
        return [
          gt.pgettext(
            'arknights task',
            `%s$code 模组 1 级: %s$name`,
          ) /* I10N: %s$code: module code, %s$name: module name */,
          gt.pgettext(
            'arknights task',
            `%s$code 模组 2 级: %s$name`,
          ) /* I10N: %s$code: module code, %s$name: module name */,
          gt.pgettext(
            'arknights task',
            `%s$code 模组 3 级: %s$name`,
          ) /* I10N: %s$code: module code, %s$name: module name */,
        ][type.to - 1]
          .replaceAll('%s$code', `${uniEquip.raw.typeName2!.toUpperCase()}`)
          .replaceAll('%s$name', `${uniEquip.name}`)
      }
      default:
        throwBad(type)
    }
  }

  public completeTask(type: ArknightsCharacterTaskType, charId: string, d: Draft<ArknightsCharacterStatus>) {
    switch (type._) {
      case 'elite':
        d.elite = type.elite
        d.level = 1
        break
      case 'join':
        d.level = 1
        break
      case 'level':
        d.elite = type.elite
        d.level = type.to
        break
      case 'mod':
        d.modLevel[type.modId] = type.to
        break
      case 'skill':
        d.skillLevel = type.to
        break
      case 'skillMaster':
        d.skillMaster[type.skillId] = type.to
        break
      default:
        throwBad(type)
    }
  }

  public finishedCharacterStatus(charId: string) {
    const char = this.dataManager.data.characters[charId]
    return {
      elite: char.maxElite,
      level: char.maxLevels[char.maxElite],
      skillLevel: char.skills.length > 0 ? 7 : 1,
      skillMaster: char.maxElite >= 2 ? Object.fromEntries(char.skills.map(([, skill]) => [skill.key, 3])) : {},
      modLevel:
        char.maxElite >= 2
          ? Object.fromEntries(
              char.uniEquips.filter((x) => x.raw.unlockEvolvePhase > 'PHASE_0').map((mod) => [mod.key, 3]),
            )
          : {},
    }
  }

  public rewriteCharacter(charId: string, status: Draft<ArknightsCharacterStatus>) {
    const char = this.dataManager.data.characters[charId]
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
    if (char.skills.length === 0) {
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

    if (char.rarity < 3 || status.skillLevel < 7 || status.elite < 2) {
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

  public rewriteGoal(charId: string, current: Draft<ArknightsCharacterStatus>, goal: Draft<ArknightsCharacterStatus>) {
    const char = this.dataManager.data.characters[charId]

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

  public rewriteCharacters(
    charId: string,
    current: Draft<ArknightsCharacterStatus> | undefined,
    goal: Draft<ArknightsCharacterStatus> | undefined,
  ) {
    if (!current || !goal) return [current, goal] as const

    const char = this.dataManager.data.characters[charId]
    if (!char) return [undefined, undefined] as const

    this.rewriteCharacter(charId, current)
    this.rewriteCharacter(charId, goal)
    this.rewriteGoal(charId, current, goal)
    if (deepEqual(current, goal, { strict: true })) {
      goal = undefined
    }
    if (current.elite === 0 && current.level === 0) current = undefined

    return [current, goal] as const
  }
}

const isTask = (i: Task<Arknights> | undefined): i is Task<Arknights> => !!i

function throwBad(p: never): never {
  throw new Error(`Missing switch coverage: ${p}`)
}
