import { Icon } from '@blueprintjs/core'
import { memo } from 'react'
import { CharacterLevel, Profession, Skill, UniEquip } from '../../pkg/cpp-arknights'
import { CachedImg } from '../Icons'
import elite0 from './assets/elite0-small.png'
import elite1 from './assets/elite1-small.png'
import elite2 from './assets/elite2-small.png'
import m1 from './assets/m1.png'
import m2 from './assets/m2.png'
import m3 from './assets/m3.png'
import ProfessionCaster from './assets/profession-CASTER.svg?react'
import ProfessionMedic from './assets/profession-MEDIC.svg?react'
import ProfessionPioneer from './assets/profession-PIONEER.svg?react'
import ProfessionSniper from './assets/profession-SNIPER.svg?react'
import ProfessionSpecial from './assets/profession-SPECIAL.svg?react'
import ProfessionSupport from './assets/profession-SUPPORT.svg?react'
import ProfessionTank from './assets/profession-TANK.svg?react'
import ProfessionWarrior from './assets/profession-WARRIOR.svg?react'

const proMap = {
  [Profession.CASTER]: ProfessionCaster,
  [Profession.MEDIC]: ProfessionMedic,
  [Profession.PIONEER]: ProfessionPioneer,
  [Profession.SNIPER]: ProfessionSniper,
  [Profession.SPECIAL]: ProfessionSpecial,
  [Profession.SUPPORT]: ProfessionSupport,
  [Profession.TANK]: ProfessionTank,
  [Profession.WARRIOR]: ProfessionWarrior,
  [Profession.TOKEN]: undefined,
  [Profession.TRAP]: undefined,
}

export const ProfessionIcon = memo(({ profession, style }: { profession: Profession; style?: React.CSSProperties }) => {
  const C = proMap[profession]
  return (
    <span className="bp5-icon" style={style}>
      {C ? <C width={16} height={16} /> : <Icon icon="blank" size={16} />}
    </span>
  )
})

export const SkillIcon = memo(({ skill, level, master }: { skill: Skill; level?: number; master?: number }) => {
  const name = skill.name

  return (
    <span className="bp5-menu-item-icon">
      <div className="cpp-simple-target">
        <CachedImg src={skill.icon} width={'100%'} height={'100%'} alt={name} title={name} />
        {!level ? undefined : <span>{master && master > 0 ? <img src={[m1, m2, m3][master - 1]} /> : level}</span>}
      </div>
    </span>
  )
})

export const UniEquipIcon = memo(
  ({ classes, uniEquip, level }: { uniEquip: UniEquip; level?: number; classes?: string[] }) => {
    const name = `${uniEquip.name} (${uniEquip.raw.typeName1}-${uniEquip.raw.typeName2})`
    return (
      <span className={['bp5-menu-item-icon', ...(classes || [])].join(' ')}>
        <div
          className={[
            'cpp-simple-target',
            'cpp-uniequip-icon',
            `cpp-uniequip-shining-${uniEquip.raw.equipShiningColor}`,
          ].join(' ')}
          style={{
            ...(level === 0
              ? {
                  filter: 'grayscale(1.0)',
                }
              : {}),
          }}
        >
          <CachedImg
            src={uniEquip.icon}
            width={'75%'}
            height={'75%'}
            alt={name}
            title={name}
            style={{
              ...(level === 0
                ? {
                    opacity: 0.5,
                  }
                : {}),
            }}
          />
          {level != null ? <span>{level}</span> : undefined}
        </div>
      </span>
    )
  },
)

export const LevelIcon = memo(({ level }: { level: CharacterLevel }) => {
  return (
    <span className="bp5-menu-item-icon">
      <div className="cpp-simple-target">
        <img
          src={[elite0, elite1, elite2][level.elite]}
          width={'20'}
          style={{ marginBottom: '15px', marginLeft: 'auto', marginRight: 'auto' }}
        />
        <span style={{ top: 'auto', bottom: 0, right: 0, textAlign: 'center' }}>{level.level}</span>
      </div>
    </span>
  )
})

export const LevelTarget2 = memo(({ source, target }: { source: CharacterLevel; target: CharacterLevel }) => {
  return (
    <span className="bp5-menu-item-icon">
      <div className="cpp-level-target">
        <span className="source">
          <img src={[elite0, elite1, elite2][source.elite]} />
          {source.level.toFixed(0).padStart(2, ' ')}
        </span>
        <span
          className="target"
          style={{
            backgroundColor: 'black',
            opacity: target.elite === source.elite && target.level === source.level ? 0 : 1,
          }}
        >
          <img src={[elite0, elite1, elite2][target.elite]} />
          {target.level.toFixed(0).padStart(2, ' ')}
        </span>
      </div>
    </span>
  )
})
