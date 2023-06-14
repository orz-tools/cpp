import { CharacterLevel } from '../../pkg/cpp-re1999'
import dongxi1 from './assets/dongxi_da_001.png'
import dongxi2 from './assets/dongxi_da_002.png'
import dongxi3 from './assets/dongxi_da_003.png'
import danao from './assets/icon_danao01.png'

export function LevelIcon({ level }: { level: CharacterLevel }) {
  return (
    <span className="bp4-menu-item-icon">
      <div className="cpp-simple-target">
        <img
          src={[undefined, dongxi1, dongxi2, dongxi3][level.insight]}
          width={'23'}
          style={{ marginBottom: '15px', marginLeft: 'auto', marginRight: 'auto' }}
        />
        <span style={{ top: 'auto', bottom: 0, right: 0, textAlign: 'center', background: 'transparent', height: 16 }}>
          <small style={{ fontSize: '50%' }}>Lv.</small>
          {level.level}
        </span>
      </div>
    </span>
  )
}

export function ResonateIcon({ level }: { level: number }) {
  return (
    <span className="bp4-menu-item-icon">
      <div className="cpp-simple-target">
        <img src={danao} width={'23'} style={{ marginBottom: '15px', marginLeft: 'auto', marginRight: 'auto' }} />
        <span style={{ top: 'auto', bottom: 0, right: 0, textAlign: 'center', background: 'transparent', height: 16 }}>
          <small style={{ fontSize: '50%' }}>Lv.</small>
          {level}
        </span>
      </div>
    </span>
  )
}
