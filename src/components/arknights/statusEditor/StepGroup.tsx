import { Icon, Tooltip } from '@blueprintjs/core'
import React, { memo } from 'react'
import type { Prerequisite } from '../../../pkg/cpp-arknights/statusEdit'
import { cellState } from '../../../pkg/cpp-arknights/statusEdit'

export interface StepGroupProps {
  values: number[]
  /** The value being edited */
  value: number
  /** The current value, while editing a goal */
  current?: number
  /** What a cell shows; the value itself when absent */
  render?: (v: number) => React.ReactNode
  /** The accessible name of a cell */
  label: (v: number) => string
  /** What else a cell raises, with the hint for it */
  prerequisite?: (v: number) => { p: Prerequisite; text: string } | null
  onPick: (v: number) => void
  slim?: boolean
  labelledBy?: string
}

/**
 * One row of cells: gray for what the current status has, blue for what is reached or planned, white for the rest.
 * A cell that also raises something else (an elite phase, a level) carries a small amber arrow and says what in its
 * tooltip.
 */
export const StepGroup = memo(
  ({ values, value, current, render, label, prerequisite, onPick, slim, labelledBy }: StepGroupProps) => (
    <div
      className={'cpp-charstat-steps' + (slim ? ' cpp-charstat-steps-slim' : '')}
      role="group"
      aria-labelledby={labelledBy}
    >
      {values.map((v) => {
        const { state, disabled } = cellState(v, value, current)
        const pre = disabled ? null : prerequisite?.(v)
        const cell = (
          <button
            key={v}
            type="button"
            className={`cpp-charstat-cell cpp-charstat-cell-${state}`}
            disabled={disabled}
            aria-pressed={state !== 'off'}
            aria-label={pre ? `${label(v)} · ${pre.text}` : label(v)}
            onClick={() => onPick(v)}
          >
            {render ? render(v) : v}
            {pre ? <Icon icon="arrow-up" size={9} className="cpp-charstat-cell-raise" /> : null}
          </button>
        )
        return pre ? (
          <Tooltip
            key={v}
            content={pre.text}
            compact
            placement="top"
            hoverOpenDelay={150}
            className="cpp-charstat-cell-wrap"
          >
            {cell}
          </Tooltip>
        ) : (
          cell
        )
      })}
    </div>
  ),
)
