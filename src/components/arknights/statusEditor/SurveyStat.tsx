import { Tooltip } from '@blueprintjs/core'
import React, { memo } from 'react'
import { gt } from '../../../pkg/gt'
import { countText, percentText } from './text'

/** What a share is of: everyone surveyed, an operator's owners, its E2 owners, or those who unlocked a module */
export type StatBase = 'all' | 'owned' | 'elite2' | 'unlocked'

/** Below this many players a share is shown faded: one player more or less moves it visibly. */
const FEW_SAMPLES = 500

export function isFewSamples(samples: number) {
  return Number.isFinite(samples) && samples < FEW_SAMPLES
}

/** e.g. 锈枝 · 2 级 4.2%，精二的 14,580 人里有 613 人（一图流） */
export function statTooltip(what: string, share: number, samples: number, base: StatBase, source: string) {
  let detail: string
  if (base === 'unlocked') {
    detail = gt.pgettext('arknights status editor', '解锁者中的占比')
  } else if (!Number.isFinite(samples)) {
    detail = gt.pgettext('arknights status editor', '样本数未知')
  } else {
    // I10N: %1: players surveyed; %2: of them owning it
    const all = gt.pgettext('arknights status editor', '%1 人里有 %2 人')
    // I10N: %1: owners; %2: of them at this tier
    const owned = gt.pgettext('arknights status editor', '持有的 %1 人里有 %2 人')
    // I10N: %1: E2 owners; %2: of them at this tier
    const elite2 = gt.pgettext('arknights status editor', '精二的 %1 人里有 %2 人')
    detail = { all, owned, elite2 }[base]
      .replaceAll('%1', countText(samples))
      .replaceAll('%2', countText(share * samples))
  }
  // I10N: %1: what, e.g. 锈枝 · 2 级; %2: share; %3: sample detail; %4: source
  const text = gt.pgettext('arknights status editor', '%1 %2，%3（%4）')
  return text
    .replaceAll('%1', what)
    .replaceAll('%2', percentText(share))
    .replaceAll('%3', detail)
    .replaceAll('%4', source)
}

/** A share under its cell: the number and a 2px bar as long as the share, lined up with the same tier above and below. */
export const SurveyStat = memo(
  ({
    share,
    samples,
    tooltip,
    target,
  }: {
    share: number | null
    samples: number
    tooltip: string
    target?: boolean
  }) => {
    if (share == null || !Number.isFinite(share)) return <span className="cpp-charstat-stat" />
    const cls = ['cpp-charstat-stat']
    if (target) cls.push('cpp-charstat-stat-target')
    if (isFewSamples(samples)) cls.push('cpp-charstat-stat-few')
    return (
      <Tooltip
        content={tooltip}
        compact
        openOnTargetFocus={false}
        placement="top"
        className="cpp-charstat-stat-wrap"
        hoverOpenDelay={150}
      >
        <span
          className={cls.join(' ')}
          style={{ '--p': `${Math.min(Math.max(share, 0), 1) * 100}%` } as React.CSSProperties}
        >
          {(share * 100).toFixed(1)}
          <span className="cpp-charstat-stat-bar" />
        </span>
      </Tooltip>
    )
  },
)
