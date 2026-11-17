import { atom, useAtom } from 'jotai'
import { useCallback, useMemo, useState } from 'react'
import { useCpp, useGameAdapter, useGameDataMemo } from '../../Cpp'
import type { IStageCategory, IStageInfo, IZoneInfo } from '../../pkg/cpp-basic'
import { Arknights, ArknightsAdapter } from '../../pkg/cpp-arknights'
import {
  MaterialGroup,
  RECORDS_GROUP,
  StageEfficiency,
  computeStageEfficiencies,
  groupByMaterial,
} from '../../pkg/cpp-arknights/stageEfficiency'
import { ArknightsStageCategory } from '../../pkg/cpp-arknights/zones'
import { gt } from '../../pkg/gt'
import type { StageToggleProps } from '../ConfigUi'
import { groupStages } from '../stageGroups'

export type StageView = 'chapter' | 'material'
export const stageViewAtom = atom<StageView>('chapter')
/** null 是「全部」 */
export const stageCategoryFilterAtom = atom<string | null>(null)
/** 进入的材料（组的物品 id） */
export const stageMaterialAtom = atom<string | null>(null)
/** 用户点过的章节；没点过的章节，活动类展开，其余折叠 */
export const stageZoneOpenAtom = atom<Readonly<Record<string, boolean>>>({})

export type MaterialSection = 'material' | 'chip' | 'other'
export const MATERIAL_SECTIONS: MaterialSection[] = ['material', 'chip', 'other']

export interface StageModel {
  stages: Record<string, IStageInfo>
  zones: Record<string, IZoneInfo>
  /** 活动排第一，其余按 getStageCategories() 的顺序 */
  categories: IStageCategory[]
  valuesOk: boolean
  efficiencies: Map<string, StageEfficiency>
  /** 按最高效率排序 */
  groups: MaterialGroup[]
  /** 章节里计入排名的关卡的最高效率 */
  zoneBest: Map<string, number>
  sectionOf: (itemId: string) => MaterialSection
  /** 大窗口材料格的顺序 */
  depotOrder: string[]
}

function sectionOfCategory(category: string): MaterialSection {
  if (['1', '2', '3', '4', '5'].includes(category)) return 'material'
  if (['81', '82', '83'].includes(category)) return 'chip'
  return 'other'
}

function buildStageModel(ga: ArknightsAdapter): StageModel {
  const stages = ga.getStageInfos()
  const valuesOk = ga.getItemValues().status === 'ok'
  const efficiencies = computeStageEfficiencies({
    stages,
    valueOf: (id) => (valuesOk ? ga.getItem(id)?.valueAsAp : undefined),
    isRecord: (id) => ga.getExpItemValue(id) != null,
    minSamples: ga.getItemValueConfig().minSamples,
  })
  const sortIdOf = (id: string) => ga.getItem(id)?.sortId ?? id
  const groups = groupByMaterial(efficiencies, sortIdOf)

  const zoneBest = new Map<string, number>()
  for (const e of efficiencies.values()) {
    if (!e.ranked) continue
    const zoneId = stages[e.stageId].zoneId
    const best = zoneBest.get(zoneId)
    if (best === undefined || e.efficiency! > best) zoneBest.set(zoneId, e.efficiency!)
  }

  const categoryOf = (id: string) => ga.getItem(id)?.inventoryCategory ?? ''
  const sectionOf = (id: string) => sectionOfCategory(categoryOf(id))
  const depotKey = (id: string) => [MATERIAL_SECTIONS.indexOf(sectionOf(id)), categoryOf(id), sortIdOf(id)].join(' ')
  const depotOrder = groups
    .map((g) => [depotKey(g.itemId), g.itemId] as const)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([, id]) => id)

  const all = ga.getStageCategories()
  const categories = [
    ...all.filter((x) => x.id === ArknightsStageCategory.Activity),
    ...all.filter((x) => x.id !== ArknightsStageCategory.Activity),
  ]

  return {
    stages,
    zones: ga.getZoneInfos(),
    categories,
    valuesOk,
    efficiencies,
    groups,
    zoneBest,
    sectionOf,
    depotOrder,
  }
}

export function useStageModel(): StageModel {
  const ga = useGameAdapter<Arknights>() as ArknightsAdapter
  return useGameDataMemo(() => buildStageModel(ga), [ga])
}

export function useStageToggle(): StageToggleProps & { enabled: number; total: number } {
  const cpp = useCpp()
  const ga = useGameAdapter()
  const [forbidden, setForbidden] = useAtom(cpp.preferenceAtoms.forbiddenStageIdsAtom)
  const forbiddenSet = useMemo(() => new Set(forbidden), [forbidden])
  const isChecked = useCallback((stageId: string) => !forbiddenSet.has(stageId), [forbiddenSet])
  const onSetChecked = useCallback(
    (stageIds: string[], checked: boolean) =>
      setForbidden((list) => {
        const ids = new Set(stageIds)
        if (checked) return list.filter((x) => !ids.has(x))
        const had = new Set(list)
        return [...list, ...stageIds.filter((x) => !had.has(x))]
      }),
    [setForbidden],
  )
  // 已经不存在的关卡留在禁用列表里，但只数现有的关卡
  const stageIds = Object.keys(ga.getStageInfos())
  const enabled = stageIds.filter(isChecked).length
  return { isChecked, onSetChecked, enabled, total: stageIds.length }
}

export interface StageNavigation {
  view: StageView
  setView: (view: StageView) => void
  /** 进入的材料；它在新数据里没有组了就是 undefined，回到总览，但 atom 留着，这种材料再出现时回到它 */
  drill: MaterialGroup | undefined
  openMaterial: (itemId: string) => void
  closeMaterial: () => void
  /** 搜索框要搜的东西：按章节、按材料的总览、进入的某种材料 */
  scope: string
}

export function useStageNavigation(model: StageModel): StageNavigation {
  const [view, setView] = useAtom(stageViewAtom)
  const [material, setMaterial] = useAtom(stageMaterialAtom)
  const drill = view === 'material' && material ? model.groups.find((g) => g.itemId === material) : undefined
  const openMaterial = useCallback((itemId: string) => setMaterial(itemId), [setMaterial])
  const closeMaterial = useCallback(() => setMaterial(null), [setMaterial])
  const scope = view === 'chapter' ? 'chapter' : drill ? 'material:' + drill.itemId : 'material'
  return { view, setView, drill, openMaterial, closeMaterial, scope }
}

/** 搜索框的文字，scope 一变就清空：切换看法、进入或退出一种材料以后，要搜的东西变了 */
export function useScopedQuery(scope: string): [string, (text: string) => void] {
  const [state, setState] = useState({ scope, text: '' })
  if (state.scope !== scope) setState({ scope, text: '' })
  const setText = useCallback((text: string) => setState({ scope, text }), [scope])
  return [state.scope === scope ? state.text : '', setText]
}

/** 有关卡的类别，按 model.categories 的顺序 */
export function useChapterCategories(model: StageModel): IStageCategory[] {
  return useMemo(
    () =>
      groupStages(Object.keys(model.stages), model.stages, model.zones, model.categories, '').map((x) => x.category),
    [model],
  )
}

/** 面板里的类别筛选：六个类别要排进 300px 宽的一行，英文的「Main Story」「Side Stories」也放不下 */
export function categoryLabel(category: IStageCategory) {
  switch (category.id) {
    case ArknightsStageCategory.Main:
      return gt.pgettext('arknights stage category short', '主线')
    case ArknightsStageCategory.Sidestory:
      return gt.pgettext('arknights stage category short', '别传')
    case ArknightsStageCategory.Resource:
      return gt.pgettext('arknights stage category short', '资源')
    default:
      return category.name
  }
}

export function materialName(ga: { getItem(id: string): { name: string } }, itemId: string) {
  return itemId === RECORDS_GROUP ? gt.pgettext('stage panel', '作战记录') : ga.getItem(itemId).name
}

export function useMaterialFilter(model: StageModel, query: string): MaterialGroup[] {
  const ga = useGameAdapter()
  const q = query.trim().toLowerCase()
  if (!q) return model.groups
  return model.groups.filter((g) => materialName(ga, g.itemId).toLowerCase().includes(q))
}

export function matchesStage(stage: IStageInfo, query: string) {
  const q = query.trim().toLowerCase()
  return !q || stage.code.toLowerCase().includes(q) || stage.name.toLowerCase().includes(q)
}

/** 显示出来的千分数：比较大小、定颜色都按显示的一位小数 */
const permille = (efficiency: number) => Math.round(efficiency * 1000)

export function formatEfficiency(efficiency: number | undefined) {
  return efficiency === undefined ? '—' : (permille(efficiency) / 10).toFixed(1) + '%'
}

/** 大窗口材料格里取整的效率 */
export function formatEfficiencyShort(efficiency: number | undefined) {
  return efficiency === undefined ? '—' : Math.floor(permille(efficiency) / 10) + '%'
}

export function efficiencyTone(efficiency: number | undefined, lowSample = false): 'up' | 'low' | undefined {
  if (efficiency === undefined) return undefined
  if (lowSample || permille(efficiency) < 800) return 'low'
  if (permille(efficiency) > 1000) return 'up'
  return undefined
}
