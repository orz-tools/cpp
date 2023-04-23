import { Inject } from '../container'
import { DataManager, FormulaTag, ITEM_GOLD, ITEM_VIRTUAL_EXP } from './DataManager'
import Lpsolver, { IModel } from 'javascript-lp-solver'
import { intersection, sortBy } from 'ramda'
import { ExcelStageTable } from './excelTypes'

export const diffGroupName = {
  NORMAL: '标准',
  TOUGH: '磨难',
  EASY: '剧情',
} as Record<string, string>

export class FarmPlannerFactory {
  dataManager = Inject(DataManager)

  zoneNames: Record<string, string> = {}
  private stageInfo: Record<
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
    this.zoneNames = {}
    this.cacheExpiresAt = Infinity
    const loadZoneName = (stageInfo: ExcelStageTable.Stage, isRetro: boolean) => {
      if (this.zoneNames[stageInfo.zoneId]) return
      if (isRetro) {
        const retroId = this.dataManager.raw.exRetro.zoneToRetro[stageInfo.zoneId]
        if (retroId) {
          this.zoneNames[stageInfo.zoneId] = this.dataManager.raw.exRetro.retroActList[retroId]?.name
        }
      } else {
        const zone = this.dataManager.raw.exZone.zones[stageInfo.zoneId]
        this.zoneNames[stageInfo.zoneId] = [zone?.zoneNameFirst || '', zone?.zoneNameSecond || ''].join(' ')
      }
    }
    for (const i of this.dataManager.raw.penguinMatrix.matrix) {
      if (i.start && i.start > now) {
        this.cacheExpiresAt = Math.min(this.cacheExpiresAt, i.start)
      }
      if (i.end && i.end > now) {
        this.cacheExpiresAt = Math.min(this.cacheExpiresAt, i.end)
      }
      if (i.start > now || (i.end && i.end < now)) continue
      if (!this.dataManager.data.items[i.itemId]) continue

      let stageId = i.stageId
      if (stageId.startsWith('wk_armor_')) continue // SK-...

      let stageInfo = this.dataManager.raw.exStage.stages[stageId]
      let isRetro = false
      if (stageId.endsWith('_rep')) {
        stageId = stageId.slice(0, stageId.length - 4)
      } else if (stageId.endsWith('_perm')) {
        stageId = stageId.slice(0, stageId.length - 5)
        stageInfo = this.dataManager.raw.exRetro.stageList[stageId]
        isRetro = true
      }
      if (!stageInfo) {
        continue
      }
      loadZoneName(stageInfo, isRetro)

      let stage = map.get(stageId)
      if (!stage) {
        stage = { excel: stageInfo, varRow: {}, samples: 0, dropInfo: {}, sortedDropInfo: [] }
        map.set(stageId, stage)
        this.stageInfo[stageId] = stage

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

    const makeCE = (stageId: string, gold: number) => {
      const stageInfo = this.dataManager.raw.exStage.stages[stageId]
      const stage = {
        excel: stageInfo,
        varRow: {},
        samples: Infinity,
        dropInfo: { [ITEM_GOLD]: gold },
        sortedDropInfo: [],
      } as FarmPlannerFactory['stageInfo'][any]
      stage.varRow[`ap`] = stageInfo.apCost
      stage.varRow[`item:${ITEM_GOLD}`] = gold
      map.set(stageId, stage)
      this.stageInfo[stageId] = stage
      loadZoneName(stageInfo, false)
    }
    makeCE('wk_melee_6', 10000)
    makeCE('wk_melee_5', 7500)
    makeCE('wk_melee_4', 5700)
    makeCE('wk_melee_3', 4100)
    makeCE('wk_melee_2', 2800)
    makeCE('wk_melee_1', 1700)

    const makeAP = (stageId: string, ticket: number) => {
      const stageInfo = this.dataManager.raw.exStage.stages[stageId]
      const stage = {
        excel: stageInfo,
        varRow: {},
        samples: Infinity,
        dropInfo: { ['4006']: ticket, [ITEM_GOLD]: stageInfo.apCost * 12 },
        sortedDropInfo: [],
      } as FarmPlannerFactory['stageInfo'][any]
      stage.varRow[`ap`] = stageInfo.apCost
      stage.varRow[`item:4006`] = ticket
      stage.varRow[`item:${ITEM_GOLD}`] = stageInfo.apCost * 12
      map.set(stageId, stage)
      this.stageInfo[stageId] = stage
      loadZoneName(stageInfo, false)
    }
    makeAP('wk_toxic_5', 21)

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

  async build(options: { forbiddenFormulaTags: FormulaTag[]; forbiddenStageIds: string[] }) {
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
      if (options.forbiddenStageIds.includes(k)) continue
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

    return new FarmPlanner(model, this.dataManager)
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

  constructor(private model: IModel<ModelSolutionVar, ModelInternalVar>, private dataManager: DataManager) {
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
    const expItems = Object.fromEntries(
      Object.values(this.dataManager.raw.exItems.expItems).map((x) => [x.id, x.gainExp]),
    )
    const h = this.model.variables.have!
    for (const [k, v] of Object.entries(quantities)) {
      if (expItems[k]) {
        h[`item:${ITEM_VIRTUAL_EXP}`] = (h[`item:${ITEM_VIRTUAL_EXP}`] || 0) + v * expItems[k]
      } else {
        h[`item:${k}`] = v
      }
    }
  }

  public async run() {
    for (const i of this.unfeasible) {
      this.model.variables[`unfeasible:${i}`] = { [i]: 1 }
    }
    // delete this.model.ints
    const result = Lpsolver.Solve(this.model, 1e-4)
    console.log(this.model, result)
    return result
  }
}
