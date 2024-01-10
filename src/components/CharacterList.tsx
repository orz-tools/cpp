import {
  Button,
  ButtonGroup,
  Card,
  ContextMenu,
  Elevation,
  Menu,
  MenuDivider,
  MenuItem,
  Navbar,
  NonIdealState,
  Popover,
  Spinner,
  Tag,
  TextArea,
} from '@blueprintjs/core'
import { useVirtualizer } from '@tanstack/react-virtual'
import deepEqual from 'deep-equal'
import { PrimitiveAtom, useAtom, useAtomValue, useSetAtom } from 'jotai'
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import useEvent from 'react-use-event-hook'
import { Cpp, ListCharactersQueryParam, useAtoms, useCpp, useGameAdapter } from '../Cpp'
import { CharacterStatusPopover } from '../components/CharacterStatusPopover'
import { CachedImg } from '../components/Icons'
import { useComponents } from '../hooks/useComponents'
import { useRequest } from '../hooks/useRequest'
import {
  ExtraCharacterQuery,
  FieldContext,
  ICharacter,
  IGame,
  QBoolean,
  QNumber,
  QString,
  Querier,
  QueryParam,
} from '../pkg/cpp-basic'

export const Hide = memo(
  ({ children, hide, alreadyHide }: React.PropsWithChildren<{ hide: boolean; alreadyHide: boolean }>) => {
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
  },
)

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

export const CharacterContextMenu = memo(
  ({ character, alwaysSorting }: { character: ICharacter; alwaysSorting?: boolean }) => {
    const { CharacterContextMenuItems } = useComponents()
    const atoms = useAtoms<IGame>()
    const setData = useSetAtom(atoms.dataAtom)
    const [param, setParam] = useAtom(useCpp().queryParamAtom)
    const shouldRefresh = param.query === ListModeWithGoal

    return (
      <Menu>
        {alwaysSorting || (alwaysSorting !== false && param.query === ListModeWithGoal) ? (
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
  },
)

const CharacterMenu = memo(
  <G extends IGame>({
    character,
    style,
    item,
    renderExtraFields,
  }: {
    character: ICharacter
    style?: React.CSSProperties
    item: FieldContext<G, ICharacter, any>
    renderExtraFields?: (item: FieldContext<G, ICharacter, any>) => React.ReactNode
  }) => {
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
        {renderExtraFields ? renderExtraFields(item) : null}
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
  },
)

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

class CppCharacterListQuery extends ExtraCharacterQuery<IGame, ICharacter> {
  public constructor(private readonly cpp: Cpp<any>) {
    super()

    const uda = cpp.gameAdapter.getUserDataAdapter()
    const store = cpp.store
    const atoms = cpp.atoms.atoms
    const realOrder = store.get(atoms.goalOrder)

    this.addField('id', '内部代号', QString, ({ character }) => character.key).addAlias('key')

    this.addStatusField('own', '持有', QBoolean, ({ character, status }) => !uda.isAbsentCharacter(character, status))

    this.addField('goalOrder', '计划顺序', QNumber, ({ character }) => {
      const o = realOrder.indexOf(character.key)
      if (o < 0) return Number.MAX_SAFE_INTEGER
      return o
    })

    this.addField('finished', '已全面养成', QBoolean, ({ character }) => {
      return store.get(atoms.isCharacterFinished(character.key))
    })
  }
}

function stringifyQuery(query: QueryParam): string {
  return JSON.stringify(query, null)
}

function compileQuery(query: string, cpp: Cpp<any>): QueryParam {
  const defaultQueryOrder = cpp.gameAdapter.getDefaultCharacterQueryOrder()
  if (query.startsWith(PredefinedQueryPrefix)) {
    if (query === ListModeFav) {
      const fav = cpp.gameAdapter.getFavCharacterQueryWhere()

      return {
        where: {
          _: '||',
          operand: [
            { _: 'field', field: 'goal', op: '==', operand: true },
            {
              _: '&&',
              operand: [...(fav ? [fav] : []), { _: 'field', field: 'finished', op: '==', operand: false }],
            },
          ],
        },
        order: defaultQueryOrder,
      }
    } else if (query === ListModeAll) {
      return {
        order: defaultQueryOrder,
      }
    } else if (query === ListModeWithGoal) {
      return {
        where: {
          _: '&&',
          operand: [{ _: 'field', field: 'goal', op: '==', operand: true }],
        },
        order: [['goalOrder', 'ASC']],
      }
    } else if (query === ListModeAbsent) {
      return {
        where: { _: 'field', field: 'own', op: '==', operand: false },
        order: defaultQueryOrder,
      }
    }
    throw new Error('Invalid predefined query')
  }

  if (query.startsWith(PredefinedGameQueryPrefix)) {
    const pgq = cpp.gameAdapter.getPredefinedQueries()
    const k = query.slice(PredefinedGameQueryPrefix.length)
    if (pgq[k]) return pgq[k].query
    throw new Error('Invalid predefined game query')
  }

  const r = JSON.parse(query)
  if (!r.order) r.order = defaultQueryOrder
  return r
}

async function listCharactersQuery<G extends IGame>(cpp: Cpp<G>, param: ListCharactersQueryParam) {
  await Promise.resolve()

  const ga = cpp.gameAdapter
  const store = cpp.store
  const atoms = cpp.atoms.atoms
  const ud = store.get(atoms.rootAtom)
  const uda = ga.getUserDataAdapter()

  const emptyCharacterStatus = uda.getFrozenEmptyCharacterStatus()

  const rq = ga.getRootCharacterQuery()
  const query = new Querier<G, ICharacter>(rq, compileQuery(param.query, cpp))

  const matcher = buildMatcher(param.search)

  query.addQuery(new CppCharacterListQuery(cpp))

  query.execute(
    (function* () {
      for (const x of uda.getAllCharacterIds()) {
        const character = ga.getCharacter(x)
        if (!(matcher(character.name) || matcher(character.appellation) || matcher(character.key))) continue
        yield { character, current: ud.current[character.key] || emptyCharacterStatus, goal: ud.goal[character.key] }
      }
    })(),
  )

  return { query: query, result: query.result }
}

function getResponseExtraWidth(input: Awaited<ReturnType<typeof listCharactersQuery>> | undefined, cpp: Cpp<any>) {
  if (!cpp.gameComponent.extraFields) return 0

  const fields = getResponseExtraFields(input)
  if (fields.length === 0) return 0

  let width = 0
  for (const x of fields) {
    if (!Object.prototype.hasOwnProperty.call(cpp.gameComponent.extraFields, x)) continue
    width += cpp.gameComponent.extraFields[x].width
  }
  return width
}

function getResponseExtraFields(input: Awaited<ReturnType<typeof listCharactersQuery>> | undefined) {
  if (!input) return []
  const set = new Set<string>()
  if (input.query.param.join) {
    set.add(input.query.param.join)
  }

  if (input.query.param.select) {
    for (const x of input.query.param.select) {
      set.add(x)
    }
  }
  return Array.from(set)
}

const QuerySearchBox = memo(() => {
  const [active, setActive] = useState(false)
  const [param, setParam] = useAtom(useCpp().queryParamAtom)
  const empty = (param.search || '').length === 0
  const ref = useRef<HTMLInputElement>(null)

  return (
    <>
      <div className="bp5-input-group">
        {!empty ? (
          <Button
            minimal
            small
            icon={'cross'}
            onClick={() => {
              setParam((x) => ({ ...x, search: '' }))
              ref?.current?.focus()
            }}
            style={{
              zIndex: 1,
              position: 'absolute',
              top: 0,
              margin: 4,
              padding: 7,
              left: 0,
              width: 16,
              height: 16,
            }}
          />
        ) : (
          <span className="bp5-icon bp5-icon-search"></span>
        )}
        <input
          style={{ width: active || !empty ? '200px' : '60px' }}
          className="bp5-input"
          onFocus={() => setActive(true)}
          onBlur={() => setActive(false)}
          ref={ref}
          type="search"
          dir="auto"
          autoComplete="false"
          autoCapitalize="false"
          autoCorrect="false"
          aria-autocomplete="none"
          spellCheck="false"
          value={param.search}
          onChange={(e) => setParam((x) => ({ ...x, search: e.currentTarget.value }))}
        />
      </div>
    </>
  )
})

const QueryQueryBox = memo(() => {
  const [param, setParam] = useAtom(useCpp().queryParamAtom)
  return (
    <>
      <TextArea
        style={{ flex: 1, border: 0, boxShadow: 'none', maxHeight: '45vh' }}
        value={param.query}
        onChange={(e) => setParam((x) => ({ ...x, query: e.currentTarget.value }))}
        autoCapitalize="false"
        autoCorrect="false"
        spellCheck="false"
      />
    </>
  )
})

const PredefinedQueryPrefix = '#!'
const ListModeFav = PredefinedQueryPrefix + 'fav'
const ListModeAll = PredefinedQueryPrefix + 'all'
const ListModeWithGoal = PredefinedQueryPrefix + 'withGoal'
const ListModeAbsent = PredefinedQueryPrefix + 'absent'
const validPredefinedQueries = [ListModeFav, ListModeAll, ListModeWithGoal, ListModeAbsent]

const PredefinedGameQueryPrefix = '#?'

function useCustomQueryActive() {
  const param = useAtomValue(useCpp().queryParamAtom)
  return !validPredefinedQueries.includes(param.query) && !param.query.startsWith(PredefinedGameQueryPrefix)
}

const QueryBuilder = memo(() => {
  const cpp = useCpp()
  const [pgq, pgqKeys] = useMemo(() => {
    const pgq = cpp.gameAdapter.getPredefinedQueries()
    return [pgq, Object.keys(pgq)]
  }, [cpp])
  const [param, setParam] = useAtom(useCpp().queryParamAtom)
  const atoms = useAtoms()
  const data = useAtomValue(atoms.dataAtom)
  const goalCount = Object.keys(data.goal).length
  const activePredefined =
    param.query.startsWith(PredefinedGameQueryPrefix) &&
    pgqKeys.includes(param.query.slice(PredefinedGameQueryPrefix.length))
      ? pgq[param.query.slice(PredefinedGameQueryPrefix.length)]
      : undefined

  return (
    <>
      <QuerySearchBox />
      <Button
        minimal={true}
        active={param.query === ListModeFav}
        text="想看的"
        onClick={() => setParam((x) => ({ ...x, query: ListModeFav }))}
        style={{ flexShrink: 0 }}
      />
      <Button
        minimal={true}
        active={param.query === ListModeAll}
        text="全部"
        onClick={() => setParam((x) => ({ ...x, query: ListModeAll }))}
        style={{ flexShrink: 0 }}
      />
      <Button
        minimal={true}
        active={param.query === ListModeWithGoal}
        text="计划"
        rightIcon={goalCount > 0 ? <Tag round={true}>{goalCount}</Tag> : undefined}
        onClick={() => setParam((x) => ({ ...x, query: ListModeWithGoal }))}
        style={{ flexShrink: 0 }}
      />
      <Button
        minimal={true}
        active={param.query === ListModeAbsent}
        text="缺席"
        onClick={() => setParam((x) => ({ ...x, query: ListModeAbsent }))}
        style={{ flexShrink: 0 }}
      />
      {activePredefined ? (
        <Button
          minimal={true}
          active={true}
          text={activePredefined.name}
          title={activePredefined.name}
          onClick={() => {}}
          style={{ flexShrink: 42 }}
          className="cpp-overflow-button"
        />
      ) : null}
    </>
  )
})

const QueryBuilderRight = memo(() => {
  const cpp = useCpp()
  const pgq = useMemo(() => cpp.gameAdapter.getPredefinedQueries(), [cpp])
  const [param, setParam] = useAtom(useCpp().queryParamAtom)
  const custom = useCustomQueryActive()
  if (custom) dismissed = true

  return (
    <>
      <Popover
        usePortal={true}
        minimal={true}
        placement="bottom-end"
        content={
          <Menu>
            {Object.entries(pgq).map(([k, v]) => {
              return (
                <MenuItem
                  key={k}
                  active={param.query === PredefinedGameQueryPrefix + k}
                  text={v.name}
                  onClick={() => {
                    setParam((x) => ({ ...x, query: PredefinedGameQueryPrefix + k }))
                  }}
                />
              )
            })}
          </Menu>
        }
      >
        <Button minimal={true} icon={'chevron-down'} />
      </Popover>
      <Button
        minimal={true}
        icon={'edit'}
        active={custom}
        onClick={() => {
          if (
            dismissed ||
            (!dismissed && confirm('继续操作将打开自定义查询面板。\n\n警告：仍在开发中，查询语法将随时发生变化。'))
          ) {
            setParam((x) => ({ ...x, query: stringifyQuery(compileQuery(x.query, cpp)) }))
          }
        }}
      />
    </>
  )
})

let dismissed = false

const QueryEditor = memo(() => {
  const custom = useCustomQueryActive()
  return custom ? (
    <>
      <Card elevation={Elevation.ONE} style={{ marginBottom: 3, padding: 0, display: 'flex' }}>
        <QueryQueryBox />
      </Card>
    </>
  ) : null
})

export const CharacterList = memo(({ charExtraWidthAtom }: { charExtraWidthAtom: PrimitiveAtom<number> }) => {
  const param = useAtomValue(useCpp().queryParamAtom)

  const cpp = useCpp()
  const { send, response, loading, error } = useRequest(listCharactersQuery)

  const refresh = useEvent(() => {
    send(cpp, param)
  })

  useEffect(() => refresh(), [param, refresh])
  useEffect(() => {
    if (error) console.error('Failed to query', error)
  }, [error])

  const query = response?.query
  const result = response?.result || []
  const list = (response?.result || []).map((x) => x.character)
  const extraFields = useMemo(() => (response ? getResponseExtraFields(response) || [] : []), [response])
  const extraFieldRenderers = useMemo(
    () =>
      response
        ? extraFields.map((x) => {
            if (!Object.prototype.hasOwnProperty.call(cpp.gameComponent.extraFields, x)) return undefined
            return [x, cpp.gameComponent.extraFields![x].C] as const
          })
        : [],
    [cpp.gameComponent.extraFields, extraFields, response],
  )

  const renderExtraFields = useCallback(
    (item: FieldContext<IGame, ICharacter, any>) => {
      return extraFieldRenderers.map((x) => {
        if (!x) return null
        const C = x[1]
        return (
          <div key={x[0]}>
            <C query={query!} context={item} />
          </div>
        )
      })
    },
    [extraFieldRenderers, query],
  )

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

  const setCharExtraWidth = useSetAtom(charExtraWidthAtom)
  useEffect(() => {
    return () => setCharExtraWidth(0)
  }, [setCharExtraWidth])

  useEffect(() => {
    setCharExtraWidth(getResponseExtraWidth(response, cpp))
  }, [response, cpp, setCharExtraWidth])

  return (
    <>
      <Navbar style={{ display: 'flex', justifyContent: 'space-between', gap: 15 }}>
        <Navbar.Group style={{ flexShrink: 1 }}>
          <QueryBuilder />
        </Navbar.Group>
        <Navbar.Group style={{ flexShrink: 0 }}>
          <QueryBuilderRight />
          <Button
            icon={loading ? <Spinner size={16} /> : 'refresh'}
            minimal={true}
            disabled={loading}
            onClick={refresh}
          />
        </Navbar.Group>
      </Navbar>
      <QueryEditor />
      {error ? (
        <NonIdealState title={'查询失败'} icon={'warning-sign'}>
          <pre style={{ margin: 0 }}>{error.message}</pre>
        </NonIdealState>
      ) : (
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
                  key={index}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  character={list[index]}
                  item={result[index]}
                  renderExtraFields={renderExtraFields}
                />
              )
            })}
          </div>
        </Menu>
      )}
    </>
  )
})

export const CharacterListColumn = memo(
  ({
    children,
    width,
    className,
  }: React.PropsWithChildren<{
    width: number
    className?: string
  }>) => {
    return (
      <div
        role="menuitem"
        tabIndex={0}
        className={`bp5-menu-item ${className || ''}`}
        style={{
          display: 'flex',
          flexDirection: 'row',
          width: width,
          flex: 0,
          flexShrink: 0,
          minWidth: width,
          maxWidth: width,
          height: '100%',
          maxHeight: '100%',
          overflow: 'hidden',
        }}
      >
        {children}
      </div>
    )
  },
)

export function createSimpleExtraField<
  G extends IGame = IGame,
  C extends ICharacter = ICharacter,
  Args extends any[] = any,
>(
  field: string,
  width: number,
  formatter: (value: any, query: Querier<G, C>, context: FieldContext<G, C, Args>) => string,
  style: React.CSSProperties = {},
) {
  return {
    width: width,
    C: memo(({ context, query }: { query: Querier<G, C>; context: FieldContext<G, C, Args> }) => {
      const value = query.getFieldValue(field, context)
      const text = formatter(value, query, context)

      return (
        <CharacterListColumn width={width}>
          <div className="bp5-fill" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div className="bp5-text-overflow-ellipsis" title={text} style={style}>
              {text}
            </div>
          </div>
        </CharacterListColumn>
      )
    }),
  }
}
