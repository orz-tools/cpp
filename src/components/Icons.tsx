import { Spinner } from '@blueprintjs/core'
import elite0 from '../assets/elite0.png'
import elite1 from '../assets/elite1.png'
import elite2 from '../assets/elite2.png'
import m1 from '../assets/m1.png'
import m2 from '../assets/m2.png'
import m3 from '../assets/m3.png'
import { useInject } from '../hooks'
import { DataManager, UniEquip } from '../pkg/cpp-core/DataManager'
import { CharacterLevel } from '../pkg/cpp-core/State'

export function SkillIcon({ skillId, level, master }: { skillId: string; level?: number; master?: number }) {
  const dm = useInject(DataManager)
  const skill = dm.data.skills[skillId]
  if (!skill) {
    return (
      <span className="bp4-menu-item-icon">
        <Spinner title={skillId} size={20} />
      </span>
    )
  }

  const name = skill.raw.levels[0].name

  return (
    <span className="bp4-menu-item-icon">
      <div className="cpp-simple-target">
        <img src={skill.icon} width={'100%'} height={'100%'} alt={name} title={name} />
        {!level ? undefined : <span>{master && master > 0 ? <img src={[m1, m2, m3][master - 1]} /> : level}</span>}
      </div>
    </span>
  )
}

export function EmptyIcon() {
  return <span className="bp4-menu-item-icon" style={{ backgroundColor: 'lightgray' }}></span>
}

export function UniEquipIcon({ uniEquip, level }: { uniEquip: UniEquip; level?: number }) {
  const name = `${uniEquip.raw.uniEquipName} (${uniEquip.raw.typeName1}-${uniEquip.raw.typeName2})`
  level = 0
  return (
    <span className="bp4-menu-item-icon">
      <div
        className={[
          'cpp-simple-target',
          'cpp-uniequip-icon',
          `cpp-uniequip-shining-${uniEquip.raw.equipShiningColor}`,
        ].join(' ')}
        style={{
          ...(level == 0
            ? {
                filter: 'grayscale(1.0)',
              }
            : {}),
        }}
      >
        <img
          src={uniEquip.icon}
          width={'75%'}
          height={'75%'}
          alt={name}
          title={name}
          style={{
            ...(level == 0
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
      <div className="cpp-simple-target" style={{ backgroundColor: 'black' }}>
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
        <span className="source" style={{ backgroundColor: 'black' }}>
          <img src={[elite0, elite1, elite2][source.elite]} />
          {source.level.toFixed(0).padStart(2, ' ')}
        </span>
        <span
          className="target"
          style={{
            backgroundColor: 'black',
            opacity: target.elite == source.elite && target.level == source.level ? 0 : 1,
          }}
        >
          <img src={[elite0, elite1, elite2][target.elite]} />
          {target.level.toFixed(0).padStart(2, ' ')}
        </span>
      </div>
    </span>
  )
}
