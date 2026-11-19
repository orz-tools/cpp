/** anchor 是最近一次点的那一项，Shift 连选从它算起 */
export interface SelectionState {
  keys: ReadonlySet<string>
  anchor?: string
}

export const EMPTY_SELECTION: SelectionState = { keys: new Set() }

export type ClickKind = 'plain' | 'toggle' | 'extend'

export function clickKind(e: Pick<MouseEvent, 'shiftKey' | 'ctrlKey' | 'metaKey'>): ClickKind {
  if (e.shiftKey) return 'extend'
  return e.ctrlKey || e.metaKey ? 'toggle' : 'plain'
}

export function toggleSelection(s: SelectionState, key: string): SelectionState {
  const keys = new Set(s.keys)
  if (!keys.delete(key)) keys.add(key)
  return { keys, anchor: key }
}

/** 锚点不动：接着 Shift 点别处仍从它算 */
export function extendSelection(s: SelectionState, range: readonly string[]): SelectionState {
  return { keys: new Set([...s.keys, ...range]), anchor: s.anchor }
}

/** 锚点不动；keys 已经全在里面时返回 s 本身，免得白白重画 */
export function selectAllSelection(s: SelectionState, keys: readonly string[]): SelectionState {
  if (keys.every((key) => s.keys.has(key))) return s
  return { keys: new Set([...s.keys, ...keys]), anchor: s.anchor }
}

/** 普通点击是「只要这一个」：清掉选择，但记下锚点，接着 Shift 点另一项选上这两项之间的一段 */
export function plainSelection(key: string): SelectionState {
  return { keys: EMPTY_SELECTION.keys, anchor: key }
}

/**
 * 有选中的就是选择模式：普通点击也是勾选，不然选上第一名后顺手点下一名会开档案、把刚选的清掉。
 * 只有不在模式里的普通点击留给行开关档案
 */
export function clickHandled(kind: ClickKind, selecting: boolean): boolean {
  return kind !== 'plain' || selecting
}

/** 这一下点击之后的选择。extent 给出锚点到 key 的连选范围，给不出时按勾选算 */
export function clickSelection(
  s: SelectionState,
  kind: ClickKind,
  key: string,
  selecting: boolean,
  extent: (anchor: string) => readonly string[] | undefined,
): SelectionState {
  if (kind === 'plain' && !selecting) return s.keys.size === 0 && s.anchor === key ? s : plainSelection(key)
  if (kind === 'extend' && s.anchor !== undefined) {
    const range = extent(s.anchor)
    if (range) return extendSelection(s, range)
  }
  return toggleSelection(s, key)
}

export function rangeKeys(keys: readonly string[], anchor: string, key: string): readonly string[] | undefined {
  const from = keys.indexOf(anchor)
  const to = keys.indexOf(key)
  if (from < 0 || to < 0) return undefined
  return from <= to ? keys.slice(from, to + 1) : keys.slice(to, from + 1)
}

/** 从列表里消失的不算选中。没有去掉的项时返回 s.keys 本身，行的 memo 才不白重画 */
export function visibleSelection(s: SelectionState, keys: readonly string[]): ReadonlySet<string> {
  if (s.keys.size === 0) return s.keys
  const present = new Set(keys)
  const visible = [...s.keys].filter((key) => present.has(key))
  return visible.length === s.keys.size ? s.keys : new Set(visible)
}

/** 和 hook 的依赖数组一样逐项按引用比 */
export function sameScope(a: readonly unknown[] | undefined, b: readonly unknown[] | undefined): boolean {
  if (a === undefined || b === undefined) return a === b
  return a.length === b.length && a.every((x, i) => Object.is(x, b[i]))
}
