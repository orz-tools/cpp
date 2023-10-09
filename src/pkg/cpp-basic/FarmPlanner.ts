import Lpsolver, { IModel } from 'javascript-lp-solver'
import { intersection } from 'ramda'
import { IGameAdapter } from './managers'
import { IGame } from './types'

export type FarmModelSolutionVar =
  | `battle:${string}`
  | `formula:${string}`
  // | `expItem:${string}`
  | `unfeasible:${string}`
  | 'ap'
export type FarmModelInternalVar = `item:${string}`

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
    previousResult?: Awaited<ReturnType<FarmPlanner<G>['run']>>,
  ): Promise<FarmPlanner<G>> {
    await Promise.resolve()

    const model: IModel<FarmModelSolutionVar, FarmModelInternalVar> = {
      optimize: 'ap',
      opType: 'min',
      constraints: {},
      variables: {},
      ints: {},
      options: {
        timeout: 3_000,
      },
    }

    for (const formula of ga.getFormulas()) {
      if (intersection(formula.tags, options.forbiddenFormulaTags).length !== 0) continue
      if (previousResult) {
        const p = previousResult[`formula:${formula.id}`] || 0
        if (p <= 0) continue
        model.constraints[`formula:${formula.id}`] = { min: 0, max: Math.ceil(p) }
      } else {
        model.constraints[`formula:${formula.id}`] = { min: 0 }
      }

      const item = {} as Exclude<(typeof model)['variables'][any], undefined>
      item[`formula:${formula.id}`] = 1
      item[`item:${formula.itemId}`] = formula.quantity
      for (const cost of formula.costs) {
        item[`item:${cost.itemId}`] = -cost.quantity
      }

      model.variables[`formula:${formula.id}`] = item
    }

    const stageInfo = ga.getStageInfos()
    for (const [k, v] of Object.entries(stageInfo)) {
      if (options.forbiddenStageIds.includes(k)) continue
      if (previousResult) {
        const p = previousResult[`battle:${k}`] || 0
        if (p <= 0) continue
        model.constraints[`battle:${k}`] = { min: 0, max: Math.ceil(p) }
      } else {
        model.constraints[`battle:${k}`] = { min: 0 }
      }
      model.variables[`battle:${k}`] = Object.assign({}, v.varRow, {
        [`battle:${k}`]: 1,
      })
    }

    Object.values(model.variables).forEach((c) =>
      Object.keys(c!)
        .filter((x) => x.startsWith('item:'))
        .forEach((x) => {
          model.constraints[x as any] = { min: 0 }
        }),
    )

    return new FarmPlanner(model, ga)
  }

  public constructor(
    private model: IModel<FarmModelSolutionVar, FarmModelInternalVar>,
    private ga: IGameAdapter<G>,
  ) {
    for (const [, v] of Object.entries(this.model.variables)) {
      for (const [kk, vv] of Object.entries(v!)) {
        if (!(vv! > 0)) continue
        this.feasible.add(kk)
      }
    }

    for (const [, v] of Object.entries(this.model.variables)) {
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
    const expMap = new Map<string, [number, string]>()
    for (const [virtualExpItemId, thisExpItem] of Object.entries(allExpItems)) {
      for (const [item, value] of Object.entries(thisExpItem.value)) {
        expMap.set(item, [value, virtualExpItemId])
      }
    }
    const contribute = (kk: string, q: number) => {
      const k = `item:${kk}` as const
      if (!this.model.constraints[k]) {
        this.model.constraints[k] = { min: 0 }
      }
      if (!this.feasible.has(k) && !this.unfeasible.has(k)) {
        this.unfeasible.add(k)
      }
      const c = this.model.constraints[k]!
      if (c.min == null) c.min = 0
      c.min -= q
    }
    for (const [k, v] of Object.entries(quantities)) {
      if (expMap.has(k)) {
        const [value, virtualExpItemId] = expMap.get(k)!
        contribute(virtualExpItemId, v * value)
      } else {
        contribute(k, v)
      }
    }
  }

  public async run() {
    await Promise.resolve()
    for (const i of this.unfeasible) {
      this.model.variables[`unfeasible:${i}`] = { [i]: 1 }
      this.model.constraints[`unfeasible:${i}`] = { min: 0 }
    }
    // delete this.model.ints
    try {
      console.log('converted as minizinc input', this.compile())
    } catch (e) {
      console.warn('failed to convert as minizinc input', e)
    }
    const result = Lpsolver.Solve(this.model, 1e-4)
    console.log('lpsolver result', this.model, result)
    return result
  }

  public compile() {
    const varMap = new Map<string, string>()
    const varSet = new Set()
    const alloc = function (n: string) {
      if (varMap.has(n)) return varMap.get(n)!
      const t = n.replace(/[^a-zA-Z0-9_]/g, '_')
      if (varSet.has(t)) throw new Error('variable name collision')
      varSet.add(t)
      varMap.set(n, t)
      return t
    }

    const constraints = new Map<string, { min?: number; max?: number; terms: Map<string, number> }>()
    const getConstraint = (k: string) => {
      if (!constraints.has(k)) constraints.set(k, { terms: new Map() })
      return constraints.get(k)!
    }

    for (const [k, items] of Object.entries(this.model.variables)) {
      for (const [kk, vv] of Object.entries(items!)) {
        if (vv !== 0 && vv !== undefined) {
          getConstraint(kk).terms.set(k, vv)
        }
      }
    }

    const variables = new Map<string, { min?: number; max?: number }>()
    for (const [label, o] of constraints) {
      if (o.terms.size === 1 && o.terms.keys().next().value === label) {
        if (o.terms.values().next().value !== 1) {
          throw new Error(`invalid self constraint: ${label} = ${o.terms.values().next().value}`)
        }
        constraints.delete(label)
        continue
      }
      for (const x of o.terms.keys()) {
        if (!variables.has(x)) {
          variables.set(x, {})
        }
      }
    }

    for (const [key, xx] of Object.entries(this.model.constraints || {})) {
      const x = xx || {}
      if (constraints.has(key)) {
        const cc = constraints.get(key)!
        cc.min = x.min
        cc.max = x.max
      } else if (variables.has(key)) {
        const cc = variables.get(key)!
        cc.min = x.min
        cc.max = x.max
      } else {
        console.warn('unmigrated constraint: ' + key)
      }
    }

    const ap = constraints.get('ap')!
    if (!ap) throw new Error('target not found: ap')
    constraints.delete('ap')
    console.log('minizinc converter context', constraints, variables)

    const result = []
    const output = []
    output.push('"{"')
    for (const [key, x] of variables) {
      if (x.min == null && x.max == null) {
        result.push(`var int: ${alloc(key)};`)
      } else {
        result.push(`var ${x.min == null ? '' : x.min}..${x.max == null ? '' : x.max}: ${alloc(key)};`)
      }
      output.push(`"${JSON.stringify(key).replaceAll('\\', '\\\\').replaceAll('"', '\\"')}:\\(${alloc(key)}),"`)
    }

    const buildExpression = (terms: Map<string, number>) => {
      if (terms.size === 0) return '(0)'
      const e = []
      for (const [k, v] of terms) {
        e.push(`${alloc(k)} * (${v})`)
      }
      return '(' + e.join(' + ') + ')'
    }
    for (const [, x] of constraints) {
      const exp = buildExpression(x.terms)
      if (x.min != null) {
        result.push(`constraint ${exp} >= ${x.min};`)
      }
      if (x.max != null) {
        result.push(`constraint ${exp} <= ${x.max};`)
      }
    }
    result.push(`solve minimize ${buildExpression(ap.terms)};`)
    output.push(`"\\"ap\\":\\(${buildExpression(ap.terms)})"`)
    output.push('"}\\n"')
    result.push(`output [${output.join(', ')}];`)

    return result.join('\n')
  }
}
