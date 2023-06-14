import { CharacterLevel } from '../../pkg/cpp-re1999'
import dongxi1 from './assets/dongxi_da_001.png'
import dongxi2 from './assets/dongxi_da_002.png'
import dongxi3 from './assets/dongxi_da_003.png'

export function LevelIcon({ level }: { level: CharacterLevel }) {
  return (
    <span className="bp4-menu-item-icon">
      <div className="cpp-simple-target">
        <img
          src={[undefined, dongxi1, dongxi2, dongxi3][level.insight]}
          width={'23'}
          style={{ marginBottom: '15px', marginLeft: 'auto', marginRight: 'auto' }}
        />
        <span style={{ top: 'auto', bottom: 0, right: 0, textAlign: 'center', background: 'transparent' }}>
          {level.level}
        </span>
      </div>
    </span>
  )
}
