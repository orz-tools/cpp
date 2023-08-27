import {
  Alignment,
  Button,
  ButtonGroup,
  ContextMenu,
  Menu,
  MenuDivider,
  Navbar,
  Popover,
  Spinner,
  Tag,
} from '@blueprintjs/core'
import { useVirtualizer } from '@tanstack/react-virtual'
import deepEqual from 'deep-equal'
import { SetStateAction, atom, useAtom, useAtomValue, useSetAtom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import React, { useEffect, useMemo, useRef } from 'react'
import useEvent from 'react-use-event-hook'
import { Cpp, useAtoms, useCpp, useGameAdapter } from '../Cpp'
import { CharacterStatusPopover } from '../components/CharacterStatusPopover'
import { CachedImg } from '../components/Icons'
import { useComponents } from '../hooks/useComponents'
import { useRequest } from '../hooks/useRequest'
import { ICharacter, IGame } from '../pkg/cpp-basic'

export function Hide({
  children,
  hide,
  alreadyHide,
}: React.PropsWithChildren<{ hide: boolean; alreadyHide: boolean }>) {
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

export function renderCharacterStatus<G extends IGame>(
  status: G['characterStatus'],
  character: ICharacter,
  current?: G['characterStatus'],
  alreadyHide = false,
) {
  alreadyHide.toString()
  const s = Object.entries(status)
    .map(([k, v]) => {
      return `${k}:${JSON.stringify(v)}`
    })
    .join(', ')
  return (
    <>
      <div style={{ height: 40, width: 200, zIndex: 0, overflow: 'hidden' }}>
        <pre
          style={{
            margin: 0,
            padding: 0,
            color: 'white',
            wordBreak: 'break-all',
            whiteSpace: 'pre-wrap',
            width: '100%',
            height: '100%',
            overflow: 'hidden',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
          }}
        >
          {s}
        </pre>
      </div>
    </>
  )
}

export function CharacterContextMenu({ character, alwaysSorting }: { character: ICharacter; alwaysSorting?: boolean }) {
  const { CharacterContextMenuItems } = useComponents()
  const atoms = useAtoms<IGame>()
  const setData = useSetAtom(atoms.dataAtom)
  const [param, setParam] = useAtom(queryParamAtom)
  const shouldRefresh = param.mode === ListMode.WithGoal

  return (
    <Menu>
      {alwaysSorting || (alwaysSorting !== false && param.mode === ListMode.WithGoal) ? (
        <>
          <ButtonGroup minimal={true} style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
            <>
              <span style={{ marginLeft: 10 }}>{'角色计划排序'}</span>
              <div style={{ flex: 1 }} />
            </>
            <Button
              icon={'double-chevron-up'}
              onClick={() => {
                setData('modify', (d) => {
                  const index = d.goalOrder.indexOf(character.key)
                  if (index >= 0) {
                    d.goalOrder.splice(index, 1)
                  }
                  d.goalOrder.unshift(character.key)
                })
                shouldRefresh && setParam((e) => ({ ...e }))
              }}
            />
            <Button
              icon={'chevron-up'}
              onClick={() => {
                setData('modify', (d) => {
                  const index = d.goalOrder.indexOf(character.key)
                  if (index >= 1) {
                    d.goalOrder.splice(index, 1)
                    d.goalOrder.splice(index - 1, 0, character.key)
                  }
                })
                shouldRefresh && setParam((e) => ({ ...e }))
              }}
            />
            <Button
              icon={'chevron-down'}
              onClick={() => {
                setData('modify', (d) => {
                  const index = d.goalOrder.indexOf(character.key)
                  if (index >= 0 && index < d.goalOrder.length - 1) {
                    d.goalOrder.splice(index, 1)
                    d.goalOrder.splice(index + 1, 0, character.key)
                  }
                })
                shouldRefresh && setParam((e) => ({ ...e }))
              }}
            />
            <Button
              icon={'double-chevron-down'}
              onClick={() => {
                setData('modify', (d) => {
                  const index = d.goalOrder.indexOf(character.key)
                  if (index >= 0) {
                    d.goalOrder.splice(index, 1)
                  }
                  d.goalOrder.push(character.key)
                })
                shouldRefresh && setParam((e) => ({ ...e }))
              }}
            />
          </ButtonGroup>
          <MenuDivider />
        </>
      ) : null}
      {CharacterContextMenuItems ? <CharacterContextMenuItems character={character} /> : null}
    </Menu>
  )
}

function CharacterMenu<G extends IGame>({ character, style }: { character: ICharacter; style?: React.CSSProperties }) {
  const atoms = useAtoms<G>()
  const ga = useGameAdapter<G>()
  const uda = ga.getUserDataAdapter()
  const charId = character.key
  const currentCharacter = useAtomValue(atoms.currentCharacter(charId))
  const goalCharacter = useAtomValue(atoms.goalCharacter(charId))

  const goalSame = useMemo(
    () => deepEqual(currentCharacter, goalCharacter, { strict: true }),
    [currentCharacter, goalCharacter],
  )
  const finished = useAtomValue(atoms.isCharacterFinished(charId))
  const c = useComponents()
  const render = c.renderCharacterStatus || renderCharacterStatus
  const CSP = c.CharacterStatusPopover || CharacterStatusPopover

  return (
    <li
      role="none"
      className={[
        'cpp-char-menu-master',
        `cpp-char-rarity-${character.rarity}`,
        ...(character.characterViewExtraClass || []),
      ].join(' ')}
      style={style}
    >
      <ContextMenu content={<CharacterContextMenu character={character} />}>
        <a role="menuitem" tabIndex={0} className="bp5-menu-item cpp-char-menu-char">
          <>
            <span className="bp5-menu-item-icon cpp-char-avatar">
              <CachedImg
                src={character.avatar}
                width={'100%'}
                height={'100%'}
                alt={character.key}
                title={character.key}
              />
            </span>
            <div className="bp5-fill" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div className="bp5-text-overflow-ellipsis" title={character.name}>
                {character.name}
              </div>
              <div
                className="bp5-text-overflow-ellipsis"
                title={character.appellation}
                style={{ fontWeight: 'normal', opacity: 0.75 }}
              >
                {character.appellation}
              </div>
            </div>
          </>
        </a>
      </ContextMenu>
      <Popover
        usePortal={true}
        popoverClassName={'cpp-popover'}
        content={<CSP character={character} isGoal={false} />}
        placement="bottom"
      >
        <a
          role="menuitem"
          tabIndex={0}
          className="bp5-menu-item cpp-char-menu-status cpp-char-menu-status-current"
          style={{ opacity: uda.isAbsentCharacter(character, currentCharacter) ? 0.25 : 1 }}
        >
          {render(currentCharacter, character)}
        </a>
      </Popover>
      <Popover
        usePortal={true}
        popoverClassName={'cpp-popover'}
        content={<CSP character={character} isGoal={true} />}
        placement="bottom"
      >
        <a
          role="menuitem"
          tabIndex={0}
          className="bp5-menu-item cpp-char-menu-status cpp-char-menu-status-goal"
          style={{ opacity: finished ? 0 : goalSame ? 0.25 : 1 }}
        >
          {render(goalCharacter, character, currentCharacter, goalSame)}
        </a>
      </Popover>
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

async function listCharactersQuery<G extends IGame>(cpp: Cpp<G>, param: ListCharactersQueryParam) {
  await Promise.resolve()

  const ga = cpp.gameAdapter
  const store = cpp.store
  const atoms = cpp.atoms.atoms
  const ud = store.get(atoms.rootAtom)
  const uda = ga.getUserDataAdapter()

  const matcher = buildMatcher(param.query)
  const realOrder = store.get(atoms.goalOrder)
  const emptyCharacterStatus = uda.getFrozenEmptyCharacterStatus()

  return Object.values(uda.getAllCharacterIds())
    .map((x) => ga.getCharacter(x))
    .filter((x) => {
      if (!(matcher(x.name) || matcher(x.appellation) || matcher(x.key))) return false

      if (param.mode === ListMode.WithGoal) {
        return !!ud.goal[x.key]
      } else if (param.mode === ListMode.Absent) {
        return uda.isAbsentCharacter(x, ud.current[x.key] || emptyCharacterStatus)
      } else if (param.mode === ListMode.Fav) {
        const current = ud.current[x.key] || emptyCharacterStatus
        return !!ud.goal[x.key] || (uda.isFavCharacter(x, current) && !store.get(atoms.isCharacterFinished(x.key)))
      }
      return true
    })
    .sort((a, b) => {
      if (param.mode === ListMode.WithGoal) {
        const aa = realOrder.indexOf(a.key)
        const bb = realOrder.indexOf(b.key)
        return aa - bb
      }

      const stA = ud.current[a.key] || emptyCharacterStatus
      const stB = ud.current[b.key] || emptyCharacterStatus

      return uda.compareCharacter(a, b, stA, stB)
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
      <div className="bp5-input-group {{.modifier}}">
        <span className="bp5-icon bp5-icon-search"></span>
        <input
          style={{ width: '200px' }}
          className="bp5-input"
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

function QueryBuilder() {
  const [param, setParam] = useAtom(queryParamAtom)
  const atoms = useAtoms()
  const data = useAtomValue(atoms.dataAtom)
  const goalCount = Object.keys(data.goal).length
  return (
    <>
      <QuerySearchBox />
      <Button
        minimal={true}
        active={param.mode === ListMode.Fav}
        text="想看的"
        onClick={() => setParam((x) => ({ ...x, mode: ListMode.Fav }))}
      />
      <Button
        minimal={true}
        active={param.mode === ListMode.All}
        text="全部"
        onClick={() => setParam((x) => ({ ...x, mode: ListMode.All }))}
      />
      <Button
        minimal={true}
        active={param.mode === ListMode.WithGoal}
        text="计划"
        rightIcon={goalCount > 0 ? <Tag round={true}>{goalCount}</Tag> : undefined}
        onClick={() => setParam((x) => ({ ...x, mode: ListMode.WithGoal }))}
      />
      <Button
        minimal={true}
        active={param.mode === ListMode.Absent}
        text="缺席"
        onClick={() => setParam((x) => ({ ...x, mode: ListMode.Absent }))}
      />
    </>
  )
}

export function CharacterList() {
  const { CharacterImportButton } = useComponents()
  const param = useAtomValue(queryParamAtom)

  const cpp = useCpp()
  const { send, response, loading } = useRequest(listCharactersQuery)

  const refresh = useEvent(() => {
    send(cpp, param)
  })

  useEffect(() => refresh(), [param, refresh])

  const list = response || []

  const parentRef = useRef<HTMLUListElement>(null)

  const rowVirtualizer = useVirtualizer({
    count: list.length,
    getScrollElement: () => parentRef.current,
    getItemKey: (index) => list[index].key,
    overscan: 5,
    estimateSize: () => 50,
  })

  const remeasure = useEvent(() => {
    rowVirtualizer.measure()
  })

  useEffect(() => {
    remeasure()
  }, [param, remeasure])

  return (
    <>
      <Navbar>
        <Navbar.Group align={Alignment.RIGHT}>
          {CharacterImportButton && <CharacterImportButton />}
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
      <Menu style={{ flex: 1, flexShrink: 1, overflow: 'auto' }} ulRef={parentRef}>
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const index = virtualRow.index
            return (
              <CharacterMenu
                key={virtualRow.key}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                character={list[index]}
              />
            )
          })}
        </div>
      </Menu>
    </>
  )
}
