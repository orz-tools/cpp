import { Alignment, Button, ButtonGroup, Classes, Menu, Navbar, Spinner, Tag } from '@blueprintjs/core'
import { Popover2 } from '@blueprintjs/popover2'
import deepEqual from 'deep-equal'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { memo, useEffect, useMemo, useState } from 'react'
import './App.css'
import m1 from './assets/m1.png'
import m2 from './assets/m2.png'
import m3 from './assets/m3.png'
import { CachedImg, EmptyIcon, LevelIcon, SkillIcon, UniEquipIcon } from './components/Icons'
import { useContainer, useInject } from './hooks/useContainer'
import { Character, DataManager, UniEquip } from './pkg/cpp-core/DataManager'
import { CharacterStatus, emptyCharacterStatus, UserData, UserDataAtomHolder } from './pkg/cpp-core/UserData'
import { Store } from './Store'
import { areEqual, FixedSizeList } from 'react-window'
import AutoSizer from 'react-virtualized-auto-sizer'
import { useRequest } from './hooks/useRequest'
import { Container } from './pkg/container'
import { load } from './pkg/blobcache'

const NAVBAR_HEIGHT = '50px'
const SIDEBAR_WIDTH = '800px'

function UndoButtons() {
  const atoms = useInject(UserDataAtomHolder)
  const setData = useSetAtom(atoms.dataAtom)
  const undoCounter = useAtomValue(atoms.undoCounterAtom)
  const redoCounter = useAtomValue(atoms.redoCounterAtom)

  return (
    <>
      <Button
        className="bp4-minimal"
        icon="undo"
        disabled={undoCounter === 0}
        text="Undo"
        onClick={() => setData('undo')}
      />
      <Button
        className="bp4-minimal"
        icon="redo"
        disabled={redoCounter === 0}
        text="Redo"
        onClick={() => setData('redo')}
      />
    </>
  )
}

function App() {
  return (
    <div className="App">
      <Navbar fixedToTop={true}>
        <Navbar.Group align={Alignment.LEFT}>
          <Navbar.Heading>Closure++</Navbar.Heading>
          <Navbar.Divider />
          <UndoButtons />
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
          display: 'flex',
        }}
      >
        <Sidebar />
      </section>
      <section style={{ marginLeft: SIDEBAR_WIDTH, paddingTop: NAVBAR_HEIGHT }}>'Source Han Sans SC'</section>
    </div>
  )
}

function renderCharacterStatus(status: CharacterStatus, character: Character, uniX?: UniEquip, uniY?: UniEquip) {
  return (
    <>
      <LevelIcon level={status} />
      {uniX ? <UniEquipIcon uniEquip={uniX} key={uniX.key} level={status.modLevel[uniX.key] || 0} /> : <EmptyIcon />}
      {uniY ? <UniEquipIcon uniEquip={uniY} key={uniY.key} level={status.modLevel[uniY.key] || 0} /> : <EmptyIcon />}
      {character.skills.map(([, skill]) => (
        <SkillIcon
          skill={skill}
          key={skill.key}
          level={status.skillLevel}
          master={status.skillMaster[skill.key] || 0}
        />
      ))}
      {new Array(3 - (character.raw.skills?.length || 0)).fill(0).map((_, i) => (
        <EmptyIcon key={i} />
      ))}
    </>
  )
}

function CharacterStatusPopover({ character, isGoal }: { character: Character; isGoal: boolean }) {
  const atoms = useInject(UserDataAtomHolder)
  const charId = character.key
  const statusAtom = isGoal ? atoms.goalCharacter(charId) : atoms.currentCharacter(charId)
  const uniEquips = character.uniEquips.filter((x) => x.raw.unlockEvolvePhase > 0)
  const [status, setStatus] = useAtom(statusAtom)

  return (
    <>
      <div>
        {character.raw.name} - {isGoal ? '培养目标' : '当前状态'}
      </div>
      <div>
        <ButtonGroup>
          <Tag large={true}>等级</Tag>
          <Button
            onClick={() =>
              setStatus((x) => {
                x.elite = 0
                x.level = 0
              })
            }
          >
            未持有
          </Button>
          <Button
            onClick={() =>
              setStatus((x) => {
                x.elite = 0
                x.level = 1
              })
            }
          >
            精零1
          </Button>
          <Button
            onClick={() =>
              setStatus((x) => {
                x.elite = 0
                x.level = 999
              })
            }
          >
            精零满
          </Button>
          <Button
            onClick={() =>
              setStatus((x) => {
                x.elite = 1
                x.level = 1
              })
            }
          >
            精一1
          </Button>
          <Button
            onClick={() =>
              setStatus((x) => {
                x.elite = 1
                x.level = 999
              })
            }
          >
            精一满
          </Button>
          <Button
            onClick={() =>
              setStatus((x) => {
                x.elite = 2
                x.level = 1
              })
            }
          >
            精二1
          </Button>
          <Button
            onClick={() =>
              setStatus((x) => {
                x.elite = 2
                x.level = 40
              })
            }
          >
            精二40
          </Button>
          <Button
            onClick={() =>
              setStatus((x) => {
                x.elite = 2
                x.level = 50
              })
            }
          >
            精二50
          </Button>
          <Button
            onClick={() =>
              setStatus((x) => {
                x.elite = 2
                x.level = 60
              })
            }
          >
            精二60
          </Button>
          <Button
            onClick={() =>
              setStatus((x) => {
                x.elite = 2
                x.level = 90
              })
            }
          >
            精二90
          </Button>
        </ButtonGroup>
      </div>
      <div>
        <ButtonGroup>
          <Tag large={true}>技能</Tag>
          <Button
            onClick={() =>
              setStatus((x) => {
                x.skillLevel = 1
              })
            }
          >
            技能1
          </Button>
          <Button
            onClick={() =>
              setStatus((x) => {
                x.skillLevel = 2
              })
            }
          >
            技能2
          </Button>
          <Button
            onClick={() =>
              setStatus((x) => {
                x.skillLevel = 3
              })
            }
          >
            技能3
          </Button>
          <Button
            onClick={() =>
              setStatus((x) => {
                x.skillLevel = 4
              })
            }
          >
            技能4
          </Button>
          <Button
            onClick={() =>
              setStatus((x) => {
                x.skillLevel = 5
              })
            }
          >
            技能5
          </Button>
          <Button
            onClick={() =>
              setStatus((x) => {
                x.skillLevel = 6
              })
            }
          >
            技能6
          </Button>
          <Button
            onClick={() =>
              setStatus((x) => {
                x.skillLevel = 7
              })
            }
          >
            技能7
          </Button>
        </ButtonGroup>
      </div>

      {character.skills.map(([cSkill, skill]) => {
        return (
          <div key={skill.key}>
            <ButtonGroup className={Classes.DARK}>
              <Tag large={true}>{skill.raw.levels[0].name}</Tag>
              <Button
                icon={<img src={m1} width="100%" height="100%" />}
                onClick={() =>
                  setStatus((x) => {
                    x.skillMaster[skill.key] = 1
                  })
                }
              ></Button>
              <Button
                icon={<img src={m2} width="100%" height="100%" />}
                onClick={() =>
                  setStatus((x) => {
                    x.skillMaster[skill.key] = 2
                  })
                }
              ></Button>
              <Button
                icon={<img src={m3} width="100%" height="100%" />}
                onClick={() =>
                  setStatus((x) => {
                    x.skillMaster[skill.key] = 3
                  })
                }
              ></Button>
            </ButtonGroup>
          </div>
        )
      })}

      {uniEquips.map((equip) => {
        return (
          <div key={equip.key}>
            <ButtonGroup className={Classes.DARK}>
              <Tag large={true}>{equip.raw.uniEquipName}</Tag>
              <Tag large={true}>
                {equip.raw.typeName1}-{equip.raw.typeName2}
              </Tag>
              <Button
                onClick={() =>
                  setStatus((x) => {
                    x.modLevel[equip.key] = 0
                  })
                }
              >
                0
              </Button>
              <Button
                onClick={() =>
                  setStatus((x) => {
                    x.modLevel[equip.key] = 1
                  })
                }
              >
                1
              </Button>
              <Button
                onClick={() =>
                  setStatus((x) => {
                    x.modLevel[equip.key] = 2
                  })
                }
              >
                2
              </Button>
              <Button
                onClick={() =>
                  setStatus((x) => {
                    x.modLevel[equip.key] = 3
                  })
                }
              >
                3
              </Button>
            </ButtonGroup>
          </div>
        )
      })}
    </>
  )
}

function CharacterMenu({ character, style }: { character: Character; style?: React.CSSProperties }) {
  const atoms = useInject(UserDataAtomHolder)
  const charId = character.key
  const currentCharacter = useAtomValue(atoms.currentCharacter(charId))
  const goalCharacter = useAtomValue(atoms.goalCharacter(charId))

  const uniEquips = character.uniEquips.filter((x) => x.raw.unlockEvolvePhase > 0)
  const uniX = uniEquips.find((x) => x.raw.typeName2.toUpperCase() == 'X')
  const uniY = uniEquips.find((x) => x.raw.typeName2.toUpperCase() == 'Y')
  const goalSame = deepEqual(currentCharacter, goalCharacter, { strict: true })

  if ([uniX, uniY].filter((x) => !!x).length != uniEquips.length) {
    console.warn('character extra uniEquips', character, uniEquips)
  }

  return (
    <li role="none" className="cpp-char-menu-master" style={style}>
      <a role="menuitem" tabIndex={0} className="bp4-menu-item cpp-char-menu-char">
        <>
          <span className="bp4-menu-item-icon">
            <CachedImg
              src={character.avatar}
              width={'100%'}
              height={'100%'}
              alt={character.key}
              title={character.key}
            />
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
        </>
      </a>
      <Popover2
        usePortal={true}
        popoverClassName={'cpp-popover2'}
        content={<CharacterStatusPopover character={character} isGoal={false} />}
        placement="bottom"
      >
        <a
          role="menuitem"
          tabIndex={0}
          className="bp4-menu-item cpp-char-menu-status cpp-char-menu-status-current"
          style={{ opacity: currentCharacter.level === 0 ? 0.25 : 1 }}
        >
          {renderCharacterStatus(currentCharacter, character, uniX, uniY)}
        </a>
      </Popover2>
      <Popover2
        usePortal={true}
        popoverClassName={'cpp-popover2'}
        content={<CharacterStatusPopover character={character} isGoal={true} />}
        placement="bottom"
      >
        <a
          role="menuitem"
          tabIndex={0}
          className="bp4-menu-item cpp-char-menu-status cpp-char-menu-status-goal"
          style={{ opacity: goalSame ? 0.25 : 1 }}
        >
          {renderCharacterStatus(goalCharacter, character, uniX, uniY)}
        </a>
      </Popover2>
    </li>
  )
}

async function listCharactersQuery(container: Container) {
  const dm = container.get(DataManager)
  const store = container.get(Store).store
  const atoms = container.get(UserDataAtomHolder)
  const ud = store.get(atoms.rootAtom)

  return Object.values(dm.data.characters)
    .filter((x) => {
      if (!x.raw.displayNumber) return false
      // if (x.raw.rarity !== 5) return false
      return true
    })
    .sort((a, b) => {
      if (a.raw.rarity > b.raw.rarity) return -1
      if (a.raw.rarity < b.raw.rarity) return 1

      const stA = ud.current[a.key] || emptyCharacterStatus
      const stB = ud.current[b.key] || emptyCharacterStatus
      if (stA.elite > stB.elite) return -1
      if (stA.elite < stB.elite) return 1

      if (stA.level > stB.level) return -1
      if (stA.level < stB.level) return 1

      return 0
    })
}

function Sidebar() {
  const container = useContainer()
  const { send, response } = useRequest(listCharactersQuery)

  useEffect(
    () => send(container),
    [
      /* intended */
    ],
  )

  const filteredCharacters = response || []

  // const [a, setA] = useState(false)
  return (
    <Menu style={{ flex: 1 }}>
      <AutoSizer>
        {({ height, width }) => (
          <FixedSizeList
            height={height}
            itemCount={filteredCharacters.length}
            itemSize={50}
            width={width}
            itemKey={(index) => filteredCharacters[index].key}
          >
            {({ index, style }) => <MemorizedCharacterMenu style={style} character={filteredCharacters[index]} />}
          </FixedSizeList>
        )}
      </AutoSizer>
    </Menu>
  )
}

const MemorizedCharacterMenu = memo(CharacterMenu, areEqual)

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
