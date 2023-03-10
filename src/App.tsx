import { Alignment, Button, Classes, Menu, Navbar, Spinner } from '@blueprintjs/core'
import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { LevelIcon, UniEquipIcon, EmptyIcon, SkillIcon } from './components/Icons'
import { useInject } from './hooks'
import { Character, DataManager } from './pkg/cpp-core/DataManager'

const NAVBAR_HEIGHT = '50px'
const SIDEBAR_WIDTH = '450px'

function App() {
  return (
    <div className="App">
      <Navbar fixedToTop={true}>
        <Navbar.Group align={Alignment.LEFT}>
          <Navbar.Heading>Closure++</Navbar.Heading>
          <Navbar.Divider />
          <Button className="bp4-minimal" icon="home" text="Home" />
          <Button className="bp4-minimal" icon="document" text="Files" />
        </Navbar.Group>
      </Navbar>
      <section
        className={Classes.ELEVATION_1}
        style={{
          left: 0,
          bottom: 0,
          top: NAVBAR_HEIGHT,
          width: SIDEBAR_WIDTH,
          position: 'fixed',
          overflowY: 'auto',
          overflowX: 'visible',
        }}
      >
        <Sidebar />
      </section>
      <section style={{ marginLeft: SIDEBAR_WIDTH, paddingTop: NAVBAR_HEIGHT }}>'Source Han Sans SC'</section>
    </div>
  )
}

function CharacterMenu({ character }: { character: Character }) {
  const uniEquips = character.uniEquips.filter((x) => x.raw.unlockEvolvePhase > 0)
  const uniX = uniEquips.find((x) => x.raw.typeName2.toUpperCase() == 'X')
  const uniY = uniEquips.find((x) => x.raw.typeName2.toUpperCase() == 'Y')

  if ([uniX, uniY].filter((x) => !!x).length != uniEquips.length) {
    console.warn('character extra uniEquips', character, uniEquips)
  }

  return (
    <>
      <li role="none">
        <a role="menuitem" tabIndex={0} className="bp4-menu-item bp4-popover-dismiss cpp-character-menu">
          <>
            <span className="bp4-menu-item-icon">
              <img src={character.avatar} width={'100%'} height={'100%'} alt={character.key} title={character.key} />
            </span>
            <div className="bp4-fill" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div className="bp4-text-overflow-ellipsis" title={character.raw.name}>
                {character.raw.name}
              </div>
              <div
                className="bp4-text-overflow-ellipsis"
                title={character.raw.appellation}
                style={{ fontWeight: 'normal', opacity: 0.75 }}
              >
                {character.raw.appellation}
              </div>
            </div>
            <LevelIcon level={{ elite: 0, level: 1 }} />
            {uniX ? <UniEquipIcon uniEquip={uniX} key={uniX.key} /> : <EmptyIcon />}
            {uniY ? <UniEquipIcon uniEquip={uniY} key={uniY.key} /> : <EmptyIcon />}
            {character.raw.skills?.map((skill) => (
              <SkillIcon skillId={skill.skillId} key={skill.skillId} level={0} master={0} />
            ))}
            {new Array(3 - (character.raw.skills?.length || 0)).fill(0).map((_, i) => (
              <EmptyIcon key={i} />
            ))}
          </>
        </a>
      </li>
    </>
  )
}

function Sidebar() {
  const dm = useInject(DataManager)
  const filteredCharacters = useMemo(
    () =>
      Object.values(dm.data.characters)
        .filter((x) => {
          if (!x.raw.displayNumber) return false
          // if (x.raw.rarity !== 5) return false
          return true
        })
        .sort((a, b) => {
          if (a.raw.rarity > b.raw.rarity) return -1
          if (a.raw.rarity < b.raw.rarity) return 1
          return 0
        }),
    [dm],
  )
  // const [a, setA] = useState(false)
  return (
    <>
      <Menu>
        {filteredCharacters.map((x) => (
          <CharacterMenu character={x} key={x.key} />
        ))}
      </Menu>
    </>
  )
}

export function AppWrapper() {
  const dm = useInject(DataManager)
  const [, setTicker] = useState(0)
  useEffect(() => {
    let timer: null | ReturnType<typeof setInterval> = setInterval(() => {
      if (dm.initialized) {
        clearTimeout(timer!)
        timer = null
        setTicker((x) => x + 1)
      }
    }, 100)
    return () => void (timer && clearTimeout(timer!))
  }, [dm])

  if (!dm.initialized) {
    return <Spinner size={200} />
  }

  return <App />
}
