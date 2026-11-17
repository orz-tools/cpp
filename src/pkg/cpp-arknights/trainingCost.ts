import stringify from 'json-stringify-deterministic'
import type { Character } from './DataManager'
import type { ArknightsUserDataAdapter } from './UserDataAdapter'
import type { ItemValueResult } from './itemValue'
import type { ArknightsCharacterStatus } from './types'

export interface CostBreakdown {
  /** 物品价值算不出来时是 NaN */
  value: number
  /** 物品 → 数量；升级的经验记在 AK_ITEM_VIRTUAL_EXP 下 */
  items: ReadonlyMap<string, number>
  /** 区间里有、没有价值的物品；按 0 算进了 value */
  unvalued: readonly string[]
}

/** 适配器上用到的那几个方法 */
export interface TrainingCostSource {
  getCharacter(key: string): Character
  getItem(key: string): { readonly valueAsAp: number | undefined } | undefined
  getItemValues(): ItemValueResult
  getUserDataAdapter(): ArknightsUserDataAdapter
}

/** 行是起点，列是终点：零、现在、目标、满两两之间 */
export type CostCellId = 'zeroNow' | 'zeroGoal' | 'zeroFull' | 'nowGoal' | 'nowFull' | 'goalFull'

export interface CostMatrix {
  owned: boolean
  planned: boolean
  /** 没持有时没有「现在」的格，没有计划时没有「目标」的格 */
  cells: Partial<Record<CostCellId, CostBreakdown>>
  /** 刻度的三段，加起来是从零到满 */
  track: {
    /** 已投入；没持有时没有 */
    invested?: CostBreakdown
    /** 还差；没有计划时没有 */
    remaining?: CostBreakdown
    /** 有计划时是计划之后，否则是拉满 */
    rest: CostBreakdown
  }
  defaultCell: CostCellId
}

export interface RarityRank {
  /** 同星级每一份能省的价值，从大到小 */
  values: readonly number[]
  /** 1 加上比自己大的个数 */
  rank: number
  count: number
}

export type RankKind = 'elite2' | 'mastery3'

// 一直改练度时键只增不减；到这个数就整个清掉，重算比逐条淘汰便宜
const BETWEEN_CACHE_LIMIT = 50000

const held = (status: ArknightsCharacterStatus) => status.level > 0

/**
 * 两个练度之间要多少材料、值多少，以及三种直升道具能省多少。数都是从能用道具的那一点算起：
 * 没持有的从零算，没精二的专三和满级直升从精二 1 级算。每次游戏数据提交后由适配器重建。
 */
export class TrainingCost {
  public readonly valuesOk: boolean
  private readonly between = new Map<string, CostBreakdown>()
  // store 里的练度对象没改就是同一个，空练度是同一个冻结对象，所以列表排序时反复读字段不用再序列化
  private readonly savings = new WeakMap<ArknightsCharacterStatus, Map<string, CostBreakdown | null>>()
  private readonly peers = new WeakMap<object, Map<string, number[]>>()

  public constructor(private readonly source: TrainingCostSource) {
    this.valuesOk = source.getItemValues().status === 'ok'
  }

  public costBetween(charId: string, from: ArknightsCharacterStatus, to: ArknightsCharacterStatus): CostBreakdown {
    const key = `${charId}\n${stringify(from)}\n${stringify(to)}`
    let result = this.between.get(key)
    if (!result) {
      if (this.between.size >= BETWEEN_CACHE_LIMIT) this.between.clear()
      result = this.computeBetween(charId, from, to)
      this.between.set(key, result)
    }
    return result
  }

  private computeBetween(charId: string, from: ArknightsCharacterStatus, to: ArknightsCharacterStatus): CostBreakdown {
    const items = new Map<string, number>()
    for (const task of this.source.getUserDataAdapter().generateTasksForCharacter(charId, from, to)) {
      for (const { itemId, quantity } of task.requires) {
        if (quantity > 0) items.set(itemId, (items.get(itemId) ?? 0) + quantity)
      }
    }
    if (!this.valuesOk) return { value: NaN, items, unvalued: [] }
    let value = 0
    const unvalued: string[] = []
    for (const [itemId, quantity] of items) {
      const v = this.source.getItem(itemId)?.valueAsAp
      if (v === undefined) unvalued.push(itemId)
      else value += v * quantity
    }
    return { value, items, unvalued }
  }

  /** 精零 1 级、技能 1 级；潜能用信物，不算材料，所以跟着现在的走 */
  private zero(current: ArknightsCharacterStatus): ArknightsCharacterStatus {
    return { elite: 0, level: 1, skillLevel: 1, skillMaster: {}, modLevel: {}, potentialRank: current.potentialRank }
  }

  private start(current: ArknightsCharacterStatus) {
    return held(current) ? current : this.zero(current)
  }

  private memo(current: ArknightsCharacterStatus, key: string, compute: () => CostBreakdown | null) {
    let byKey = this.savings.get(current)
    if (!byKey) this.savings.set(current, (byKey = new Map()))
    if (byKey.has(key)) return byKey.get(key) ?? null
    const result = compute()
    byKey.set(key, result)
    return result
  }

  /** 特训邀请函：起点到精二 1 级。1–3 星和已精二的没有 */
  public elite2Saving(character: Character, current: ArknightsCharacterStatus): CostBreakdown | null {
    return this.memo(current, `elite2:${character.key}`, () => {
      if (character.rarity < 3) return null
      const from = this.start(current)
      if (from.elite >= 2) return null
      return this.costBetween(character.key, from, { ...from, elite: 2, level: 1 })
    })
  }

  /** 技巧集：这个技能从起点的专精到专三，不含精二和技能升级的材料。1–3 星和这个技能已专三的没有 */
  public mastery3Saving(
    character: Character,
    current: ArknightsCharacterStatus,
    skillIndex: number,
  ): CostBreakdown | null {
    return this.memo(current, `mastery3:${character.key}:${skillIndex}`, () => {
      const skillId = character.skills[skillIndex]?.skillId
      if (character.rarity < 3 || !skillId) return null
      const start = this.start(current)
      if ((start.skillMaster[skillId] ?? 0) >= 3) return null
      const from = { ...start, elite: 2, level: start.elite === 2 ? start.level : 1, skillLevel: 7 }
      return this.costBetween(character.key, from, { ...from, skillMaster: { ...from.skillMaster, [skillId]: 3 } })
    })
  }

  /** 特训装置：精二的等级到满级，没精二的从精二 1 级算。1–3 星和已满级的没有 */
  public levelMaxSaving(character: Character, current: ArknightsCharacterStatus): CostBreakdown | null {
    return this.memo(current, `levelMax:${character.key}`, () => {
      if (character.rarity < 3) return null
      const start = this.start(current)
      const from = start.elite === 2 ? start : { ...start, elite: 2, level: 1 }
      const max = character.maxLevels[2]
      if (from.level >= max) return null
      return this.costBetween(character.key, from, { ...from, level: max })
    })
  }

  /** 从零到现在；没持有的没有 */
  public invested(character: Character, current: ArknightsCharacterStatus): CostBreakdown | null {
    return this.memo(current, `invested:${character.key}`, () =>
      held(current) ? this.costBetween(character.key, this.zero(current), current) : null,
    )
  }

  /** goal 是 undefined 表示没有计划 */
  public costMatrix(
    character: Character,
    current: ArknightsCharacterStatus,
    goal: ArknightsCharacterStatus | undefined,
  ): CostMatrix {
    const id = character.key
    const uda = this.source.getUserDataAdapter()
    const full = (status: ArknightsCharacterStatus) => uda.finishedCharacterStatus(id, status)
    const zero = this.zero(current)
    const owned = held(current)
    const cells: CostMatrix['cells'] = { zeroFull: this.costBetween(id, zero, full(zero)) }
    if (owned) {
      cells.zeroNow = this.costBetween(id, zero, current)
      cells.nowFull = this.costBetween(id, current, full(current))
    }
    if (goal) {
      cells.zeroGoal = this.costBetween(id, zero, goal)
      cells.goalFull = this.costBetween(id, goal, full(goal))
      if (owned) cells.nowGoal = this.costBetween(id, current, goal)
    }
    return {
      owned,
      planned: !!goal,
      cells,
      track: {
        invested: cells.zeroNow,
        remaining: goal ? (owned ? cells.nowGoal : cells.zeroGoal) : undefined,
        rest: (goal ? cells.goalFull : owned ? cells.nowFull : cells.zeroFull)!,
      },
      defaultCell: goal ? (owned ? 'nowGoal' : 'zeroGoal') : owned ? 'nowFull' : 'zeroFull',
    }
  }

  /**
   * 在同星级里排第几：每名干员（专三是每个技能）都从自己能用道具的那一点算起，只和还有可省的比。
   * currents 是 store 里的现在练度表，没有的干员按空练度算。
   */
  public rarityRank(
    kind: RankKind,
    character: Character,
    skillIndex: number | undefined,
    currents: Readonly<Record<string, ArknightsCharacterStatus | undefined>>,
  ): RarityRank | null {
    if (!this.valuesOk) return null
    const current = currents[character.key] ?? this.source.getUserDataAdapter().getFrozenEmptyCharacterStatus()
    const own =
      kind === 'elite2'
        ? this.elite2Saving(character, current)
        : this.mastery3Saving(character, current, skillIndex ?? 0)
    if (!own || own.items.size === 0) return null
    const values = this.peerValues(kind, character.rarity, currents)
    return { values, rank: 1 + values.filter((v) => v > own.value).length, count: values.length }
  }

  private peerValues(
    kind: RankKind,
    rarity: number,
    currents: Readonly<Record<string, ArknightsCharacterStatus | undefined>>,
  ): number[] {
    let byKind = this.peers.get(currents)
    if (!byKind) this.peers.set(currents, (byKind = new Map()))
    const key = `${kind}:${rarity}`
    let values = byKind.get(key)
    if (values) return values

    values = []
    const uda = this.source.getUserDataAdapter()
    const empty = uda.getFrozenEmptyCharacterStatus()
    const add = (saving: CostBreakdown | null) => {
      if (saving && saving.items.size > 0) values!.push(saving.value)
    }
    for (const id of uda.getAllCharacterIds()) {
      const character = this.source.getCharacter(id)
      if (!character || character.rarity !== rarity) continue
      const current = currents[id] ?? empty
      if (kind === 'elite2') add(this.elite2Saving(character, current))
      else character.skills.forEach((_, i) => add(this.mastery3Saving(character, current, i)))
    }
    values.sort((a, b) => b - a)
    byKind.set(key, values)
    return values
  }
}
