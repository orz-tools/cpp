import { Button, Classes } from '@blueprintjs/core'
import React, { createContext, useEffect, useMemo, useState } from 'react'
import useEvent from 'react-use-event-hook'
import { gt } from '../pkg/gt'
import {
  EMPTY_SELECTION,
  SelectionState,
  clickKind,
  extendSelection,
  plainSelection,
  rangeKeys,
  sameScope,
  toggleSelection,
  visibleSelection,
} from './listSelection'

export interface ListSelection {
  /** 和列表现在的 keys 的交集 */
  selected: ReadonlySet<string>
  toggle(key: string): void
  clear(): void
  /**
   * 开关档案的那一下用；返回 true 表示按了修饰键、已经处理，行不再开档案。
   * range 给出锚点到 key 的连选范围，不给时按 keys 的先后算
   */
  click(e: React.MouseEvent, key: string, range?: (anchor: string) => readonly string[] | undefined): boolean
  /** 按着 Shift 按下时 preventDefault，免得浏览器把两次点击之间的文字选上 */
  mouseDown(e: React.MouseEvent): void
}

/**
 * 列表能选的时候才提供；读不到时（档案里的菜单、不在「计划」视图）右键菜单和没有选择时一样。
 * 用 context 而不给菜单加 prop：菜单在行里构造，给行传选中集合，选择一变所有行都要重画
 */
export const ListSelectionContext = createContext<ListSelection | undefined>(undefined)

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

  const update = useEvent((f: (s: SelectionState) => SelectionState) =>
    setStored((x) => {
      const prev = sameScope(x.scope, scope) ? x.state : EMPTY_SELECTION
      const next = f(prev)
      return next === prev && x.state === prev ? x : { scope, state: next }
    }),
  )

  const toggle = useEvent((key: string) => update((s) => toggleSelection(s, key)))
  const clear = useEvent(() => update((s) => (s.keys.size === 0 ? s : EMPTY_SELECTION)))

  const click = useEvent<ListSelection['click']>((e, key, range) => {
    const kind = clickKind(e)
    if (kind === 'plain') {
      update((s) => (s.keys.size === 0 && s.anchor === key ? s : plainSelection(key)))
      return false
    }
    e.preventDefault()
    if (kind === 'toggle') {
      update((s) => toggleSelection(s, key))
      return true
    }
    update((s) => {
      const extent = s.anchor === undefined ? undefined : (range ?? ((a) => rangeKeys(keys, a, key)))(s.anchor)
      return extent ? extendSelection(s, extent) : toggleSelection(s, key)
    })
    return true
  })

  const mouseDown = useEvent((e: React.MouseEvent) => {
    if (e.shiftKey) e.preventDefault()
  })

  const any = selected.size > 0
  useEffect(() => {
    if (!any) return
    // 冒泡阶段：拖动中的 Esc 已经在捕获阶段被拖动吞掉，档案、弹窗、菜单自己的 Esc 在浮层里
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || inTextField(e.target)) return
      if (e.target instanceof Element && e.target.closest(`.${Classes.PORTAL}`)) return
      clear()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [any, clear])

  return useMemo(() => ({ selected, toggle, clear, click, mouseDown }), [selected, toggle, clear, click, mouseDown])
}

/** 列表（Menu）下面的一条，跟着列走而不浮在行上：有选择时列表矮这么一条 */
export function SelectionBar({ count, onClear }: { count: number; onClear: () => void }) {
  if (count === 0) return null
  const [before, after] = gt
    .ngettext('已选 %d 名干员', '已选 %d 名干员', count) /* I10N: %d: number */
    .split('%d')
  return (
    <div className="cpp-selection-bar">
      <span className={Classes.FILL}>
        {before}
        <b>{count}</b>
        {after}
      </span>
      <Button variant="minimal" size="small" text={gt.gettext('清除选择')} onClick={onClear} />
    </div>
  )
}
