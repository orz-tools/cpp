import { Alignment, Button, Menu, Navbar, Spinner, Tag } from '@blueprintjs/core'
import { Popover2 } from '@blueprintjs/popover2'
import deepEqual from 'deep-equal'
import { atom, SetStateAction, useAtom, useAtomValue } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import React, { useCallback, useEffect, useMemo } from 'react'
import AutoSizer from 'react-virtualized-auto-sizer'
import { FixedSizeList, ListChildComponentProps, ListItemKeySelector } from 'react-window'
import { CharacterStatusPopover } from '../components/CharacterStatusPopover'
import { CachedImg, EmptyIcon, LevelIcon, SkillIcon, UniEquipIcon } from '../components/Icons'
import { useContainer, useInject } from '../hooks/useContainer'
import { useRequest } from '../hooks/useRequest'
import { Container } from '../pkg/container'
import { Character, DataManager, UniEquip } from '../pkg/cpp-core/DataManager'
import { CharacterStatus, emptyCharacterStatus, UserDataAtomHolder } from '../pkg/cpp-core/UserData'
import { Store } from '../Store'

function Hide({ children, hide, alreadyHide }: React.PropsWithChildren<{ hide: boolean; alreadyHide: boolean }>) {
  return (
    <div
      style={
        alreadyHide
          ? undefined
          : {
              opacity: hide ? 0.1 : 1,
            }
      }
    >
      {children}
    </div>
  )
}

function renderCharacterStatus(
  status: CharacterStatus,
  character: Character,
  uniX?: UniEquip,
  uniY?: UniEquip,
  current?: CharacterStatus,
  alreadyHide: boolean = false,
) {
  return (
    <>
      <Hide
        hide={current ? status.elite == current.elite && status.level == current.level : false}
        alreadyHide={alreadyHide}
      >
        <LevelIcon level={status} />
      </Hide>
      {uniX ? (
        <Hide
          hide={current ? (status.modLevel[uniX.key] || 0) == (current.modLevel[uniX.key] || 0) : false}
          alreadyHide={alreadyHide}
        >
          <UniEquipIcon uniEquip={uniX} key={uniX.key} level={status.modLevel[uniX.key] || 0} />
        </Hide>
      ) : (
        <EmptyIcon />
      )}
      {uniY ? (
        <Hide
          hide={current ? (status.modLevel[uniY.key] || 0) == (current.modLevel[uniY.key] || 0) : false}
          alreadyHide={alreadyHide}
        >
          <UniEquipIcon uniEquip={uniY} key={uniY.key} level={status.modLevel[uniY.key] || 0} />
        </Hide>
      ) : (
        <EmptyIcon />
      )}
      {character.skills.slice(0, 3).map(([, skill]) => (
        <Hide
          hide={
            current
              ? status.skillLevel == current.skillLevel &&
                (status.skillMaster[skill.key] || 0) == (current.skillMaster[skill.key] || 0)
              : false
          }
          key={skill.key}
          alreadyHide={alreadyHide}
        >
          <SkillIcon skill={skill} level={status.skillLevel} master={status.skillMaster[skill.key] || 0} />
        </Hide>
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
  const goalSame = useMemo(
    () => deepEqual(currentCharacter, goalCharacter, { strict: true }),
    [currentCharacter, goalCharacter],
  )
  const finished = useAtomValue(atoms.isCharacterFinished(charId))

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
          style={{ opacity: currentCharacter.level === 0 ? 0.5 : 1 }}
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
          // style={{ opacity: goalCharacter.level === 0 ? 0.25 : 1 }}
          style={{ opacity: finished ? 0 : goalSame ? 0.25 : 1 }}
        >
          {renderCharacterStatus(goalCharacter, character, uniX, uniY, currentCharacter, goalSame)}
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

      if (param.mode == ListMode.WithGoal) {
        return !!ud.goal[x.key]
      } else if (param.mode == ListMode.Absent) {
        return (ud.current[x.key] || emptyCharacterStatus).level == 0
      } else if (param.mode == ListMode.Fav) {
        const current = ud.current[x.key] || emptyCharacterStatus
        return !!ud.goal[x.key] || (current.elite < 2 && !store.get(atoms.isCharacterFinished(x.key)))
      }
      // if (x.raw.rarity !== 5) return false
      return true
    })
    .sort((a, b) => {
      // const goalA = +!!ud.goal[a.key]
      // const goalB = +!!ud.goal[b.key]

      // if (goalA > goalB) return -1
      // if (goalA < goalB) return 1

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

enum ListMode {
  Fav,
  All,
  WithGoal,
  Absent,
}

interface ListCharactersQueryParam {
  query: string
  mode: ListMode
}

// const queryParamAtom = atom<ListCharactersQueryParam>({ query: '', mode: ListMode.Fav })
const queryParamStorageAtom = atomWithStorage<ListCharactersQueryParam>('cpp_query_param', undefined as any)
const queryParamAtom = atom(
  (get) => {
    const value = Object.assign({}, get(queryParamStorageAtom) || {})
    if (value.query == null) value.query = ''
    if (value.mode == null) value.mode = ListMode.Fav
    return value
  },
  (get, set, value: ListCharactersQueryParam | SetStateAction<ListCharactersQueryParam>) =>
    set(queryParamStorageAtom, value),
)

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

export function QueryBuilder() {
  const [param, setParam] = useAtom(queryParamAtom)
  const atoms = useInject(UserDataAtomHolder)
  const data = useAtomValue(atoms.dataAtom)
  const goalCount = Object.keys(data.goal).length
  return (
    <>
      <QuerySearchBox />
      <Button
        minimal={true}
        active={param.mode == ListMode.Fav}
        text="想看的"
        onClick={() => setParam((x) => ({ ...x, mode: ListMode.Fav }))}
      />
      <Button
        minimal={true}
        active={param.mode == ListMode.All}
        text="全部"
        onClick={() => setParam((x) => ({ ...x, mode: ListMode.All }))}
      />
      <Button
        minimal={true}
        active={param.mode == ListMode.WithGoal}
        text="计划"
        rightIcon={goalCount > 0 ? <Tag round={true}>{goalCount}</Tag> : undefined}
        onClick={() => setParam((x) => ({ ...x, mode: ListMode.WithGoal }))}
      />
      <Button
        minimal={true}
        active={param.mode == ListMode.Absent}
        text="缺席"
        onClick={() => setParam((x) => ({ ...x, mode: ListMode.Absent }))}
      />
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
          <QueryBuilder />
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
