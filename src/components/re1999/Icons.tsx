import elite0 from '../../assets/elite0-small.png'
import elite1 from '../../assets/elite1-small.png'
import elite2 from '../../assets/elite2-small.png'
import { CharacterLevel } from '../../pkg/cpp-re1999'
import { CachedImg } from '../Icons'

export function LevelIcon({ level }: { level: CharacterLevel }) {
  return (
    <span className="bp4-menu-item-icon">
      <div className="cpp-simple-target">
        <img
          src={[elite0, elite1, elite2][level.insight]}
          width={'20'}
          style={{ marginBottom: '15px', marginLeft: 'auto', marginRight: 'auto' }}
        />
        <span style={{ top: 'auto', bottom: 0, right: 0, textAlign: 'center' }}>{level.level}</span>
      </div>
    </span>
  )
}
