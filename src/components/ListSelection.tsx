import { Button, Classes } from '@blueprintjs/core'
import React, { createContext, useEffect, useMemo, useState } from 'react'
import useEvent from 'react-use-event-hook'
import { gt } from '../pkg/gt'
import {
  EMPTY_SELECTION,
  SelectionState,
  clickHandled,
  clickKind,
  clickSelection,
  rangeKeys,
  sameScope,
  selectAllSelection,
  toggleSelection,
  visibleSelection,
} from './listSelection'

export interface ListSelection {
  /** 和列表现在的 keys 的交集 */
  selected: ReadonlySet<string>
  /** 列表里被选中的，按 keys 的先后；selected 不变时引用不变 */
  selectedKeys: readonly string[]
  /** keys 不为空，并且全选上了 */
  allSelected: boolean
  /** 有选中的就是选择模式：普通点击也是勾选，行不开档案 */
  selecting: boolean
  toggle: (key: string) => void
  clear: () => void
  selectAll: () => void
  /**
   * 开关档案的那一下用；返回 true 表示已经改了选择（按了修饰键，或在选择模式里），行不再开档案。
   * range 给出锚点到 key 的连选范围，不给时按 keys 的先后算
   */
  click: (e: React.MouseEvent, key: string, range?: (anchor: string) => readonly string[] | undefined) => boolean
  /** 按着 Shift 按下时 preventDefault，免得浏览器把两次点击之间的文字选上 */
  mouseDown: (e: React.MouseEvent) => void
}

/**
 * 列表能选的时候才提供；读不到时（档案里的菜单、不在「计划」视图）右键菜单和没有选择时一样。
 * 用 context 而不给菜单加 prop：菜单在行里构造，给行传选中集合，选择一变所有行都要重画
 */
export const ListSelectionContext = createContext<ListSelection | undefined>(undefined)

const NO_KEYS: readonly string[] = []

function inTextField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT' ||
    target.isContentEditable
  )
}

/**
 * 一个列表自己的选择，不进用户数据、不进撤销。scope 逐项按引用和上次的比，变了就清空：
 * 「计划」视图换视图、改搜索、改快捷过滤都换一个 queryParam 对象
 */
export function useListSelection(keys: readonly string[], scope?: readonly unknown[]): ListSelection {
  const [stored, setStored] = useState<{ scope?: readonly unknown[]; state: SelectionState }>(() => ({
    scope,
    state: EMPTY_SELECTION,
  }))
  // 渲染时就清掉，不等 effect：换了视图不闪一下旧的选择；面板的筛选设了又撤掉，scope 回到原来那几样时旧的选择也不回来
  const current = sameScope(stored.scope, scope)
  if (!current) setStored({ scope, state: EMPTY_SELECTION })
  const state = current ? stored.state : EMPTY_SELECTION

  const selected = useMemo(() => visibleSelection(state, keys), [state, keys])
  const selectedKeys = useMemo(
    () => (selected.size === 0 ? NO_KEYS : keys.filter((k) => selected.has(k))),
    [keys, selected],
  )
  const allSelected = keys.length > 0 && selected.size === keys.length

  const update = useEvent((f: (s: SelectionState) => SelectionState) =>
    setStored((x) => {
      const prev = sameScope(x.scope, scope) ? x.state : EMPTY_SELECTION
      const next = f(prev)
      return next === prev && x.state === prev ? x : { scope, state: next }
    }),
  )

  const toggle = useEvent((key: string) => update((s) => toggleSelection(s, key)))
  const clear = useEvent(() => update((s) => (s.keys.size === 0 ? s : EMPTY_SELECTION)))
  const selectAll = useEvent(() => update((s) => selectAllSelection(s, keys)))

  // 按渲染时看得到的选中判断：从列表里消失的不算，列表里一个勾都没有时点行照旧开档案
  const selecting = selected.size > 0

  const click = useEvent<ListSelection['click']>((e, key, range) => {
    const kind = clickKind(e)
    const extent = range ?? ((a: string) => rangeKeys(keys, a, key))
    update((s) => clickSelection(s, kind, key, selecting, extent))
    const handled = clickHandled(kind, selecting)
    if (handled) e.preventDefault()
    return handled
  })

  const mouseDown = useEvent((e: React.MouseEvent) => {
    if (e.shiftKey) e.preventDefault()
  })

  useEffect(() => {
    if (!selecting) return
    // 冒泡阶段：拖动中的 Esc 已经在捕获阶段被拖动吞掉，档案、弹窗、菜单自己的 Esc 在浮层里
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || inTextField(e.target)) return
      if (e.target instanceof Element && e.target.closest(`.${Classes.PORTAL}`)) return
      clear()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selecting, clear])

  return useMemo(
    () => ({ selected, selectedKeys, allSelected, selecting, toggle, clear, selectAll, click, mouseDown }),
    [selected, selectedKeys, allSelected, selecting, toggle, clear, selectAll, click, mouseDown],
  )
}

/** 干员那一行的拖动把手的提示：点它和 Ctrl 点一样，选上或取消 */
export function handleTitle(selected: ReadonlySet<string>, key: string): string {
  if (!selected.has(key)) return gt.gettext('拖动：调整顺序 · 点击：选中')
  return gt
    .ngettext(
      '拖动：%d 名一起移动 · 点击：取消选中',
      '拖动：%d 名一起移动 · 点击：取消选中',
      selected.size,
    ) /* I10N: %d: number */
    .replaceAll('%d', selected.size.toString())
}

/**
 * 列表（Menu）下面的一条，跟着列走而不浮在行上：有选择时列表矮这么一条。
 * children 是列表放进来的、对选中的干员做的事，排在人数后面；选择本身不知道计划这回事
 */
export function SelectionBar({
  count,
  compact,
  allSelected,
  onSelectAll,
  onClear,
  children,
}: {
  count: number
  /** 只画图标：任务列表那一栏和手机都放不下四个带文字的按钮 */
  compact?: boolean
  allSelected: boolean
  onSelectAll: () => void
  onClear: () => void
  children?: React.ReactNode
}) {
  if (count === 0) return null
  const [before, after] = gt
    .ngettext('已选 %d 名干员', '已选 %d 名干员', count) /* I10N: %d: number */
    .split('%d')
  const selectAllText = gt.gettext('全选')
  const clearText = gt.gettext('清除选择')
  return (
    <div className="cpp-selection-bar">
      <span className="cpp-selection-bar-count">
        {before}
        <b>{count}</b>
        {after}
      </span>
      {children}
      <div className="cpp-selection-bar-end">
        <Button
          variant="minimal"
          size="small"
          icon={compact ? 'multi-select' : undefined}
          text={compact ? undefined : selectAllText}
          aria-label={compact ? selectAllText : undefined}
          title={compact ? selectAllText : undefined}
          disabled={allSelected}
          onClick={onSelectAll}
        />
        <Button
          variant="minimal"
          size="small"
          icon={compact ? 'cross-circle' : undefined}
          text={compact ? undefined : clearText}
          aria-label={compact ? clearText : undefined}
          title={compact ? clearText : undefined}
          onClick={onClear}
        />
      </div>
    </div>
  )
}
