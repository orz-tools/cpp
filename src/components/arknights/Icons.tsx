import { CharacterLevel, Skill, UniEquip } from '../../pkg/cpp-arknights'
import { CachedImg } from '../Icons'
import elite0 from './assets/elite0-small.png'
import elite1 from './assets/elite1-small.png'
import elite2 from './assets/elite2-small.png'
import m1 from './assets/m1.png'
import m2 from './assets/m2.png'
import m3 from './assets/m3.png'

export function SkillIcon({ skill, level, master }: { skill: Skill; level?: number; master?: number }) {
  const name = skill.raw.levels[0].name

  return (
    <span className="bp4-menu-item-icon">
      <div className="cpp-simple-target">
        <CachedImg src={skill.icon} width={'100%'} height={'100%'} alt={name} title={name} />
        {!level ? undefined : <span>{master && master > 0 ? <img src={[m1, m2, m3][master - 1]} /> : level}</span>}
      </div>
    </span>
  )
}

export function UniEquipIcon({ uniEquip, level }: { uniEquip: UniEquip; level?: number }) {
  const name = `${uniEquip.raw.uniEquipName} (${uniEquip.raw.typeName1}-${uniEquip.raw.typeName2})`
  return (
    <span className="bp4-menu-item-icon">
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
}

export function LevelIcon({ level }: { level: CharacterLevel }) {
  return (
    <span className="bp4-menu-item-icon">
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
}

export function LevelTarget2({ source, target }: { source: CharacterLevel; target: CharacterLevel }) {
  return (
    <span className="bp4-menu-item-icon">
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
}
