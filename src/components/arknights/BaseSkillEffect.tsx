import { memo } from 'react'
import type { BaseBuff } from '../../pkg/cpp-arknights/DataManager'
import type { BuildingBuffDetail } from '../../pkg/cpp-arknights/details'
import { gt } from '../../pkg/gt'
import { effectTexts, fallbackTexts } from './baseSkillText'

/**
 * A base skill's effect in two lines: what it gives outright (in regular weight when it takes a condition), then the
 * rest. A skill without a summary shows the game's number and a pointer to its text, which sits beside it.
 */
export const BaseSkillEffect = memo(
  ({ buff, detail, variant }: { buff: BaseBuff; detail: BuildingBuffDetail | null; variant: 'cell' | 'card' }) => {
    const texts = detail?.effects ? effectTexts(detail.effects, buff.roomType) : null
    const lines = texts ?? { ...fallbackTexts(buff.efficiency), conditional: false }
    const title = texts
      ? variant === 'cell'
        ? [texts.head, texts.rest].filter(Boolean).join('\n')
        : undefined
      : gt.pgettext('arknights base skill', '这条技能还概括不了，看原文')
    return (
      <span className={`cpp-bskill-sum is-${variant}${texts ? '' : ' is-raw'}`} title={title}>
        {lines.head ? (
          <span className={'cpp-bskill-sum-h' + (lines.conditional ? ' is-cond' : '')}>{lines.head}</span>
        ) : null}
        {lines.rest ? <span className="cpp-bskill-sum-d">{lines.rest}</span> : null}
      </span>
    )
  },
)
