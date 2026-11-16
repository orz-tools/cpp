import { useSetAtom } from 'jotai'
import { memo, useMemo, useRef, useState } from 'react'
import useEvent from 'react-use-event-hook'
import { useCpp } from '../../Cpp'
import { QueryParam } from '../../pkg/cpp-basic'
import { gt } from '../../pkg/gt'
import { compileQuery, isCustomQuery, stringifyQuery } from '../characterQuery'
import { cleanQuery } from './VisualEditor'

export const minColumnWidth = 40
export const maxColumnWidth = 480
const keyboardStep = 8

export function clampColumnWidth(width: number) {
  return Math.min(maxColumnWidth, Math.max(minColumnWidth, Math.round(width)))
}

/**
 * 当前查询里改过的列宽。只有编辑中的自定义查询能改：改动写进查询，
 * 编辑器的草稿随之更新，保存后才进入过滤器。
 */
export function useColumnWidths(query: string) {
  const cpp = useCpp()
  const setParam = useSetAtom(cpp.queryParamAtom)
  const widths = useMemo((): Record<string, number> => {
    try {
      return compileQuery(query, cpp).widths ?? {}
    } catch {
      return {}
    }
  }, [cpp, query])

  const setWidth = useEvent((id: string, width: number | undefined) => {
    setParam((x) => {
      if (!isCustomQuery(x.query)) return x
      let q: QueryParam
      try {
        q = JSON.parse(x.query)
      } catch {
        return x
      }
      const next = { ...q.widths }
      if (width == null) delete next[id]
      else next[id] = width
      return { ...x, query: stringifyQuery(cleanQuery({ ...q, widths: next })) }
    })
  })

  return { widths, setWidth }
}

export interface ColumnHead {
  id: string
  label: string
  width: number
  defaultWidth: number
}

interface Props {
  columns: ColumnHead[]
  /** 量自列表第一行的两个状态格，列头靠它和各行对齐 */
  statusWidths: readonly number[]
  disabled: boolean
  /** 拖动中的宽度，只用于预览；松手或取消时传 undefined */
  onPreview: (id: string, width: number | undefined) => void
  /** undefined 表示恢复默认宽度 */
  onResize: (id: string, width: number | undefined) => void
}

/** 编辑过滤条件时列表上方的列头，附加列右边缘可拖动改宽度 */
export const ColumnHeader = memo(({ columns, statusWidths, disabled, onPreview, onResize }: Props) => {
  return (
    <li role="none" className="cpp-qe-colhead">
      <div className="cpp-qe-colhead-name">
        <span>{gt.pgettext('character list column', '干员')}</span>
      </div>
      {columns.map((c) => (
        <ColumnHeadCell key={c.id} column={c} disabled={disabled} onPreview={onPreview} onResize={onResize} />
      ))}
      <div className="cpp-qe-colhead-status" style={{ width: statusWidths[0] }}>
        <span>{gt.pgettext('character list column', '当前状态')}</span>
      </div>
      <div className="cpp-qe-colhead-status" style={{ width: statusWidths[1] }}>
        <span>{gt.pgettext('character list column', '目标状态')}</span>
      </div>
    </li>
  )
})

const ColumnHeadCell = memo(
  ({
    column,
    disabled,
    onPreview,
    onResize,
  }: {
    column: ColumnHead
    disabled: boolean
    onPreview: Props['onPreview']
    onResize: Props['onResize']
  }) => {
    const drag = useRef<{ startX: number; startWidth: number; width: number } | null>(null)
    const [dragging, setDragging] = useState<number | null>(null)

    const commit = (width: number) => onResize(column.id, width === column.defaultWidth ? undefined : width)

    const endDrag = (apply: boolean) => {
      const d = drag.current
      drag.current = null
      setDragging(null)
      if (!d) return
      onPreview(column.id, undefined)
      if (apply && d.width !== d.startWidth) commit(d.width)
    }

    const label = column.label
    const custom = column.width !== column.defaultWidth

    return (
      <div className={`cpp-qe-colhead-cell${custom ? ' cpp-qe-colhead-custom' : ''}`} style={{ width: column.width }}>
        <span title={label}>{dragging == null ? label : `${dragging} px`}</span>
        <div
          className={`cpp-qe-colhead-handle${dragging == null ? '' : ' cpp-qe-colhead-dragging'}`}
          role="separator"
          aria-orientation="vertical"
          aria-label={gt.pgettext('character list column', '「%s」的列宽').replace('%s', label)}
          aria-valuenow={column.width}
          aria-valuemin={minColumnWidth}
          aria-valuemax={maxColumnWidth}
          aria-disabled={disabled}
          tabIndex={disabled ? -1 : 0}
          title={
            disabled
              ? undefined
              : gt
                  .pgettext('character list column', '拖动调整列宽，双击恢复默认（%d px）')
                  .replace('%d', String(column.defaultWidth))
          }
          onPointerDown={(e) => {
            if (disabled || e.button !== 0) return
            e.preventDefault()
            e.currentTarget.setPointerCapture(e.pointerId)
            drag.current = { startX: e.clientX, startWidth: column.width, width: column.width }
            setDragging(column.width)
          }}
          onPointerMove={(e) => {
            const d = drag.current
            if (!d) return
            const width = clampColumnWidth(d.startWidth + e.clientX - d.startX)
            if (width === d.width) return
            d.width = width
            setDragging(width)
            onPreview(column.id, width)
          }}
          onPointerUp={() => endDrag(true)}
          onPointerCancel={() => endDrag(false)}
          onLostPointerCapture={() => endDrag(true)}
          onDoubleClick={() => {
            if (!disabled) onResize(column.id, undefined)
          }}
          onKeyDown={(e) => {
            if (disabled) return
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
              e.preventDefault()
              commit(clampColumnWidth(column.width + (e.key === 'ArrowLeft' ? -keyboardStep : keyboardStep)))
            } else if (e.key === 'Enter') {
              e.preventDefault()
              onResize(column.id, undefined)
            }
          }}
        />
      </div>
    )
  },
)
