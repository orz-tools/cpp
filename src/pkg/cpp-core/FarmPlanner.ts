import { Inject } from '../container'
import { DataManager, FormulaTag, ITEM_GOLD, ITEM_VIRTUAL_EXP } from './DataManager'
import Lpsolver, { IModel } from 'javascript-lp-solver'
import { intersection, sortBy } from 'ramda'
import { ExcelStageTable } from './excelTypes'

export class FarmPlannerFactory {
  dataManager = Inject(DataManager)

  stageInfo: Record<
    string,
    {
      excel: ExcelStageTable.Stage
      samples: number
      dropInfo: Record<string, number>
      sortedDropInfo: [string, number][]
      varRow: { [K in ModelSolutionVar | ModelInternalVar]?: number }
    }
  > = undefined as any
  cacheExpiresAt: number = Infinity
  getStageInfo() {
    if (this.stageInfo && Date.now() < this.cacheExpiresAt) return this.stageInfo

    const expItems = Object.fromEntries(
      Object.values(this.dataManager.raw.exItems.expItems).map((x) => [x.id, x.gainExp]),
    )
    const now = Date.now()
    const map = new Map<string, FarmPlannerFactory['stageInfo'][any]>()
    this.stageInfo = {}
    this.cacheExpiresAt = Infinity
    for (const i of this.dataManager.raw.penguinMatrix.matrix) {
      if (i.start && i.start > now) {
        this.cacheExpiresAt = Math.min(this.cacheExpiresAt, i.start)
      }
      if (i.end && i.end > now) {
        this.cacheExpiresAt = Math.min(this.cacheExpiresAt, i.end)
      }
      if (i.start > now || (i.end && i.end < now)) continue
      if (!this.dataManager.data.items[i.itemId]) continue
      if (!this.dataManager.raw.exStage.stages[i.stageId]) continue

      const stageInfo = this.dataManager.raw.exStage.stages[i.stageId]
      let stage = map.get(i.stageId)
      if (!stage) {
        stage = { excel: stageInfo, varRow: {}, samples: 0, dropInfo: {}, sortedDropInfo: [] }
        map.set(i.stageId, stage)
        this.stageInfo[i.stageId] = stage

        if (!stageInfo.apCost) console.log(stageInfo)
        stage.varRow[`ap`] = stageInfo.apCost
        stage.varRow[`item:${ITEM_GOLD}`] = stageInfo.apCost * 12
        stage.dropInfo[ITEM_GOLD] = stageInfo.apCost * 12
      }

      stage.dropInfo[i.itemId] = i.quantity / i.times
      stage.samples = Math.max(stage.samples, i.times)
      if (expItems[i.itemId]) {
        stage.varRow[`item:${ITEM_VIRTUAL_EXP}`] =
          (stage.varRow[`item:${ITEM_VIRTUAL_EXP}`] || 0) + (i.quantity / i.times) * expItems[i.itemId]
      } else {
        stage.varRow[`item:${i.itemId}`] = i.quantity / i.times
      }
    }

    {
      const stageInfo = this.dataManager.raw.exStage.stages['wk_melee_6']
      const stage = {
        excel: stageInfo,
        varRow: {},
        samples: Infinity,
        dropInfo: { [ITEM_GOLD]: 10000 },
        sortedDropInfo: [],
      } as FarmPlannerFactory['stageInfo'][any]
      stage.varRow[`ap`] = stageInfo.apCost
      stage.varRow[`item:${ITEM_GOLD}`] = 10000
      map.set('wk_melee_6', stage)
      this.stageInfo['wk_melee_6'] = stage
    }

    {
      const stageInfo = this.dataManager.raw.exStage.stages['wk_toxic_5']
      const stage = {
        excel: stageInfo,
        varRow: {},
        samples: Infinity,
        dropInfo: { ['4006']: 21, [ITEM_GOLD]: stageInfo.apCost * 12 },
        sortedDropInfo: [],
      } as FarmPlannerFactory['stageInfo'][any]
      stage.varRow[`ap`] = stageInfo.apCost
      stage.varRow[`item:4006`] = 21
      stage.varRow[`item:${ITEM_GOLD}`] = stageInfo.apCost * 12
      map.set('wk_toxic_5', stage)
      this.stageInfo['wk_toxic_5'] = stage
    }

    for (const i of Object.values(this.stageInfo)) {
      i.sortedDropInfo = sortBy((i) => {
        if (i[0] === ITEM_GOLD) return 1000
        if (expItems[i[0]]) {
          return 1000 + expItems[i[0]]
        }
        return -i[1]
      }, Object.entries(i.dropInfo))
    }

    return this.stageInfo
  }

  async build(options: { forbiddenFormulaTags: FormulaTag[] }) {
    const model: IModel<ModelSolutionVar, ModelInternalVar> = {
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

    for (const formula of this.dataManager.data.formulas) {
      if (intersection(formula.tags, options.forbiddenFormulaTags).length !== 0) continue

      const item = {} as Exclude<(typeof model)['variables'][any], undefined>
      item[`item:${formula.itemId}`] = formula.quantity
      for (const cost of formula.costs) {
        item[`item:${cost.itemId}`] = -cost.quantity
      }

      model.variables[`formula:${formula.id}`] = item
      // model.ints![`formula:${formula.id}`] = true
    }

    const stageInfo = this.getStageInfo()
    for (const [k, v] of Object.entries(stageInfo)) {
      model.variables[`battle:${k}`] = v.varRow
      // model.ints![`battle:${k}`] = true
    }

    // for (const expItem of Object.values(this.dataManager.raw.exItems.expItems)) {
    //   model.variables[`expItem:${expItem.id}`] = {
    //     [`item:${expItem.id}`]: -1,
    //     [`item:${ITEM_VIRTUAL_EXP}`]: expItem.gainExp,
    //   }
    //   model.ints![`expItem:${expItem.id}`] = true
    // }

    Object.values(model.variables).forEach((c) =>
      Object.keys(c!)
        .filter((x) => x.startsWith('item:'))
        .forEach((x) => {
          model.constraints[x as any] = { min: 0 }
          model.variables.have![x as any] = 0
        }),
    )

    return new FarmPlanner(model)
  }
}

type ModelSolutionVar =
  | `battle:${string}`
  | `formula:${string}`
  // | `expItem:${string}`
  | `unfeasible:${string}`
  | 'have'
  | 'ap'
type ModelInternalVar = `item:${string}` | 'init'

export class FarmPlanner {
  feasible = new Set<string>()
  unfeasible = new Set<string>()

  constructor(private model: IModel<ModelSolutionVar, ModelInternalVar>) {
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
    const h = this.model.variables.have!
    for (const [k, v] of Object.entries(quantities)) {
      h[`item:${k}`] = v
    }
  }

  public async run() {
    for (const i of this.unfeasible) {
      this.model.variables[`unfeasible:${i}`] = { [i]: 1 }
    }
    // delete this.model.ints
    return Lpsolver.Solve(this.model, 1e-4)
  }
}