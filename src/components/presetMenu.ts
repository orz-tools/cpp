import { PredefinedQuery, PredefinedQueryGroup, PredefinedQuerySegment } from '../pkg/cpp-basic'

export interface PresetMenuRow {
  key: string
  preset: PredefinedQuery
  segments: PredefinedQuerySegment[]
}

export interface PresetMenuGroup {
  group: PredefinedQueryGroup
  rows: PresetMenuRow[]
}

/** 「更多视图」菜单里游戏预设的部分：组按 groups 的顺序，组内按 presets 的键序 */
export function presetMenu(
  groups: readonly PredefinedQueryGroup[],
  presets: Readonly<Record<string, PredefinedQuery>>,
): PresetMenuGroup[] {
  // 作为别的预设某一段出现的，不再单独占一行
  const segmentKeys = new Set(Object.values(presets).flatMap((x) => (x.segments ?? []).map((s) => s.key)))
  const rows: PresetMenuRow[] = Object.entries(presets)
    .filter(([key]) => !segmentKeys.has(key))
    .map(([key, preset]) => ({
      key,
      preset,
      segments: (preset.segments ?? []).filter((s) => Object.hasOwn(presets, s.key)),
    }))
  return groups.flatMap((group) => {
    const inGroup = rows.filter((x) => x.preset.group === group.id)
    return inGroup.length > 0 ? [{ group, rows: inGroup }] : []
  })
}

/** 预设所在那一行的 key：一行的各段是同一个视图的几版，按行存的东西（如列宽）各段共用 */
export function presetRowKey(presets: Readonly<Record<string, PredefinedQuery>>, key: string): string {
  for (const [k, preset] of Object.entries(presets)) {
    if (preset.segments?.some((s) => s.key === key)) return k
  }
  return key
}
