import deepEqual from 'deep-equal'
import { sum } from 'ramda'
import { IUserDataAdapter, Task } from '../cpp-basic'
import { RE_ITEM_EXP, RE_ITEM_GOLD, Re1999, Re1999CharacterStatus, Re1999CharacterTaskType } from './types'
import { Re1999DataManager, Character } from './DataManager'
import { Draft } from 'immer'

const emptyCharacterStatus = Object.freeze<Re1999CharacterStatus>({
  insight: 0,
  level: 0,
  resonate: 1,
})

export class Re1999UserDataAdapter implements IUserDataAdapter<Re1999> {
  constructor(public dataManager: Re1999DataManager) {}

  compareCharacter(a: Character, b: Character, stA: Re1999CharacterStatus, stB: Re1999CharacterStatus): number {
    if (a.rarity > b.rarity) return -1
    if (a.rarity < b.rarity) return 1

    if (stA.insight > stB.insight) return -1
    if (stA.insight < stB.insight) return 1

    if (stA.level > stB.level) return -1
    if (stA.level < stB.level) return 1

    return 0
  }

  isAbsentCharacter(c: Character, st: Re1999CharacterStatus) {
    return st.level == 0
  }

  isFavCharacter(c: Character, st: Re1999CharacterStatus) {
    return st.insight < 3
  }

  getAllCharacterIds(): string[] {
    return (
      Object.entries(this.dataManager.data.characters)
        // .filter(([, v]) => !!v.raw.isOnline)
        .map(([k]) => k)
    )
  }

  getFrozenEmptyCharacterStatus(): Re1999CharacterStatus {
    return emptyCharacterStatus
  }

  isManuallyTask(task: Task<Re1999>) {
    return task.type._ === 'join'
  }

  generateTasksForCharacter(charId: string, current: Re1999CharacterStatus, goal: Re1999CharacterStatus) {
    if (current == goal) return []
    const dataManager = this.dataManager
    const character = dataManager.data.characters[charId]

    const tasks: Task<Re1999>[] = []
    const add = (
      type: Re1999CharacterTaskType,
      requires: Task<Re1999>['requires'],
      ...depends: (Task<Re1999> | undefined)[]
    ): Task<Re1999> => {
      const task: Task<Re1999> = {
        id: character.key + JSON.stringify(type),
        charId: character.key,
        type,
        requires,
        depends: depends.filter(isTask),
      }
      tasks.push(task)
      return task
    }

    let insight = current.insight
    let level = current.level
    let dep: Task<Re1999> | undefined = undefined

    const meetInsightLevel = (goalInsight: number, goalLevel: number) => {
      if (insight > goalInsight || (insight === goalInsight && level >= goalLevel)) return

      while (insight < goalInsight) {
        const goalLevel = character.maxLevels[insight]
        if (level < goalLevel) {
          dep = add(
            { _: 'level', insight: insight, from: level, to: goalLevel },
            [
              {
                itemId: RE_ITEM_EXP,
                quantity: sum(dataManager.data.constants.levelExp[character.rarity][insight].slice(level, goalLevel)),
              },
              {
                itemId: RE_ITEM_GOLD,
                quantity: sum(dataManager.data.constants.levelGold[character.rarity][insight].slice(level, goalLevel)),
              },
            ],
            dep,
          )
          level = goalLevel
        }

        dep = add({ _: 'insight', insight: insight + 1 }, character.insightCost(insight + 1), dep)
        insight++
        level = 1
      }

      if (level < goalLevel) {
        dep = add(
          { _: 'level', insight: insight, from: level, to: goalLevel },
          [
            {
              itemId: RE_ITEM_EXP,
              quantity: sum(dataManager.data.constants.levelExp[character.rarity][insight].slice(level, goalLevel)),
            },
            {
              itemId: RE_ITEM_GOLD,
              quantity: sum(dataManager.data.constants.levelGold[character.rarity][insight].slice(level, goalLevel)),
            },
          ],
          dep,
        )
        level = goalLevel
      }
    }

    if (insight === 0 && level === 0 && goal.level > 0) {
      dep = add({ _: 'join' }, [], dep)
      level = 1
    }

    let resonate = current.resonate
    let resonateDep: typeof dep = undefined
    {
      while (resonate < goal.resonate) {
        meetInsightLevel(character.resonateInsightRequires(resonate + 1), 1)
        resonateDep = add({ _: 'resonate', to: resonate + 1 }, character.resonateCost(resonate + 1), dep, resonateDep)
        resonate++
      }
    }

    meetInsightLevel(goal.insight, goal.level)

    return tasks
  }

  formatTaskAsString(type: Re1999CharacterTaskType, charId: string) {
    const character = this.dataManager.data.characters[charId]
    switch (type._) {
      case 'join':
        return `招募`
      case 'insight':
        return `洞${'零一二三'[type.insight]}`
      case 'level':
        return `洞${'零一二三'[type.insight]}等级 ${type.from} -> ${type.to}`
      case 'resonate': {
        return `共鸣 ${type.to}`
      }
      default:
        throwBad(type)
    }
  }

  completeTask(type: Re1999CharacterTaskType, charId: string, d: Draft<Re1999CharacterStatus>) {
    switch (type._) {
      case 'insight':
        d.insight = type.insight
        d.level = 1
        break
      case 'join':
        d.level = 1
        break
      case 'level':
        d.insight = type.insight
        d.level = type.to
        break
      case 'resonate':
        d.resonate = type.to
        break
      default:
        throwBad(type)
    }
  }

  finishedCharacterStatus(charId: string) {
    const char = this.dataManager.data.characters[charId]
    return {
      insight: char.maxInsight,
      level: char.maxLevels[char.maxInsight],
      resonate: char.maxResonate,
    }
  }

  rewriteCharacter(charId: string, status: Draft<Re1999CharacterStatus>) {
    const char = this.dataManager.data.characters[charId]
    if (status.insight < 0 || !isFinite(status.insight)) status.insight = 0
    if (status.level < 0 || !isFinite(status.level)) status.level = 0

    if (status.insight === 0 && status.level === 0) {
      status.insight = 0
      status.level = 0
      status.resonate = 1
      return
    }

    if (status.insight > char.maxInsight) {
      status.insight = char.maxInsight
      status.level = char.maxLevels[status.insight]
    }

    if (status.level < 1 || !isFinite(status.level)) status.level = 1
    if (status.level > char.maxLevels[status.insight]) {
      status.level = char.maxLevels[status.insight]
    }

    status.resonate = parseInt(String(status.resonate))
    if (!isFinite(status.resonate)) status.resonate = 1
    if (status.resonate < 1) status.resonate = 1
    if (status.resonate > char.maxResonate) status.resonate = char.maxResonate
    if (status.resonate > char.maxResonateAtInsight(status.insight))
      status.resonate = char.maxResonateAtInsight(status.insight)
  }

  rewriteGoal(charId: string, current: Draft<Re1999CharacterStatus>, goal: Draft<Re1999CharacterStatus>) {
    const char = this.dataManager.data.characters[charId]

    if (goal.insight < current.insight) {
      goal.insight = current.insight
      goal.level = current.level
    }

    if (goal.insight === current.insight && goal.level < current.level) {
      goal.level = current.level
    }

    if (goal.resonate < current.resonate) {
      goal.resonate = current.resonate
    }
  }

  rewriteCharacters(
    charId: string,
    current: Draft<Re1999CharacterStatus> | undefined,
    goal: Draft<Re1999CharacterStatus> | undefined,
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
    if (current.insight === 0 && current.level === 0) current = undefined

    return [current, goal] as const
  }
}

const isTask = (i: Task<Re1999> | undefined): i is Task<Re1999> => !!i

function throwBad(p: never): never {
  throw new Error(`Missing switch coverage: ${p}`)
}
