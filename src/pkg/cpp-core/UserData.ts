import deepEqual from 'deep-equal'
import { Draft, produce } from 'immer'
import { Atom, PrimitiveAtom, WritableAtom, atom } from 'jotai'
import { atomFamily } from 'jotai/utils'
import { AtomFamily } from 'jotai/vanilla/utils/atomFamily'
import { clone, intersection, sum, uniq } from 'ramda'
import { SetStateAction } from 'react'
import { IGame, IGameAdapter, Task } from '../cpp-basic'
import { txatom } from '../txatom'
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

  public setAtom(baseAtom: PrimitiveAtom<UserData<G> | undefined>, forbiddenFormulaTagsAtom: PrimitiveAtom<string[]>) {
    this.baseAtom = baseAtom
    this.forbiddenFormulaTagsAtom = forbiddenFormulaTagsAtom
    this.atoms = buildAtoms(this.baseAtom, this.forbiddenFormulaTagsAtom, this.gameAdapter)
  }
}

function buildAtoms<G extends IGame>(
  baseAtom: PrimitiveAtom<UserData<G> | undefined>,
  forbiddenFormulaTagsAtom: PrimitiveAtom<string[]>,
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
    (itemId: string) => {
      const allExpItems = ga.getExpItems()
      if (Object.prototype.hasOwnProperty.call(allExpItems, itemId)) {
        const thisExpItem = allExpItems[itemId]
        return withDebugLabel(
          atom(
            (get) => {
              return sum(Object.entries(thisExpItem.value).map((x) => get(itemQuantity(x[0])) * x[1]))
            },
            () => {
              //
            },
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
        atom(() => {
          return ga.getUserDataAdapter().finishedCharacterStatus(charId)
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

  const goalTasks = atomFamily(
    (charId: string) =>
      withDebugLabel(
        atom((get) => {
          // console.log('regen goalTasks', charId)
          const current = get(currentCharacter(charId))
          const goal = get(goalCharacter(charId))
          return ga.getUserDataAdapter().generateTasksForCharacter(charId, current, goal)
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
          return ga.getUserDataAdapter().generateTasksForCharacter(charId, current, finished)
        }),
        `finishedTasks(${charId})`,
      ),
    (a, b) => a === b,
  )

  const allCharacterIds = withDebugLabel(
    atom(() => {
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
          return x.charId.endsWith('tuye') && x.id.includes('6')
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
      get(allStarredTasks).forEach(
        (x) => x.requires?.forEach((y) => (result[y.itemId] = (result[y.itemId] || 0) + y.quantity)),
      )
      return result
    }),
    'allStarredTaskRequirements',
  )

  const allGoalTaskRequirements = withDebugLabel(
    atom((get) => {
      const result: Record<string, number> = {}
      get(allGoalTasks).forEach(
        (x) => x.requires?.forEach((y) => (result[y.itemId] = (result[y.itemId] || 0) + y.quantity)),
      )
      return result
    }),
    'allGoalTaskRequirements',
  )

  const allFinishedTaskRequirements = withDebugLabel(
    atom((get) => {
      const result: Record<string, number> = {}
      get(allFinishedTasks).forEach(
        (x) => x.requires?.forEach((y) => (result[y.itemId] = (result[y.itemId] || 0) + y.quantity)),
      )
      return result
    }),
    'allFinishedTaskRequirements',
  )

  const allStarredIndirectsDetails = withDebugLabel(
    atom((get) => {
      // console.log('allStarredIndirectsDetails')
      return generateIndirects(ga, get(allStarredTaskRequirements), get(itemQuantities), get(forbiddenFormulaTagsAtom))
    }),
    'allStarredIndirectsDetails',
  )

  const allGoalIndirectsDetails = withDebugLabel(
    atom((get) => {
      // console.log('allGoalIndirectsDetails')
      return generateIndirects(ga, get(allGoalTaskRequirements), get(itemQuantities), get(forbiddenFormulaTagsAtom))
    }),
    'allGoalIndirectsDetails',
  )

  const allFinishedIndirectsDetails = withDebugLabel(
    atom((get) => {
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
      return generateTaskExtra(ga, get(sortedStarredTasks), get(forbiddenFormulaTagsAtom), get(itemQuantities))
    }),
    `starredTasksWithExtra`,
  )

  const goalTasksWithExtra = withDebugLabel(
    atom((get) => {
      return generateTaskExtra(ga, get(sortedGoalTasks), get(forbiddenFormulaTagsAtom), get(itemQuantities))
    }),
    `goalTasksWithExtra`,
  )

  const finishedTasksWithExtra = withDebugLabel(
    atom((get) => {
      return generateTaskExtra(ga, get(sortedFinishedTasks), get(forbiddenFormulaTagsAtom), get(itemQuantities))
    }),
    `finishedTasksWithExtra`,
  )

  return {
    baseAtom,
    forbiddenFormulaTagsAtom,
    ...tx,
    allDataAtom,
    rootAtom,
    goalOrder,
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
}

export function newUserData<G extends IGame>(): UserData<G> {
  return {
    current: {},
    goal: {},
    items: {},
    goalOrder: [],
    starredTasks: [],
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
        exp -= clears * value
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
