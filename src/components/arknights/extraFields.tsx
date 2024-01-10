import { memo } from 'react'
import { Arknights, Character } from '../../pkg/cpp-arknights'
import { FieldContext } from '../../pkg/cpp-basic'
import { CharacterListColumn, createSimpleExtraField } from '../CharacterList'
import { CachedImg } from '../Icons'
import { IGameComponent } from '../types'

const percentageFormatter = (value: number) => {
  return Number.isFinite(value) ? `${(value * 100).toFixed(2)}%` : '???'
}

const percentageStyle: React.CSSProperties = {
  fontFamily: 'monospace',
  textAlign: 'right',
}

export const extraFields: IGameComponent['extraFields'] = {
  skill: {
    width: 150,
    C: memo(({ context }: { context: FieldContext<Arknights, Character, [number]> }) => {
      const skillId = context.args[0]
      const skill = context.character.skills[skillId]
      const skillName = skill[1].raw.levels[0].name
      const skillIndex = ['一技能', '二技能', '三技能'][skill[3]]

      return (
        <CharacterListColumn width={150}>
          <span className="bp5-menu-item-icon">
            <CachedImg src={skill[1].icon} width={'100%'} height={'100%'} alt={skillName} title={skillName} />
          </span>
          <div className="bp5-fill" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div className="bp5-text-overflow-ellipsis" title={skillName}>
              {skillName}
            </div>
            <div className="bp5-text-overflow-ellipsis" style={{ fontWeight: 'normal', opacity: 0.25 }}>
              {skillIndex}
            </div>
          </div>
        </CharacterListColumn>
      )
    }),
  },
  'skill.mastery3rate.yituliu': createSimpleExtraField(
    'skill.mastery3rate.yituliu',
    65,
    percentageFormatter,
    percentageStyle,
  ),
  'skill.mastery3rate.heybox': createSimpleExtraField(
    'skill.mastery3rate.heybox',
    65,
    percentageFormatter,
    percentageStyle,
  ),
}
