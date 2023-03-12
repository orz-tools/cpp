import { sum } from 'ramda'
import { Character, DataManager, ITEM_GOLD, ITEM_VIRTUAL_EXP } from './DataManager'
import { CharacterStatus, emptyCharacterStatus } from './UserData'

interface Task {
  id: string
  charId: string
  type: TaskType
  requires: { itemId: string; quantity: number }[]
  depends: Task[]
}

type TaskType =
  | { _: 'join' }
  | { _: 'elite'; elite: number }
  | { _: 'level'; elite: number; from: number; to: number }
  | { _: 'skill'; to: number }
  | { _: 'skillMaster'; skillId: string; to: number }
  | { _: 'mod'; modId: string; to: number }

const isTask = (i: Task | undefined): i is Task => !!i

export class ComputationCore {
  constructor(
    private readonly dataManager: DataManager,
    private readonly current: Record<string, CharacterStatus>,
    private readonly goal: Record<string, CharacterStatus>,
  ) {
    const a = window.performance.now()
    this.processCharacters()
    const b = window.performance.now()
    console.log(this, `processed in ${b - a}`)
  }

  public readonly tasks: Task[] = []

  processCharacters() {
    const charIds = new Set([...Object.keys(this.current), ...Object.keys(this.goal)])
    for (const charId of charIds) {
      const character = this.dataManager.data.characters[charId]
      const current = this.current[charId] || emptyCharacterStatus
      const goal = this.goal[charId] || this.current[charId]
      this.tasks.push(...this.processCharacter(character, current, goal))
    }
  }

  processCharacter(character: Character, current: CharacterStatus, goal: CharacterStatus) {
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
                quantity: sum(this.dataManager.data.constants.characterExpMap[elite].slice(level - 1, goalLevel - 1)),
              },
              {
                itemId: ITEM_GOLD,
                quantity: sum(
                  this.dataManager.data.constants.characterUpgradeCostMap[elite].slice(level - 1, goalLevel - 1),
                ),
              },
            ],
            dep,
          )
          level = goalLevel
        }

        const price = this.dataManager.data.constants.evolveGoldCost[character.rarity][elite]
        console.assert(price > 0)
        dep = add(
          { _: 'elite', elite: elite + 1 },
          [
            {
              itemId: ITEM_GOLD,
              quantity: this.dataManager.data.constants.evolveGoldCost[character.rarity][elite],
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
              quantity: sum(this.dataManager.data.constants.characterExpMap[elite].slice(level - 1, goalLevel - 1)),
            },
            {
              itemId: ITEM_GOLD,
              quantity: sum(
                this.dataManager.data.constants.characterUpgradeCostMap[elite].slice(level - 1, goalLevel - 1),
              ),
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
}
