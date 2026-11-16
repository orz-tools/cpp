import type { IStageCategory, IStageInfo, IZoneInfo } from '../pkg/cpp-basic'
import { makeNumericSortable } from '../pkg/cpp-basic/sort'
import { gt } from '../pkg/gt'

const OTHER = 'other'

export interface StageZoneGroup {
  zone: IZoneInfo
  stageIds: string[]
}

export interface StageCategoryGroup {
  category: IStageCategory
  zones: StageZoneGroup[]
}

function compareBy<T>(key: (x: T) => string) {
  return (a: T, b: T) => {
    const ka = key(a)
    const kb = key(b)
    return ka < kb ? -1 : ka > kb ? 1 : 0
  }
}

export function groupStages(
  stageIds: string[],
  stageInfos: Record<string, IStageInfo>,
  zoneInfos: Record<string, IZoneInfo>,
  categories: IStageCategory[],
  query: string,
): StageCategoryGroup[] {
  const allCategories = categories.some((x) => x.id === OTHER)
    ? categories
    : [...categories, { id: OTHER, name: gt.pgettext('stage category', '其他') }]
  const knownCategories = new Set(allCategories.map((x) => x.id))

  const q = query.trim().toLowerCase()
  const matches = (stage: IStageInfo) =>
    !q || stage.code.toLowerCase().includes(q) || stage.name.toLowerCase().includes(q)

  const zones = new Map<string, StageZoneGroup>()
  for (const stageId of stageIds) {
    const stage = stageInfos[stageId]
    if (!stage || !matches(stage)) continue
    let group = zones.get(stage.zoneId)
    if (!group) {
      const zone: IZoneInfo = zoneInfos[stage.zoneId] || {
        id: stage.zoneId,
        name: stage.zoneId,
        categoryId: OTHER,
        sortKey: makeNumericSortable(stage.zoneId),
      }
      group = { zone, stageIds: [] }
      zones.set(stage.zoneId, group)
    }
    group.stageIds.push(stageId)
  }

  const byCategory = new Map<string, StageZoneGroup[]>()
  for (const group of zones.values()) {
    group.stageIds.sort(compareBy((x) => makeNumericSortable(stageInfos[x].sortKey)))
    const categoryId = knownCategories.has(group.zone.categoryId) ? group.zone.categoryId : OTHER
    const list = byCategory.get(categoryId) || []
    list.push(group)
    byCategory.set(categoryId, list)
  }

  return allCategories.flatMap((category) => {
    const list = byCategory.get(category.id)
    if (!list) return []
    list.sort(compareBy((x) => x.zone.sortKey))
    return [{ category, zones: list }]
  })
}
