import Lpsolver, { IModel } from 'javascript-lp-solver'

export interface ItemValueStage {
  id: string
  ap: number
  drops: Record<string, number>
}

export interface ItemValueFormula {
  id: string
  itemId: string // 主产物
  outputs: Record<string, number> // 主产物数量 + 副产物期望量
  costs: Record<string, number> // 含龙门币
  equality?: boolean // true：按等式纳入
}

export interface ItemValueInput {
  stages: ItemValueStage[]
  formulas: ItemValueFormula[]
  equalPairs?: [string, string][]
  demand: Record<string, number> // >0 的键构成需求根集
  demandFloor?: number // 默认 1
  fixed?: Record<string, number> // 固定价值
}

export type ItemValueSolution =
  | { status: 'ok'; values: Map<string, number>; droppedStages: string[] }
  | { status: 'error'; reason: string }

type Row = { coefs: Map<string, number>; rhs: number; equal: boolean }

/**
 * 物品价值 = 最小理智刷图 LP 的对偶变量：关卡产出的价值不超过其理智，合成不凭空产生价值，
 * 在此约束下最大化需求加权的总价值。
 */
export function solveItemValues(input: ItemValueInput): ItemValueSolution {
  try {
    return solve(input)
  } catch (e) {
    return { status: 'error', reason: e instanceof Error ? e.message : String(e) }
  }
}

function solve(input: ItemValueInput): ItemValueSolution {
  const fixed = new Map(Object.entries(input.fixed || {}))
  const floor = input.demandFloor ?? 1

  const fixedContribution = (amounts: Record<string, number>) => {
    let sum = 0
    for (const [itemId, q] of Object.entries(amounts)) {
      const c = fixed.get(itemId)
      if (c != null) sum += q * c
    }
    return sum
  }

  // 固定价值的产出已经抵得上理智的关卡会让问题不可行，先去掉，也不让它为物品提供来源
  const droppedStages: string[] = []
  const stages: { stage: ItemValueStage; rhs: number }[] = []
  for (const stage of input.stages) {
    const rhs = stage.ap - fixedContribution(stage.drops)
    if (rhs < -1e-9 * Math.max(1, stage.ap)) {
      droppedStages.push(stage.id)
      continue
    }
    stages.push({ stage, rhs: Math.max(0, rhs) })
  }

  const items = closure(input, fixed, stages)

  const rows = new Map<string, Row>()
  for (const { stage, rhs } of stages) {
    const coefs = new Map<string, number>()
    for (const [itemId, q] of Object.entries(stage.drops)) {
      if (items.has(itemId) && q !== 0) coefs.set(itemId, (coefs.get(itemId) || 0) + q)
    }
    if (coefs.size > 0) rows.set(`stage:${stage.id}`, { coefs, rhs, equal: false })
  }

  for (const formula of input.formulas) {
    if (!items.has(formula.itemId)) continue
    if (!Object.keys(formula.costs).every((x) => items.has(x) || fixed.has(x))) continue
    const coefs = new Map<string, number>()
    const add = (itemId: string, q: number) => {
      if (items.has(itemId)) coefs.set(itemId, (coefs.get(itemId) || 0) + q)
    }
    for (const [itemId, q] of Object.entries(formula.outputs)) add(itemId, q)
    for (const [itemId, q] of Object.entries(formula.costs)) add(itemId, -q)
    for (const [itemId, q] of coefs) if (q === 0) coefs.delete(itemId)
    const rhs = fixedContribution(formula.costs) - fixedContribution(formula.outputs)
    rows.set(`formula:${formula.id}`, { coefs, rhs, equal: !!formula.equality })
  }

  for (const [a, b] of input.equalPairs || []) {
    if (!items.has(a) || !items.has(b) || a === b) continue
    rows.set(`pair:${a}:${b}`, {
      coefs: new Map([
        [a, 1],
        [b, -1],
      ]),
      rhs: 0,
      equal: true,
    })
  }

  // 列缩放：龙门币与 T5 材料的系数相差五六个数量级，按列归一后单纯形才稳定
  const scale = new Map<string, number>()
  for (const row of rows.values()) {
    for (const [itemId, q] of row.coefs) scale.set(itemId, Math.max(scale.get(itemId) || 0, Math.abs(q)))
  }

  const model: IModel = {
    optimize: 'demand',
    opType: 'max',
    constraints: {},
    variables: {},
    options: { timeout: 3_000 },
  }
  for (const itemId of items) {
    const k = scale.get(itemId) || 1
    model.variables[`v:${itemId}`] = { demand: ((input.demand[itemId] || 0) + floor) / k }
  }
  for (const [name, row] of rows) {
    if (row.coefs.size === 0) {
      if (row.equal ? Math.abs(row.rhs) > 1e-9 : row.rhs < -1e-9) {
        return { status: 'error', reason: `constraint ${name} cannot be satisfied` }
      }
      continue
    }
    model.constraints[name] = row.equal ? { equal: row.rhs } : { max: row.rhs }
    for (const [itemId, q] of row.coefs) {
      model.variables[`v:${itemId}`]![name] = q / scale.get(itemId)!
    }
  }

  const result = Lpsolver.Solve(model, 1e-9)
  if (result.feasible === false) return { status: 'error', reason: 'infeasible' }
  if (result.bounded === false) return { status: 'error', reason: 'unbounded' }

  const values = new Map<string, number>()
  for (const itemId of items) {
    const u = (result as Record<string, number>)[`v:${itemId}`] || 0
    values.set(itemId, u / (scale.get(itemId) || 1))
  }
  return { status: 'ok', values, droppedStages }
}

/** 可定价物品：需求根集沿配方反向闭包，与“有来源”的物品取交集，再去掉固定价值的物品。 */
function closure(input: ItemValueInput, fixed: Map<string, number>, stages: { stage: ItemValueStage }[]): Set<string> {
  const needed = new Set(Object.keys(input.demand).filter((x) => input.demand[x] > 0))
  for (let changed = true; changed;) {
    changed = false
    for (const formula of input.formulas) {
      if (!needed.has(formula.itemId)) continue
      for (const itemId of Object.keys(formula.costs)) {
        if (!needed.has(itemId)) {
          needed.add(itemId)
          changed = true
        }
      }
    }
  }

  const sourced = new Set(fixed.keys())
  for (const { stage } of stages) {
    for (const [itemId, q] of Object.entries(stage.drops)) if (q > 0) sourced.add(itemId)
  }
  for (let changed = true; changed;) {
    changed = false
    for (const formula of input.formulas) {
      if (sourced.has(formula.itemId)) continue
      if (Object.keys(formula.costs).every((x) => sourced.has(x))) {
        sourced.add(formula.itemId)
        changed = true
      }
    }
  }

  return new Set([...needed].filter((x) => sourced.has(x) && !fixed.has(x)))
}
