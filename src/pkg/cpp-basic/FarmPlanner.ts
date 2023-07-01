import Lpsolver, { IModel } from 'javascript-lp-solver'
import { intersection } from 'ramda'
import { IGameAdapter } from './managers'
import { IGame } from './types'

export type FarmModelSolutionVar =
  | `battle:${string}`
  | `formula:${string}`
  // | `expItem:${string}`
  | `unfeasible:${string}`
  | 'have'
  | 'ap'
export type FarmModelInternalVar = `item:${string}` | 'init'

export interface CreateFarmPlannerOptions {
  forbiddenFormulaTags: string[]
  forbiddenStageIds: string[]
}

export class FarmPlanner<G extends IGame> {
  private feasible = new Set<string>()
  private unfeasible = new Set<string>()

  public static async create<G extends IGame>(
    ga: IGameAdapter<G>,
    options: CreateFarmPlannerOptions,
  ): Promise<FarmPlanner<G>> {
    await Promise.resolve()

    const model: IModel<FarmModelSolutionVar, FarmModelInternalVar> = {
      optimize: 'ap',
      opType: 'min',
      constraints: {
        init: { equal: 1 },
      },
      variables: {
        have: {
          init: 1,
        },
      },
      ints: {},
      options: {
        timeout: 3_000,
      },
    }

    for (const formula of ga.getFormulas()) {
      if (intersection(formula.tags, options.forbiddenFormulaTags).length !== 0) continue

      const item = {} as Exclude<(typeof model)['variables'][any], undefined>
      item[`item:${formula.itemId}`] = formula.quantity
      for (const cost of formula.costs) {
        item[`item:${cost.itemId}`] = -cost.quantity
      }

      model.variables[`formula:${formula.id}`] = item
    }

    const stageInfo = ga.getStageInfos()
    for (const [k, v] of Object.entries(stageInfo)) {
      if (options.forbiddenStageIds.includes(k)) continue
      model.variables[`battle:${k}`] = v.varRow
    }

    Object.values(model.variables).forEach((c) =>
      Object.keys(c!)
        .filter((x) => x.startsWith('item:'))
        .forEach((x) => {
          model.constraints[x as any] = { min: 0 }
          model.variables.have![x as any] = 0
        }),
    )

    return new FarmPlanner(model, ga)
  }

  public constructor(private model: IModel<FarmModelSolutionVar, FarmModelInternalVar>, private ga: IGameAdapter<G>) {
    for (const [k, v] of Object.entries(this.model.variables)) {
      if (k === 'have') continue
      for (const [kk, vv] of Object.entries(v!)) {
        if (!(vv! > 0)) continue
        this.feasible.add(kk)
      }
    }

    for (const [k, v] of Object.entries(this.model.variables)) {
      if (k === 'have') continue
      for (const [kk, vv] of Object.entries(v!)) {
        if (!(vv! < 0)) continue
        if (!this.feasible.has(kk) && !this.unfeasible.has(kk)) {
          this.unfeasible.add(kk)
        }
      }
    }
  }

  public setRequirements(requirements: Record<string, number>) {
    for (const [k, v] of Object.entries(requirements)) {
      const key = `item:${k}` as const
      if (!this.feasible.has(key) && !this.unfeasible.has(key)) {
        this.unfeasible.add(key)
      }
      this.model.constraints[key] = { min: v }
    }
  }

  public setQuantity(quantities: Record<string, number>) {
    const allExpItems = this.ga.getExpItems()
    const map = new Map<string, [number, string]>()
    for (const [virtualExpItemId, thisExpItem] of Object.entries(allExpItems)) {
      for (const [item, value] of Object.entries(thisExpItem.value)) {
        map.set(item, [value, virtualExpItemId])
      }
    }
    const h = this.model.variables.have!
    for (const [k, v] of Object.entries(quantities)) {
      if (map.has(k)) {
        const [value, virtualExpItemId] = map.get(k)!
        h[`item:${virtualExpItemId}`] = (h[`item:${virtualExpItemId}`] || 0) + v * value
      } else {
        h[`item:${k}`] = v
      }
    }
  }

  public async run() {
    await Promise.resolve()
    for (const i of this.unfeasible) {
      this.model.variables[`unfeasible:${i}`] = { [i]: 1 }
    }
    // delete this.model.ints
    const result = Lpsolver.Solve(this.model, 1e-4)
    console.log(this.model, result)
    return result
  }
}
