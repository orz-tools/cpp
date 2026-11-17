import type { IStageInfo } from '../cpp-basic/types'
import { makeNumericSortable } from '../cpp-basic/sort'
import { AK_ITEM_GOLD } from './types'

export interface StageEfficiencyInput {
  stages: Readonly<Record<string, IStageInfo>>
  valueOf: (itemId: string) => number | undefined
  /** 作战记录：不当作主产物，没有别的候选时归「作战记录」组 */
  isRecord: (itemId: string) => boolean
  minSamples: number
}

export interface StageDrop {
  itemId: string
  /** 每次的期望数量：有样本时是 drops ÷ samples，手写掉落时就是 drops */
  quantity: number
  /** quantity × 物品价值；没有价值时为 0 */
  value: number
}

export interface StageEfficiency {
  stageId: string
  /** 效率相同时按它排 */
  sortKey: string
  /** 每次掉落价值 */
  value: number
  /** value ÷ 理智；理智不大于 0 时为 undefined */
  efficiency: number | undefined
  /** 各项掉落样本数的最大值；手写掉落的关卡为 undefined */
  samples: number | undefined
  lowSample: boolean
  /** 计入最高效率和前三关：样本足够，并且有效率 */
  ranked: boolean
  /** 按 value 从高到低，value 相同时按物品 id */
  drops: StageDrop[]
  /** 大窗口「主要掉落」列：候选里价值最高的三项；没有候选时，所有 value > 0 的掉落里最高的三项 */
  topDrops: StageDrop[]
  /** 按章节时每行显示的主要掉落；undefined 表示没有一项有价值 */
  mainDrop: string | undefined
  /** 所属的「按材料」组，组用物品 id 表示 */
  groups: string[]
}

/** 「作战记录」组借用高级作战记录的 id 和图标，界面上另取名字 */
export const RECORDS_GROUP = '2004'

/** 价值不低于最高候选这个比例的候选也是主产物，意思是「并列」 */
const TIE_RATIO = 0.9

/** 同一系列的一到四级精英材料归到这一系列的三级材料下 */
export function eliteSeries(itemId: string): string {
  return /^3[01]\d\d[1-4]$/.test(itemId) ? itemId.slice(0, 4) + '3' : itemId
}

// 按显示的一位小数比较：LP 算出的各个常驻最优关都在 100% 附近，彼此只差舍入误差，应该按关卡或仓库的顺序排，而不是按误差排
const shown = (efficiency: number | undefined) => (efficiency === undefined ? -Infinity : Math.round(efficiency * 1000))

const compareStrings = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

export function computeStageEfficiencies(input: StageEfficiencyInput): Map<string, StageEfficiency> {
  const { stages, valueOf, isRecord, minSamples } = input
  const result = new Map<string, StageEfficiency>()
  for (const stage of Object.values(stages)) {
    let samples: number | undefined
    const drops: StageDrop[] = []
    for (const [itemId, [count, times]] of Object.entries(stage.dropInfo)) {
      const finite = Number.isFinite(times)
      if (finite) samples = Math.max(samples ?? -Infinity, times)
      const quantity = finite ? count / times : count
      const unit = valueOf(itemId)
      drops.push({ itemId, quantity, value: unit != null && Number.isFinite(unit) ? quantity * unit : 0 })
    }
    drops.sort((a, b) => b.value - a.value || compareStrings(a.itemId, b.itemId))
    const value = drops.reduce((sum, x) => sum + x.value, 0)
    const efficiency = stage.ap > 0 ? value / stage.ap : undefined
    const lowSample = samples !== undefined && samples < minSamples

    const candidates = drops.filter((x) => x.value > 0 && x.itemId !== AK_ITEM_GOLD && !isRecord(x.itemId))
    let mainDrop: string | undefined
    let groups: string[] = []
    if (candidates.length > 0) {
      mainDrop = candidates[0].itemId
      const floor = candidates[0].value * TIE_RATIO
      groups = [...new Set(candidates.filter((x) => x.value >= floor).map((x) => eliteSeries(x.itemId)))]
    } else {
      let gold = 0
      let records = 0
      for (const x of drops) {
        if (x.itemId === AK_ITEM_GOLD) gold += x.value
        else if (isRecord(x.itemId)) records += x.value
      }
      if (gold > 0 || records > 0) {
        mainDrop = records >= gold ? RECORDS_GROUP : AK_ITEM_GOLD
        groups = [mainDrop]
      }
    }

    result.set(stage.id, {
      stageId: stage.id,
      sortKey: makeNumericSortable(stage.sortKey),
      value,
      efficiency,
      samples,
      lowSample,
      ranked: !lowSample && efficiency !== undefined,
      drops,
      topDrops: (candidates.length > 0 ? candidates : drops.filter((x) => x.value > 0)).slice(0, 3),
      mainDrop,
      groups,
    })
  }
  return result
}

export interface MaterialGroup {
  itemId: string
  /** ranked 的关卡在前，其余在后；两部分各自按效率从高到低，效率相同时按 sortKey */
  stageIds: string[]
  /** ranked 的关卡里的最高效率；一关都没有时为 undefined */
  best: number | undefined
}

/** 组的先后由 arrangeMaterialGroups 决定 */
export function groupByMaterial(efficiencies: ReadonlyMap<string, StageEfficiency>): MaterialGroup[] {
  const members = new Map<string, StageEfficiency[]>()
  for (const e of efficiencies.values()) {
    for (const g of e.groups) {
      const list = members.get(g)
      if (list) list.push(e)
      else members.set(g, [e])
    }
  }

  const groups: MaterialGroup[] = []
  for (const [itemId, list] of members) {
    list.sort(
      (a, b) =>
        Number(b.ranked) - Number(a.ranked) ||
        shown(b.efficiency) - shown(a.efficiency) ||
        compareStrings(a.sortKey, b.sortKey),
    )
    let best: number | undefined
    for (const x of list) if (x.ranked && (best === undefined || x.efficiency! > best)) best = x.efficiency
    groups.push({ itemId, stageIds: list.map((x) => x.stageId), best })
  }
  return groups
}

/** 最高效率超过 100%：只有不参与定价的关卡能超过，实际上就是开放中的活动关比常驻关划算 */
const isUpGroup = (group: MaterialGroup) => shown(group.best) > 1000

export interface ArrangedSection<S> {
  section: S | 'up'
  groups: MaterialGroup[]
}

/**
 * up 的组单独一段排在最前，按最高效率从高到低；其余按 sectionOf 分到 sections 的各段，段内按 depotKeyOf（物品分类、仓库顺序）。
 * 没有组的段不出现。
 */
export function arrangeMaterialGroups<S>(
  groups: readonly MaterialGroup[],
  sections: readonly S[],
  sectionOf: (itemId: string) => S,
  depotKeyOf: (itemId: string) => string,
): ArrangedSection<S>[] {
  const byDepot = (a: MaterialGroup, b: MaterialGroup) => compareStrings(depotKeyOf(a.itemId), depotKeyOf(b.itemId))
  const up = groups.filter(isUpGroup).sort((a, b) => shown(b.best) - shown(a.best) || byDepot(a, b))
  const rest = groups.filter((g) => !isUpGroup(g)).sort(byDepot)
  return [
    { section: 'up' as const, groups: up },
    ...sections.map((section) => ({ section, groups: rest.filter((g) => sectionOf(g.itemId) === section) })),
  ].filter((x) => x.groups.length > 0)
}
