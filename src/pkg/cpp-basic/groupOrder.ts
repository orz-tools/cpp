/**
 * 一名干员的几组任务（Task.group）按什么先后生成：groupOrder 列出的在前，其余跟在后面、保持游戏的默认顺序。groupOrder 是
 * 用户存下的，列出的组可能已经练完或移出了计划，所以只排 defaults 里有的
 */
export function orderGroups(defaults: readonly string[], groupOrder: readonly string[] | undefined): readonly string[] {
  if (!groupOrder) return defaults
  const known = new Set(defaults)
  const listed = new Set(groupOrder.filter((x) => known.has(x)))
  return [...listed, ...defaults.filter((x) => !listed.has(x))]
}
