import { Alignment, Button, Classes, Menu, Navbar, Spinner, Tag } from '@blueprintjs/core'
import { Popover2 } from '@blueprintjs/popover2'
import deepEqual from 'deep-equal'
import { atom, useAtom, useAtomValue, useSetAtom } from 'jotai'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import AutoSizer from 'react-virtualized-auto-sizer'
import { areEqual, FixedSizeList, ListChildComponentProps, ListItemKeySelector } from 'react-window'
import { CharacterStatusPopover } from '../components/CharacterStatusPopover'
import { CachedImg, EmptyIcon, LevelIcon, SkillIcon, UniEquipIcon } from '../components/Icons'
import { useContainer, useInject } from '../hooks/useContainer'
import { useRequest } from '../hooks/useRequest'
import { Container } from '../pkg/container'
import { Character, DataManager, UniEquip } from '../pkg/cpp-core/DataManager'
import { CharacterStatus, emptyCharacterStatus, UserDataAtomHolder } from '../pkg/cpp-core/UserData'
import { Store } from '../Store'

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

function buildMatcher(query: string): (x: string) => boolean {
  const trimmed = query.toLowerCase().trim()
  if (!trimmed) return () => true

  const match = query.match(/^\/(.+)\/(i)?$/)
  if (match) {
    try {
      const regex = new RegExp(match[1], match[2])
      return (x: string) => !!x.match(regex)
    } catch (e) {
      console.warn('Failed to compile regexp ', e)
      return () => false
    }
  }

  return (x: string) => x.toLowerCase().includes(trimmed)
}

async function listCharactersQuery(container: Container, param: ListCharactersQueryParam) {
  const dm = container.get(DataManager)
  const store = container.get(Store).store
  const atoms = container.get(UserDataAtomHolder)
  const ud = store.get(atoms.rootAtom)

  const matcher = buildMatcher(param.query)

  return Object.values(dm.data.characters)
    .filter((x) => {
      if (!x.raw.displayNumber) return false
      if (!(matcher(x.raw.name) || matcher(x.raw.appellation) || matcher(x.key))) return false
      // if (x.raw.rarity !== 5) return false
      return true
    })
    .sort((a, b) => {
      const goalA = +!!ud.goal[a.key]
      const goalB = +!!ud.goal[b.key]

      if (goalA > goalB) return -1
      if (goalA < goalB) return 1

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

interface ListCharactersQueryParam {
  query: string
}

const queryParamAtom = atom({ query: '' })

function QuerySearchBox() {
  const [param, setParam] = useAtom(queryParamAtom)
  return (
    <>
      <div className="bp4-input-group {{.modifier}}">
        <span className="bp4-icon bp4-icon-search"></span>
        <input
          className="bp4-input"
          type="search"
          dir="auto"
          autoComplete="false"
          autoCapitalize="false"
          autoCorrect="false"
          aria-autocomplete="none"
          value={param.query}
          onChange={(e) => setParam((x) => ({ ...x, query: e.currentTarget.value }))}
        />
      </div>
    </>
  )
}

export function CharacterList() {
  const param = useAtomValue(queryParamAtom)

  const container = useContainer()
  const { send, response, loading } = useRequest(listCharactersQuery)

  const refresh = () => {
    send(container, param)
  }

  useEffect(
    () => refresh(),
    [
      /* intended */
    ],
  )

  useEffect(() => refresh(), [param])

  const list = response || []
  const child = useCallback(
    ({ index, data, style }: ListChildComponentProps<Character[]>) => (
      <CharacterMenu style={style} character={data[index]} />
    ),
    [],
  )
  const itemKey = useCallback<ListItemKeySelector<Character[]>>((index, data) => data[index].key, [])

  return (
    <>
      <Navbar>
        <Navbar.Group align={Alignment.RIGHT}>
          <Button
            icon={loading ? <Spinner size={16} /> : 'refresh'}
            minimal={true}
            disabled={loading}
            onClick={refresh}
          />
        </Navbar.Group>
        <Navbar.Group align={Alignment.LEFT}>
          <QuerySearchBox />
        </Navbar.Group>
      </Navbar>
      <Menu style={{ flex: 1, flexShrink: 1, overflow: 'hidden' }}>
        <AutoSizer>
          {({ height, width }) => (
            <FixedSizeList
              height={height}
              itemCount={list.length}
              itemSize={50}
              width={width}
              itemKey={itemKey}
              itemData={list}
            >
              {child}
            </FixedSizeList>
          )}
        </AutoSizer>
      </Menu>
    </>
  )
}
