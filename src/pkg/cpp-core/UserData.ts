import deepEqual from 'deep-equal'
import { Draft, produce } from 'immer'
import { Atom, PrimitiveAtom, WritableAtom, atom } from 'jotai'
import { AtomFamily, atomFamily } from 'jotai-family'
import { clone, intersection, sum, uniq } from 'ramda'
import { SetStateAction } from 'react'
import { IGame, IGameAdapter, QueryParam, Task } from '../cpp-basic'
import { txatom } from '../txatom'
import { MoveTarget, moveKeys } from './planOrder'
import { generateTaskExtra } from './Task'

function withDebugLabel<T extends Atom<any>>(t: T, label?: string): T {
  t.debugLabel = label
  return t
}

export const enum StarStatus {
  None,
  Depended,
  Starred,
}

export class UserDataAtomHolder<G extends IGame> {
  public baseAtom!: PrimitiveAtom<UserData<G> | undefined>
  public forbiddenFormulaTagsAtom!: PrimitiveAtom<string[]>
  public atoms!: ReturnType<typeof buildAtoms<G>>

  public constructor(public readonly gameAdapter: IGameAdapter<G>) {}

  /** generationAtom: the game data generation; atoms that read game data depend on it to recompute after a commit */
  public setAtom(
    baseAtom: PrimitiveAtom<UserData<G> | undefined>,
    forbiddenFormulaTagsAtom: PrimitiveAtom<string[]>,
    generationAtom: Atom<number>,
  ) {
    this.baseAtom = baseAtom
    this.forbiddenFormulaTagsAtom = forbiddenFormulaTagsAtom
    this.atoms = buildAtoms(this.baseAtom, this.forbiddenFormulaTagsAtom, generationAtom, this.gameAdapter)
  }
}

function buildAtoms<G extends IGame>(
  baseAtom: PrimitiveAtom<UserData<G> | undefined>,
  forbiddenFormulaTagsAtom: PrimitiveAtom<string[]>,
  generationAtom: Atom<number>,
  ga: IGameAdapter<G>,
) {
  const rootAtom: PrimitiveAtom<UserData<G>> = withDebugLabel(
    atom(
      (get) => {
        let value = get(baseAtom)
        if (!value) {
          value = newUserData()
        }
        if (!value.items) value.items = {}
        if (!value.goalOrder) value.goalOrder = Object.keys(value.goal)
        if (!value.starredTasks) value.starredTasks = []
        if (!value.doneMissions) value.doneMissions = []
        if (!value.skins) value.skins = {}
        if (!value.savedQueries) value.savedQueries = []
        return value
      },
      (get, set, value) =>
        set(baseAtom, () => {
          if (typeof value === 'function') return value(get(rootAtom))
          return value
        }),
    ),
    'rootAtom',
  )

  const tx = txatom(rootAtom)
  const { dataAtom } = tx

  const doRewrite = (charId: string, data: Draft<UserData<G>>) => {
    const emptyKeys = Object.keys(ga.getUserDataAdapter().getFrozenEmptyCharacterStatus())

    if (data.current[charId]) {
      Object.keys(data.current[charId]).forEach((x) => {
        if (!emptyKeys.includes(x)) {
          delete data.current[charId][x as keyof G['characterStatus']]
        }
      })
    }

    if (data.goal[charId]) {
      Object.keys(data.goal[charId]).forEach((x) => {
        if (!emptyKeys.includes(x)) {
          delete data.goal[charId][x as keyof G['characterStatus']]
        }
      })
    }

    const [c, g] = ga.getUserDataAdapter().rewriteCharacters(charId, data.current[charId], data.goal[charId])
    if (c) {
      data.current[charId] = c
    } else {
      delete data.current[charId]
    }
    const goalIndex = data.goalOrder.indexOf(charId)
    if (g) {
      data.goal[charId] = g
      if (goalIndex < 0) data.goalOrder.push(charId)
    } else {
      delete data.goal[charId]
      if (goalIndex >= 0) data.goalOrder.splice(goalIndex, 1)
      if (data.taskGroupOrder) delete data.taskGroupOrder[charId]
    }
  }

  const allDataAtom = withDebugLabel(
    atom(
      (get) => get(dataAtom),
      (get, set, value: (draft: Draft<UserData<any>>) => any) => {
        set(dataAtom, 'modify', (data) => {
          value(data)
          for (const charId of new Set([...Object.keys(data.current), ...Object.keys(data.goal)])) {
            doRewrite(charId, data)
          }
        })
      },
    ),
    'allDataAtom',
  )

  const itemQuantities = withDebugLabel(
    atom((get) => get(dataAtom).items),
    'itemQuantities',
  )

  const itemQuantity: AtomFamily<string, WritableAtom<number, [value: SetStateAction<number>], void>> = atomFamily<
    string,
    WritableAtom<number, [value: SetStateAction<number>], void>
  >(
    (itemId: string) =>
      withDebugLabel(
        atom(
          (get) => {
            get(generationAtom)
            const allExpItems = ga.getExpItems()
            if (Object.prototype.hasOwnProperty.call(allExpItems, itemId)) {
              return sum(Object.entries(allExpItems[itemId].value).map((x) => get(itemQuantity(x[0])) * x[1]))
            }
            return get(dataAtom).items[itemId] || 0
          },
          (get, set, value: SetStateAction<number>) => {
            // The total of the exp items is derived from the counts of each of them.
            if (Object.prototype.hasOwnProperty.call(ga.getExpItems(), itemId)) return
            set(dataAtom, 'modify', (data) => {
              data.items[itemId] = typeof value === 'function' ? value(data.items[itemId] || 0) : value
            })
          },
        ),
        `itemQuantity(${itemId})`,
      ),
    (a, b) => a === b,
  )

  const currentCharacter = atomFamily(
    (charId: string) =>
      withDebugLabel(
        atom(
          (get) => get(dataAtom).current[charId] || ga.getUserDataAdapter().getFrozenEmptyCharacterStatus(),
          (get, set, value: (draft: Draft<G['characterStatus']>) => any) => {
            set(dataAtom, 'transact', () => {
              set(dataAtom, 'modify', (data) => {
                for (const i of get(allStarredTasksDetails).untouched) {
                  const pos = data.starredTasks.indexOf(i)
                  if (pos >= 0) data.starredTasks.splice(pos, 1)
                }

                data.current[charId] = (produce(
                  data.current[charId] || clone(ga.getUserDataAdapter().getFrozenEmptyCharacterStatus()),
                  value,
                ) || clone(ga.getUserDataAdapter().getFrozenEmptyCharacterStatus())) as Draft<G['characterStatus']>

                data.goal[charId] =
                  produce(data.goal[charId] || clone(data.current[charId]), () => {
                    //
                  }) || clone(data.current[charId])

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
          (get, set, value: (draft: Draft<G['characterStatus']>) => any) => {
            set(dataAtom, 'transact', () => {
              set(dataAtom, 'modify', (data) => {
                for (const i of get(allStarredTasksDetails).untouched) {
                  const pos = data.starredTasks.indexOf(i)
                  if (pos >= 0) data.starredTasks.splice(pos, 1)
                }

                data.current[charId] = (produce(
                  data.current[charId] || clone(ga.getUserDataAdapter().getFrozenEmptyCharacterStatus()),
                  () => {
                    /**/
                  },
                ) || clone(ga.getUserDataAdapter().getFrozenEmptyCharacterStatus())) as Draft<G['characterStatus']>

                data.goal[charId] =
                  produce(data.goal[charId] || clone(data.current[charId]), value) || clone(data.current[charId])

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
          get(generationAtom)
          return ga.getUserDataAdapter().finishedCharacterStatus(charId, get(currentCharacter(charId)))
        }),
        `characterFinishedStatus(${charId})`,
      ),
    (a, b) => a === b,
  )

  const isCharacterFinished = atomFamily(
    (charId: string) =>
      withDebugLabel(
        atom((get) => {
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

  const taskGroupOrder = atomFamily(
    (charId: string) =>
      withDebugLabel(
        atom((get) => get(dataAtom).taskGroupOrder?.[charId]),
        `taskGroupOrder(${charId})`,
      ),
    (a, b) => a === b,
  )

  const goalTasks = atomFamily(
    (charId: string) =>
      withDebugLabel(
        atom((get) => {
          get(generationAtom)
          // console.log('regen goalTasks', charId)
          const current = get(currentCharacter(charId))
          const goal = get(goalCharacter(charId))
          return ga.getUserDataAdapter().generateTasksForCharacter(charId, current, goal, get(taskGroupOrder(charId)))
        }),
        `goalTasks(${charId})`,
      ),
    (a, b) => a === b,
  )

  const finishedTasks = atomFamily(
    (charId: string) =>
      withDebugLabel(
        atom((get) => {
          get(generationAtom)
          // console.log('regen finishedTasks', charId)
          const current = get(currentCharacter(charId))
          const finished = get(characterFinishedStatus(charId))
          // sortedFinishedTasks dedupes these against goalTasks by value, which needs the same order on both sides.
          return ga
            .getUserDataAdapter()
            .generateTasksForCharacter(charId, current, finished, get(taskGroupOrder(charId)))
        }),
        `finishedTasks(${charId})`,
      ),
    (a, b) => a === b,
  )

  const allCharacterIds = withDebugLabel(
    atom((get) => {
      get(generationAtom)
      return ga.getUserDataAdapter().getAllCharacterIds()
    }),
    `allCharacterIds`,
  )

  const goalOrder = withDebugLabel(
    atom((get) => {
      const data = get(dataAtom)
      return uniq([...data.goalOrder, ...Object.keys(data.goal)])
    }),
    'goalOrder',
  )

  const allGoalTasks = withDebugLabel(
    atom((get) => {
      return get(goalOrder).flatMap((x) => get(goalTasks(x)))
    }),
    `allGoalTasks`,
  )

  const allStarredTasksDetails = withDebugLabel(
    atom((get) => {
      const stars = get(dataAtom).starredTasks
      const tasks = get(allGoalTasks)
      const untouched = new Set(stars)
      const directStars = new Set(
        tasks.filter((x) => {
          untouched.delete(x.id)
          return stars.includes(x.id)
        }),
      )
      const indirectStars = new Set<Task<G>>()

      function visit(t: Task<G>) {
        if (t.depends) {
          for (const i of t.depends) {
            indirectStars.add(i)
            visit(i)
          }
        }
      }
      directStars.forEach(visit)

      const starredTasks = tasks.filter((x) => directStars.has(x) || indirectStars.has(x))
      const nonStarredTasks = tasks.filter((x) => !directStars.has(x) && !indirectStars.has(x))
      return {
        untouched,
        directStars,
        indirectStars,
        sortedStarredTasks: starredTasks,
        sortedGoalTasks: [...starredTasks, ...nonStarredTasks],
      }
    }),
    `allStarredTasksDetails`,
  )

  const stars = withDebugLabel(
    atom(
      (get) => get(dataAtom).starredTasks || [],
      (get, set, value: (draft: Draft<string[]>) => any) => {
        set(dataAtom, 'modify', (data) => {
          data.starredTasks = produce(data.starredTasks || [], value)
          for (const i of get(allStarredTasksDetails).untouched) {
            const pos = data.starredTasks.indexOf(i)
            if (pos >= 0) data.starredTasks.splice(pos, 1)
          }
        })
      },
    ),
    'stars',
  )

  const allStarredTasks = withDebugLabel(
    atom((get) => {
      return get(allStarredTasksDetails).sortedStarredTasks
    }),
    `allStarredTasks`,
  )

  const allFinishedTasks = withDebugLabel(
    atom((get) => {
      return get(allCharacterIds).flatMap((x) => get(finishedTasks(x)))
    }),
    `allFinishedTasks`,
  )

  const allStarredTaskRequirements = withDebugLabel(
    atom((get) => {
      const result: Record<string, number> = {}
      get(allStarredTasks).forEach((x) =>
        x.requires?.forEach((y) => (result[y.itemId] = (result[y.itemId] || 0) + y.quantity)),
      )
      return result
    }),
    'allStarredTaskRequirements',
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

  const allStarredIndirectsDetails = withDebugLabel(
    atom((get) => {
      get(generationAtom)
      // console.log('allStarredIndirectsDetails')
      return generateIndirects(ga, get(allStarredTaskRequirements), get(itemQuantities), get(forbiddenFormulaTagsAtom))
    }),
    'allStarredIndirectsDetails',
  )

  const allGoalIndirectsDetails = withDebugLabel(
    atom((get) => {
      get(generationAtom)
      // console.log('allGoalIndirectsDetails')
      return generateIndirects(ga, get(allGoalTaskRequirements), get(itemQuantities), get(forbiddenFormulaTagsAtom))
    }),
    'allGoalIndirectsDetails',
  )

  const allFinishedIndirectsDetails = withDebugLabel(
    atom((get) => {
      get(generationAtom)
      // console.log('allFinishedIndirectsDetails')
      return generateIndirects(ga, get(allFinishedTaskRequirements), get(itemQuantities), get(forbiddenFormulaTagsAtom))
    }),
    'allFinishedIndirectsDetails',
  )

  const allStarredIndirects = withDebugLabel(
    atom((get) => {
      return get(allStarredIndirectsDetails).indirects
    }),
    'allStarredIndirects',
  )

  const allGoalIndirects = withDebugLabel(
    atom((get) => {
      return get(allGoalIndirectsDetails).indirects
    }),
    'allGoalIndirects',
  )

  const allFinishedIndirects = withDebugLabel(
    atom((get) => {
      return get(allFinishedIndirectsDetails).indirects
    }),
    'allFinishedIndirects',
  )

  const sortedStarredTasks = withDebugLabel(
    atom((get) => {
      return get(allStarredTasks)
    }),
    `sortedStarredTasks`,
  )

  const sortedGoalTasks = withDebugLabel(
    atom((get) => {
      return get(allStarredTasksDetails).sortedGoalTasks
    }),
    `sortedGoalTasks`,
  )

  const sortedFinishedTasks = withDebugLabel(
    atom((get) => {
      return uniq([...get(sortedGoalTasks), ...get(allFinishedTasks)])
    }),
    `sortedGoalTasks`,
  )

  const starredTasksWithExtra = withDebugLabel(
    atom((get) => {
      get(generationAtom)
      return generateTaskExtra(ga, get(sortedStarredTasks), get(forbiddenFormulaTagsAtom), get(itemQuantities))
    }),
    `starredTasksWithExtra`,
  )

  const goalTasksWithExtra = withDebugLabel(
    atom((get) => {
      get(generationAtom)
      return generateTaskExtra(ga, get(sortedGoalTasks), get(forbiddenFormulaTagsAtom), get(itemQuantities))
    }),
    `goalTasksWithExtra`,
  )

  const finishedTasksWithExtra = withDebugLabel(
    atom((get) => {
      get(generationAtom)
      return generateTaskExtra(ga, get(sortedFinishedTasks), get(forbiddenFormulaTagsAtom), get(itemQuantities))
    }),
    `finishedTasksWithExtra`,
  )

  const moveInPlan = withDebugLabel(
    atom(null, (get, set, { charIds, target }: { charIds: readonly string[]; target: MoveTarget }) => {
      const order = get(goalOrder)
      const next = moveKeys(order, charIds, target)
      if (next === order) return
      set(dataAtom, 'modify', (data) => {
        data.goalOrder = [...next]
      })
    }),
    'moveInPlan',
  )

  const moveTaskGroup = withDebugLabel(
    atom(null, (get, set, { charId, group, target }: { charId: string; group: string; target: MoveTarget }) => {
      const groups = uniq(get(goalTasks(charId)).flatMap((x) => (x.group ? [x.group] : [])))
      const next = moveKeys(groups, [group], target)
      if (next === groups) return
      set(dataAtom, 'modify', (data) => {
        data.taskGroupOrder = { ...data.taskGroupOrder, [charId]: [...next] }
      })
    }),
    'moveTaskGroup',
  )

  const dropStars = (data: Draft<UserData<G>>, ids: ReadonlySet<string>) => {
    for (let i = data.starredTasks.length - 1; i >= 0; i--) {
      if (ids.has(data.starredTasks[i])) data.starredTasks.splice(i, 1)
    }
  }

  // An operator without a current status gets an empty one first, as goalCharacter's write does: rewriteCharacters
  // passes a goal without one through unchecked, and drops the empty status again itself.
  const maxGoals = withDebugLabel(
    atom(null, (get, set, charIds: readonly string[]) => {
      const untouched = get(allStarredTasksDetails).untouched
      const finished = charIds.map((charId) => [charId, get(characterFinishedStatus(charId))] as const)
      set(dataAtom, 'modify', (data) => {
        dropStars(data, untouched)
        for (const [charId, status] of finished) {
          if (!data.current[charId]) {
            data.current[charId] = clone(ga.getUserDataAdapter().getFrozenEmptyCharacterStatus()) as Draft<
              G['characterStatus']
            >
          }
          data.goal[charId] = clone(status) as Draft<G['characterStatus']>
          doRewrite(charId, data)
        }
      })
    }),
    'maxGoals',
  )

  // The stars go now rather than at the next status change: left behind, they would come back with the same tasks
  // when the operator is planned again.
  const clearGoals = withDebugLabel(
    atom(null, (get, set, charIds: readonly string[]) => {
      const drop = new Set(get(allStarredTasksDetails).untouched)
      for (const charId of charIds) for (const task of get(goalTasks(charId))) drop.add(task.id)
      set(dataAtom, 'modify', (data) => {
        dropStars(data, drop)
        for (const charId of charIds) {
          if (!(charId in data.goal)) continue
          delete data.goal[charId]
          doRewrite(charId, data)
        }
      })
    }),
    'clearGoals',
  )

  // By id, not by count: elite 2 level 60 and elite 2 level 90 make as many tasks.
  const goalMaxed = atomFamily(
    (charId: string) =>
      withDebugLabel(
        atom((get) => {
          const planned = new Set(get(goalTasks(charId)).map((x) => x.id))
          return get(finishedTasks(charId)).every((x) => planned.has(x.id))
        }),
        `goalMaxed(${charId})`,
      ),
    (a, b) => a === b,
  )

  return {
    baseAtom,
    forbiddenFormulaTagsAtom,
    ...tx,
    allDataAtom,
    rootAtom,
    goalOrder,
    moveInPlan,
    moveTaskGroup,
    maxGoals,
    clearGoals,
    goalMaxed,
    stars,
    itemQuantities,
    itemQuantity,
    currentCharacter,
    goalCharacter,
    characterFinishedStatus,
    isCharacterFinished,
    currentCharacters,
    goalCharacters,
    finishedCharacters,
    taskGroupOrder,
    goalTasks,
    finishedTasks,
    allCharacterIds,
    allStarredTasksDetails,
    allStarredTasks,
    allGoalTasks,
    allFinishedTasks,
    allStarredTaskRequirements,
    allGoalTaskRequirements,
    allFinishedTaskRequirements,
    allStarredIndirects,
    allGoalIndirects,
    allFinishedIndirects,
    allStarredIndirectsDetails,
    allGoalIndirectsDetails,
    allFinishedIndirectsDetails,
    sortedStarredTasks,
    sortedGoalTasks,
    sortedFinishedTasks,
    starredTasksWithExtra,
    goalTasksWithExtra,
    finishedTasksWithExtra,
  }
}

export interface UserData<G extends IGame> {
  current: Record<string, G['characterStatus']>
  goal: Record<string, G['characterStatus']>
  items: Record<string, number>
  goalOrder: string[]
  starredTasks: string[]
  /** 做完的明日方舟模组任务的 id（如 uniequip_002_mgllan_2）；模组解锁以后也不删，等级改回 0 时勾选还在 */
  doneMissions: string[]
  /** 已有的明日方舟时装 id → 获得时间（Unix 秒，不知道时为 0） */
  skins: Record<string, number>
  savedQueries: SavedQuery[]
  /** 「常看」的自定义版本，缺省时用游戏给出的默认 */
  favQuery?: QueryParam
  /**
   * 「更多视图」里游戏预设改过的列宽：菜单那一行的 key → 列 → px，一行的几段共用。
   * 只记改过的列，没改的跟着预设走
   */
  presetWidths?: Record<string, Record<string, number>>
  /**
   * 每名干员里几项整组任务（Task.group）的先后：干员 id → 组的 key。拖过或按过「角色内排序」才有；
   * 没列出的组跟在后面，按游戏给的默认顺序
   */
  taskGroupOrder?: Record<string, string[]>
}

export interface SavedQuery {
  id: string
  name: string
  query: QueryParam
}

export function newUserData<G extends IGame>(): UserData<G> {
  return {
    current: {},
    goal: {},
    items: {},
    goalOrder: [],
    starredTasks: [],
    doneMissions: [],
    skins: {},
    savedQueries: [],
  }
}

export function generateIndirects<G extends IGame>(
  ga: IGameAdapter<G>,
  inputRequirements: Record<string, number>,
  inputQuantities: Record<string, number>,
  forbiddenFormulaTags: string[],
  formulaUses: Record<string, number> | null = null,
) {
  const indirects: Record<string, number> = {}
  const quantities: Record<string, number> = clone(inputQuantities)
  const unsatisfiedRequirements: Record<string, number> = {}
  const synthisisedRequirements: Record<string, number> = {}
  const remainingFormulaUses = formulaUses ? clone(formulaUses) : null
  const unsatisfiedRequirementsDueToFormulaUses = formulaUses ? ({} as Record<string, number>) : null
  function pass(requirements: Record<string, number>): void {
    const newRequirements: Record<string, number> = {}
    for (const [itemId, requires] of Object.entries(requirements)) {
      const quantity = quantities[itemId] || 0
      const diff = requires - quantity
      if (diff > 0) {
        quantities[itemId] = 0

        const formula = ga
          .getFormulas()
          .find((x) => x.itemId === itemId && intersection(forbiddenFormulaTags || [], x.tags || []).length === 0)
        if (!formula) {
          unsatisfiedRequirements[itemId] = (unsatisfiedRequirements[itemId] || 0) + diff
          continue
        }

        const allTimes = Math.ceil(diff / formula.quantity)
        let times = allTimes
        if (remainingFormulaUses) {
          times = Math.min(times, Math.max(remainingFormulaUses[formula.id], 0) || 0)
          remainingFormulaUses[formula.id] -= times
        }
        if (times < allTimes) {
          unsatisfiedRequirements[itemId] = (unsatisfiedRequirements[itemId] || 0) + (diff - times * formula.quantity)
          unsatisfiedRequirementsDueToFormulaUses![itemId] =
            (unsatisfiedRequirementsDueToFormulaUses![itemId] || 0) + (diff - times * formula.quantity)
        }
        if (times > 0) {
          synthisisedRequirements[itemId] = (synthisisedRequirements[itemId] || 0) + times * formula.quantity
          for (const cost of formula.costs) {
            const newRequirement = times * cost.quantity
            newRequirements[cost.itemId] = (newRequirements[cost.itemId] || 0) + newRequirement
            indirects[cost.itemId] = (indirects[cost.itemId] || 0) + newRequirement
          }
        }
      } else {
        quantities[itemId] -= requires
      }
    }

    if (Object.values(newRequirements).length > 0) return pass(newRequirements)
  }

  pass(inputRequirements)

  for (const [virtualExpItemId, thisExpItem] of Object.entries(ga.getExpItems())) {
    if (unsatisfiedRequirements[virtualExpItemId] && unsatisfiedRequirements[virtualExpItemId] > 0) {
      let exp = unsatisfiedRequirements[virtualExpItemId]
      for (const expItem of Object.entries(thisExpItem.value).sort((a, b) => -a[1] + b[1])) {
        if (!quantities[expItem[0]]) continue
        const count = Math.min(quantities[expItem[0]], Math.ceil(exp / expItem[1]))
        const fulfilled = count * expItem[1]
        exp -= fulfilled
        quantities[expItem[0]] -= count
        indirects[expItem[0]] = (indirects[expItem[0]] || 0) + count
        if (exp <= 0) break
      }
      synthisisedRequirements[virtualExpItemId] = unsatisfiedRequirements[virtualExpItemId] - exp
      if (exp > 0) {
        const value = sum(thisExpItem.indirectStage.map((x) => thisExpItem.value[x.itemId] * x.quantity))
        const clears = Math.ceil(exp / value)
        // exp -= clears * value —— 之后不再读 exp，留着与上面的 exp -= fulfilled 对照
        for (const i of thisExpItem.indirectStage) {
          indirects[i.itemId] = (indirects[i.itemId] || 0) + Math.ceil(i.quantity * clears)
        }
      }
      delete unsatisfiedRequirements[virtualExpItemId]
    }
  }

  return {
    indirects,
    unsatisfiedRequirements,
    synthisisedRequirements,
    unsatisfiedRequirementsDueToFormulaUses,
  }
}
