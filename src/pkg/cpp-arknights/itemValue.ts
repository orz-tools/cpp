import { ItemValueFormula, ItemValueStage, solveItemValues } from '../cpp-basic/ItemValueSolver'
import type { ArknightsAdapter } from './GameAdapter'
import type { PenguinMatrixItem } from './sources/penguinTypes'
import { AK_FIXED_DROP_STAGES, AK_ITEM_GOLD, AK_ITEM_VIRTUAL_EXP } from './types'

export type StageScope = 'mainline' | 'permanent' | 'open'
export const STAGE_SCOPES: readonly StageScope[] = ['mainline', 'permanent', 'open']

export type ItemValueFormulaKind =
  | 'elite2'
  | 'elite3'
  | 'elite4'
  | 'elite5'
  | 'skill2'
  | 'skill3'
  | 'building'
  | 'chip'
  | 'chipPack'
  | 'dualChip'
  | 'shop'

export const BYPRODUCT_KINDS = [
  'elite2',
  'elite3',
  'elite4',
  'elite5',
  'skill2',
  'skill3',
  'building',
  'chip',
  'chipPack',
] as const satisfies readonly ItemValueFormulaKind[]
export type ByproductKind = (typeof BYPRODUCT_KINDS)[number]

export type ChipProfession = 'PIONEER' | 'WARRIOR' | 'TANK' | 'SNIPER' | 'CASTER' | 'MEDIC' | 'SUPPORT' | 'SPECIAL'
export const CHIP_PAIRS = {
  TANK_MEDIC: ['TANK', 'MEDIC'],
  SNIPER_CASTER: ['SNIPER', 'CASTER'],
  PIONEER_SUPPORT: ['PIONEER', 'SUPPORT'],
  WARRIOR_SPECIAL: ['WARRIOR', 'SPECIAL'],
} as const satisfies Record<string, readonly [ChipProfession, ChipProfession]>
export type ChipPair = keyof typeof CHIP_PAIRS
export type ChipConversion = 'split' | ChipProfession

// 芯片 id 为 32<n><tier>，n 即职业
const CHIP_PROFESSION_BY_DIGIT: Record<string, ChipProfession> = {
  '1': 'PIONEER',
  '2': 'WARRIOR',
  '3': 'TANK',
  '4': 'SNIPER',
  '5': 'CASTER',
  '6': 'MEDIC',
  '7': 'SUPPORT',
  '8': 'SPECIAL',
}

export function chipProfession(itemId: string): ChipProfession | undefined {
  if (!/^32\d\d$/.test(itemId)) return undefined
  return CHIP_PROFESSION_BY_DIGIT[itemId[2]]
}

export interface ItemValueConfig {
  stageScope: StageScope
  excludedStageIds: string[]
  minSamples: number
  lmdCoefficient: number
  expCoefficient: number
  byproductBoost: Record<ByproductKind, number>
  chipConversion: Record<ChipPair, ChipConversion>
  fixedValues: Record<string, number>
}

export const EXP_COEFFICIENT_PRESETS = [
  { id: 'ls6', value: 0.9568 },
  { id: 'trading3', value: 0.6331877729257642 },
  { id: 'trading3Tequila2Proviso2', value: 0.8020477815699659 },
  { id: 'trading2Proviso2', value: 0.812807881773399 },
  { id: 'trading1Proviso2', value: 0.8333333333333334 },
  { id: 'none', value: 0 },
] as const

export const RETIREMENT_PRESETS = [
  { itemId: '30073', value: 1.8 },
  { itemId: '30083', value: 2.16 },
  { itemId: '30093', value: 2.52 },
  { itemId: '30103', value: 2.88 },
  { itemId: '31013', value: 2.52 },
  { itemId: '31023', value: 2.16 },
] as const

export const DEFAULT_ITEM_VALUE_CONFIG: Readonly<ItemValueConfig> = Object.freeze<ItemValueConfig>({
  stageScope: 'permanent',
  excludedStageIds: [],
  minSamples: 500,
  lmdCoefficient: 1,
  expCoefficient: 0.6331877729257642,
  byproductBoost: {
    elite2: 1,
    elite3: 1,
    elite4: 1,
    elite5: 1,
    skill2: 0.8,
    skill3: 0.8,
    building: 0,
    chip: 0.8,
    chipPack: 0.8,
  },
  chipConversion: {
    TANK_MEDIC: 'split',
    SNIPER_CASTER: 'split',
    PIONEER_SUPPORT: 'split',
    WARRIOR_SPECIAL: 'split',
  },
  fixedValues: { '30073': 1.8, '30083': 2.16, '30093': 2.52, '30103': 2.88 },
})

export function normalizeItemValueConfig(raw: unknown): ItemValueConfig {
  const d = DEFAULT_ITEM_VALUE_CONFIG
  const o: Record<string, any> = raw && typeof raw === 'object' ? raw : {}
  const num = (x: unknown, fallback: number, min: number, max = Infinity) =>
    typeof x === 'number' && Number.isFinite(x) && x >= min && x <= max ? x : fallback
  const record = (x: unknown): Record<string, unknown> =>
    (x && typeof x === 'object' && !Array.isArray(x) ? x : {}) as any

  const boost = record(o.byproductBoost)
  const chips = record(o.chipConversion)
  let fixedValues: Record<string, number> = { ...d.fixedValues }
  if (o.fixedValues && typeof o.fixedValues === 'object' && !Array.isArray(o.fixedValues)) {
    fixedValues = {}
    for (const [k, v] of Object.entries(o.fixedValues as Record<string, unknown>)) {
      if (typeof v === 'number' && Number.isFinite(v) && v >= 0) fixedValues[k] = v
    }
  }

  return {
    stageScope: STAGE_SCOPES.includes(o.stageScope) ? o.stageScope : d.stageScope,
    excludedStageIds: Array.isArray(o.excludedStageIds)
      ? o.excludedStageIds.filter((x: unknown): x is string => typeof x === 'string')
      : [...d.excludedStageIds],
    minSamples: Number.isInteger(o.minSamples) && o.minSamples >= 0 ? o.minSamples : d.minSamples,
    lmdCoefficient: num(o.lmdCoefficient, d.lmdCoefficient, 0, 1),
    expCoefficient: num(o.expCoefficient, d.expCoefficient, 0, 1),
    byproductBoost: Object.fromEntries(
      BYPRODUCT_KINDS.map((k) => [k, num(boost[k], d.byproductBoost[k], 0)]),
    ) as ItemValueConfig['byproductBoost'],
    chipConversion: Object.fromEntries(
      Object.entries(CHIP_PAIRS).map(([pair, professions]) => {
        const v = chips[pair]
        return [pair, v === 'split' || (professions as readonly unknown[]).includes(v) ? v : 'split']
      }),
    ) as ItemValueConfig['chipConversion'],
    fixedValues,
  }
}

export interface ItemValueFormulaSource {
  id: string
  kind: ItemValueFormulaKind
  itemId: string
  quantity: number
  costs: Record<string, number> // 含龙门币
  byproductRate: number // 游戏数据的 extraOutcomeRate；无副产物时为 0
  byproducts: Record<string, number> // weight / Σweight × itemCount
}

export interface ItemValueGameInputs {
  gameDataVersion: string
  // 键为去掉 _rep/_perm 后缀的关卡 id；retroAp 是常驻版本（矩阵中的 _perm）的理智，可能与活动期间不同
  stages: Record<string, { ap: number; retroAp?: number; scope: 'mainline' | 'permanent' | 'activity' }>
  fixedDrops: { stageId: string; drops: Record<string, number> }[]
  formulas: ItemValueFormulaSource[]
  demand: Record<string, number>
  expItems: Record<string, number> // itemId → gainExp
  materialRarity: Record<string, number> // 精英材料（出现在 F_EVOLVE 配方中的物品）→ 稀有度 0–4
}

export type ItemValueResult =
  | { status: 'ok'; values: Map<string, number>; pricedCount: number; droppedStages: string[]; elapsedMs: number }
  | { status: 'error'; reason: string }

const ELITE_KIND_BY_RARITY: Record<string, ItemValueFormulaKind> = {
  TIER_2: 'elite2',
  TIER_3: 'elite3',
  TIER_4: 'elite4',
  TIER_5: 'elite5',
}

const RARITY: Record<string, number> = { TIER_1: 0, TIER_2: 1, TIER_3: 2, TIER_4: 3, TIER_5: 4 }

/**
 * 全干员需求里，新材料的量远小于同稀有度的老材料，顺带的副产物和零星掉落就能满足，LP 会把它们定到 0。
 * 新干员会优先用新材料，所以每种精英材料的需求至少取同稀有度材料需求的中位数，按将来的用量定价。
 */
export function applyMaterialDemandFloor(gameInputs: ItemValueGameInputs): Record<string, number> {
  const byRarity = new Map<number, number[]>()
  for (const [itemId, rarity] of Object.entries(gameInputs.materialRarity)) {
    byRarity.set(rarity, [...(byRarity.get(rarity) || []), gameInputs.demand[itemId] || 0])
  }
  const demand = { ...gameInputs.demand }
  for (const [itemId, rarity] of Object.entries(gameInputs.materialRarity)) {
    const sorted = [...byRarity.get(rarity)!].sort((a, b) => a - b)
    demand[itemId] = Math.max(demand[itemId] || 0, sorted[Math.floor(sorted.length / 2)])
  }
  return demand
}

const SKILL_KIND_BY_ITEM: Record<string, ItemValueFormulaKind> = {
  '3302': 'skill2',
  '3303': 'skill3',
}

export function exportItemValueGameInputs(ga: ArknightsAdapter): ItemValueGameInputs {
  const dm = ga.getDataManager()
  const raw = dm.raw
  const base = raw.local || raw

  const stages: ItemValueGameInputs['stages'] = {}
  const scopeOf = (stageId: string, zoneId: string) => {
    const type = base.exZone.zones[zoneId]?.type
    if (type === 'MAINLINE' || type === 'WEEKLY') return 'mainline'
    if (Object.hasOwn(base.exRetro.stageList, stageId)) return 'permanent'
    return 'activity'
  }
  for (const [stageId, excel] of Object.entries(base.exStage.stages)) {
    stages[stageId] = { ap: excel.apCost, scope: scopeOf(stageId, excel.zoneId) }
  }
  for (const [stageId, excel] of Object.entries(base.exRetro.stageList)) {
    stages[stageId] = {
      ap: stages[stageId]?.ap ?? excel.apCost,
      retroAp: excel.apCost,
      scope: stages[stageId]?.scope ?? scopeOf(stageId, excel.zoneId),
    }
  }

  const fixedDrops = AK_FIXED_DROP_STAGES.map((x) => ({
    stageId: x.stageId,
    drops: {
      ...x.drops,
      ...(x.apGold ? { [AK_ITEM_GOLD]: raw.exStage.stages[x.stageId].apCost * 12 } : {}),
    },
  }))

  const formulas: ItemValueFormulaSource[] = []
  for (const f of Object.values(raw.exBuilding.workshopFormulas)) {
    let kind: ItemValueFormulaKind | undefined
    if (f.formulaType === 'F_EVOLVE') kind = ELITE_KIND_BY_RARITY[raw.exItems.items[f.itemId]?.rarity]
    else if (f.formulaType === 'F_SKILL') kind = SKILL_KIND_BY_ITEM[f.itemId]
    else if (f.formulaType === 'F_BUILDING') kind = 'building'
    else if (f.formulaType === 'F_ASC')
      kind = f.itemId.endsWith('1') ? 'chip' : f.itemId.endsWith('2') ? 'chipPack' : undefined
    if (!kind) continue

    const totalWeight = f.extraOutcomeGroup.reduce((a, x) => a + x.weight, 0)
    const byproducts: Record<string, number> = {}
    if (totalWeight > 0) {
      for (const x of f.extraOutcomeGroup) {
        byproducts[x.itemId] = (byproducts[x.itemId] || 0) + (x.weight / totalWeight) * x.itemCount
      }
    }
    formulas.push({
      id: `workshop-${f.formulaId}`,
      kind,
      itemId: f.itemId,
      quantity: f.count,
      costs: costsOf(f.costs, f.goldCost),
      byproductRate: totalWeight > 0 ? f.extraOutcomeRate : 0,
      byproducts,
    })
  }
  for (const f of Object.values(raw.exBuilding.manufactFormulas)) {
    if (f.formulaType !== 'F_ASC') continue
    formulas.push({
      id: `manufact-${f.formulaId}`,
      kind: 'dualChip',
      itemId: f.itemId,
      quantity: f.count,
      costs: costsOf(f.costs, 0),
      byproductRate: 0,
      byproducts: {},
    })
  }
  formulas.push({
    id: 'shop-32001',
    kind: 'shop',
    itemId: '32001',
    quantity: 1,
    costs: { '4006': 90 },
    byproductRate: 0,
    byproducts: {},
  })

  const uda = ga.getUserDataAdapter()
  const empty = uda.getFrozenEmptyCharacterStatus()
  const demand: Record<string, number> = {}
  for (const id of uda.getAllCharacterIds()) {
    for (const task of uda.generateTasksForCharacter(id, empty, uda.finishedCharacterStatus(id, empty))) {
      for (const r of task.requires) demand[r.itemId] = (demand[r.itemId] || 0) + r.quantity
    }
  }

  const materialRarity: Record<string, number> = {}
  for (const f of Object.values(raw.exBuilding.workshopFormulas)) {
    if (f.formulaType !== 'F_EVOLVE') continue
    for (const itemId of [f.itemId, ...f.costs.map((x) => x.id)]) {
      const rarity = RARITY[raw.exItems.items[itemId]?.rarity]
      if (rarity != null) materialRarity[itemId] = rarity
    }
  }

  const expItems: Record<string, number> = {}
  for (const x of Object.values(raw.exItems.expItems)) expItems[x.id] = x.gainExp

  return {
    gameDataVersion: dm.get(dm.$kengxxiao).version.id,
    stages,
    fixedDrops,
    formulas,
    demand,
    expItems,
    materialRarity,
  }
}

function costsOf(costs: { id: string; count: number }[], gold: number) {
  const result: Record<string, number> = {}
  for (const x of costs) result[x.id] = (result[x.id] || 0) + x.count
  if (gold > 0) result[AK_ITEM_GOLD] = (result[AK_ITEM_GOLD] || 0) + gold
  return result
}

/** 按 getStageInfos() 的规则把掉落矩阵组装成关卡，再按配置过滤。 */
export function assembleItemValueStages(
  gameInputs: ItemValueGameInputs,
  matrix: readonly PenguinMatrixItem[],
  now: number,
  config: Pick<ItemValueConfig, 'stageScope' | 'excludedStageIds' | 'minSamples'>,
): ItemValueStage[] {
  const keys = new Set(matrix.map((x) => x.stageId))
  for (const stageId of keys) {
    if (stageId.endsWith('_rep')) keys.delete(stageId.slice(0, -4) + '_perm')
  }

  const assembled = new Map<string, { maxTimes: number; retro: boolean; drops: Map<string, [number, number]> }>()
  for (const row of matrix) {
    if (!keys.has(row.stageId)) continue
    if (row.start > now || (row.end && row.end < now)) continue
    if (row.stageId.startsWith('wk_armor_')) continue

    let stageId = row.stageId
    if (stageId.endsWith('_rep')) stageId = stageId.slice(0, -4)
    else if (stageId.endsWith('_perm')) stageId = stageId.slice(0, -5)
    if (!Object.hasOwn(gameInputs.stages, stageId)) continue

    let stage = assembled.get(stageId)
    if (!stage) {
      stage = { maxTimes: 0, retro: row.stageId.endsWith('_perm'), drops: new Map() }
      assembled.set(stageId, stage)
    }
    stage.maxTimes = Math.max(stage.maxTimes, row.times)
    const [quantity, times] = stage.drops.get(row.itemId) || [0, 0]
    stage.drops.set(row.itemId, [quantity + row.quantity, times + row.times])
  }

  const result = new Map<string, ItemValueStage & { maxTimes: number }>()
  for (const [stageId, stage] of assembled) {
    const info = gameInputs.stages[stageId]
    const ap = stage.retro ? (info.retroAp ?? info.ap) : info.ap
    if (!(ap > 0)) continue
    const drops: Record<string, number> = { [AK_ITEM_GOLD]: ap * 12 }
    for (const [itemId, [quantity, times]] of stage.drops) {
      drops[itemId] = (drops[itemId] || 0) + quantity / times
    }
    result.set(stageId, { id: stageId, ap, drops, maxTimes: stage.maxTimes })
  }
  for (const fixed of gameInputs.fixedDrops) {
    const ap = gameInputs.stages[fixed.stageId]?.ap
    if (ap == null) continue
    result.set(fixed.stageId, { id: fixed.stageId, ap, drops: { ...fixed.drops }, maxTimes: Infinity })
  }

  const excluded = new Set(config.excludedStageIds)
  const scopes: Record<StageScope, string[]> = {
    mainline: ['mainline'],
    permanent: ['mainline', 'permanent'],
    open: ['mainline', 'permanent', 'activity'],
  }
  return [...result.values()]
    .filter((x) => scopes[config.stageScope].includes(gameInputs.stages[x.id].scope))
    .filter((x) => !excluded.has(x.id))
    .filter((x) => x.maxTimes >= config.minSamples)
    .map(({ id, ap, drops }) => ({ id, ap, drops }))
}

export function computeItemValuesFromInputs(
  gameInputs: ItemValueGameInputs,
  matrix: readonly PenguinMatrixItem[],
  now: number,
  config: ItemValueConfig,
): ItemValueResult {
  const startedAt = performance.now()
  try {
    const stages = assembleItemValueStages(gameInputs, matrix, now, config)

    const formulas: ItemValueFormula[] = []
    const equalPairs = new Map<string, [string, string]>()
    for (const f of gameInputs.formulas) {
      let equality = false
      if (f.kind === 'chip' || f.kind === 'chipPack') {
        const target = chipProfession(f.itemId)
        const sources = Object.keys(f.costs)
        const pair = (Object.keys(CHIP_PAIRS) as ChipPair[]).find((x) =>
          (CHIP_PAIRS[x] as readonly string[]).includes(target!),
        )
        if (!pair || sources.length !== 1) continue
        const conversion = config.chipConversion[pair]
        if (conversion === 'split') {
          const ids = [f.itemId, sources[0]].sort() as [string, string]
          equalPairs.set(ids.join(':'), ids)
          continue
        }
        if (conversion !== target) continue
        equality = true
      }

      const outputs: Record<string, number> = { [f.itemId]: f.quantity }
      if (f.byproductRate > 0) {
        const boost = (config.byproductBoost as Record<string, number>)[f.kind] ?? 0
        const rate = Math.min(1, f.byproductRate * (1 + boost))
        for (const [itemId, q] of Object.entries(f.byproducts)) {
          outputs[itemId] = (outputs[itemId] || 0) + rate * q
        }
      }
      formulas.push({ id: f.id, itemId: f.itemId, outputs, costs: f.costs, equality })
    }

    const ce6Lmd = gameInputs.fixedDrops.find((x) => x.stageId === 'wk_melee_6')?.drops[AK_ITEM_GOLD]
    const ce6Ap = gameInputs.stages['wk_melee_6']?.ap
    if (!ce6Lmd || !ce6Ap) throw new Error('CE-6 is missing from the game inputs')
    const sanityPerLmd = ce6Ap / ce6Lmd

    const fixed: Record<string, number> = {}
    fixed[AK_ITEM_GOLD] = config.lmdCoefficient * sanityPerLmd
    fixed[AK_ITEM_VIRTUAL_EXP] = config.expCoefficient * sanityPerLmd
    for (const [itemId, gainExp] of Object.entries(gameInputs.expItems)) {
      fixed[itemId] = gainExp * fixed[AK_ITEM_VIRTUAL_EXP]
    }
    Object.assign(fixed, config.fixedValues)

    const solution = solveItemValues({
      stages,
      formulas,
      equalPairs: [...equalPairs.values()],
      demand: applyMaterialDemandFloor(gameInputs),
      fixed,
    })
    if (solution.status !== 'ok') throw new Error(solution.reason)

    const values = new Map<string, number>(Object.entries(fixed))
    for (const [itemId, v] of solution.values) values.set(itemId, v)
    // cpp 以 1 源石 = 135 理智计价（见 Value.tsx）
    values.set('4002', 135)
    values.set('4003', 135 / 180)
    values.set('7003', (600 * 135) / 180)

    if (solution.droppedStages.length > 0) {
      console.warn('[itemValue] stages dropped because fixed-value output exceeds their sanity', solution.droppedStages)
    }
    return {
      status: 'ok',
      values,
      pricedCount: values.size,
      droppedStages: solution.droppedStages,
      elapsedMs: performance.now() - startedAt,
    }
  } catch (e) {
    console.error('[itemValue] failed to compute item values', e)
    return { status: 'error', reason: e instanceof Error ? e.message : String(e) }
  }
}

export function computeArknightsItemValues(ga: ArknightsAdapter, config: ItemValueConfig): ItemValueResult {
  let gameInputs: ItemValueGameInputs
  try {
    gameInputs = ga.exportItemValueGameInputs()
  } catch (e) {
    console.error('[itemValue] failed to export game inputs', e)
    return { status: 'error', reason: e instanceof Error ? e.message : String(e) }
  }
  return computeItemValuesFromInputs(gameInputs, ga.getDataManager().raw.penguinMatrix.matrix, Date.now(), config)
}

/** 开发用：在控制台比较本模块组装的关卡与 getStageInfos()，返回差异；为空即一致。 */
export function checkStageAssembly(ga: ArknightsAdapter): string[] {
  const ours = assembleItemValueStages(
    exportItemValueGameInputs(ga),
    ga.getDataManager().raw.penguinMatrix.matrix,
    Date.now(),
    { stageScope: 'open', excludedStageIds: [], minSamples: 0 },
  )
  const theirs = ga.getStageInfos()
  const diffs: string[] = []
  const oursById = new Map(ours.map((x) => [x.id, x]))
  for (const id of Object.keys(theirs)) if (!oursById.has(id)) diffs.push(`${id}: missing here`)
  for (const stage of ours) {
    const other = theirs[stage.id]
    if (!other) {
      // getStageInfos() 不收录只掉落未知物品的关卡；这样的关卡在这里不影响任何价值
      if (Object.keys(stage.drops).some((x) => x !== AK_ITEM_GOLD && !!ga.getItem(x))) {
        diffs.push(`${stage.id}: missing in getStageInfos()`)
      }
      continue
    }
    if (other.ap !== stage.ap) diffs.push(`${stage.id}: ap ${stage.ap} vs ${other.ap}`)
    const otherDrops = new Map(
      Object.entries(other.dropInfo).map(([itemId, [drops, samples]]) => [
        itemId,
        Number.isFinite(samples) ? drops / samples : drops,
      ]),
    )
    // getStageInfos() 跳过当前区服数据里没有的物品；它们在这里价值为 0，不算差异
    const itemIds = new Set([...otherDrops.keys(), ...Object.keys(stage.drops).filter((x) => !!ga.getItem(x))])
    for (const itemId of itemIds) {
      const a = stage.drops[itemId] ?? 0
      const b = otherDrops.get(itemId) ?? 0
      if (Math.abs(a - b) >= 1e-12) diffs.push(`${stage.id}: ${itemId} ${a} vs ${b}`)
    }
  }
  return diffs
}
