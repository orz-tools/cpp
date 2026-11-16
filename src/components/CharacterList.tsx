import {
  Button,
  ButtonGroup,
  ContextMenu,
  Menu,
  MenuDivider,
  MenuItem,
  Navbar,
  NonIdealState,
  Popover,
  Spinner,
  Tag,
} from '@blueprintjs/core'
import { useVirtualizer } from '@tanstack/react-virtual'
import deepEqual from 'deep-equal'
import { PrimitiveAtom, useAtom, useAtomValue, useSetAtom } from 'jotai'
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import useEvent from 'react-use-event-hook'
import { search } from 'text-search-engine'
import { Cpp, ListCharactersQueryParam, useAtoms, useCpp, useGameAdapter } from '../Cpp'
import { CharacterStatusPopover } from '../components/CharacterStatusPopover'
import { CachedImg } from '../components/Icons'
import { AppToaster } from '../components/Toaster'
import { useComponents } from '../hooks/useComponents'
import { useRequest } from '../hooks/useRequest'
import { IGameComponent } from './types'
import {
  Assertion,
  FieldConfiguration,
  FieldContext,
  ICharacter,
  IGame,
  QBoolean,
  QNumber,
  QStrings,
  Querier,
  QueryParam,
} from '../pkg/cpp-basic'
import { gt } from '../pkg/gt'
import {
  ListModeAbsent,
  ListModeAll,
  ListModeFav,
  ListModeWithGoal,
  PredefinedGameQueryPrefix,
  SavedQueryPrefix,
  compileQuery,
  createListQuerier,
  isCustomQuery,
} from './characterQuery'
import { QueryEditor, queryEditorStaleAtom, useQueryEditorToggle } from './queryEditor/QueryEditor'

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
            <ButtonGroup
              variant="minimal"
              style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}
            >
              <>
                <span style={{ marginLeft: 10 }}>{gt.gettext('角色计划排序')}</span>
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
                  if (shouldRefresh) setParam((e) => ({ ...e }))
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
                  if (shouldRefresh) setParam((e) => ({ ...e }))
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
                  if (shouldRefresh) setParam((e) => ({ ...e }))
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
                  if (shouldRefresh) setParam((e) => ({ ...e }))
                }}
              />
            </ButtonGroup>
            <MenuDivider />
          </>
        ) : null}
        <MenuItem
          icon={'duplicate'}
          text={gt.gettext('复制角色名')}
          onClick={() => {
            navigator.clipboard.writeText(character.name).then(
              async () =>
                (await AppToaster).show({
                  icon: 'tick',
                  intent: 'success',
                  message: gt.gettext('已复制「%s」').replaceAll('%s', character.name),
                }),
              async () =>
                (await AppToaster).show({
                  icon: 'error',
                  intent: 'danger',
                  message: gt.gettext('无法写入剪贴板'),
                }),
            )
          }}
        />
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
          <a role="menuitem" tabIndex={0} className="bp6-menu-item cpp-char-menu-char">
            <>
              <span className="bp6-menu-item-icon cpp-char-avatar">
                <CachedImg
                  src={character.avatar}
                  width={'100%'}
                  height={'100%'}
                  alt={character.key}
                  title={character.key}
                />
                {c.renderCharacterAvatarBadge && !uda.isAbsentCharacter(character, currentCharacter)
                  ? c.renderCharacterAvatarBadge(currentCharacter, character)
                  : null}
              </span>
              <div className="bp6-fill" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div className="bp6-text-overflow-ellipsis" title={character.name}>
                  {character.name}
                </div>
                <div
                  className="bp6-text-overflow-ellipsis"
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
            className="bp6-menu-item cpp-char-menu-status cpp-char-menu-status-current"
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
            className="bp6-menu-item cpp-char-menu-status cpp-char-menu-status-goal"
            style={{ opacity: finished ? 0 : goalSame ? 0.25 : 1 }}
          >
            {render(goalCharacter, character, currentCharacter, goalSame)}
          </a>
        </Popover>
      </li>
    )
  },
)

function buildMatcher(query: string, strict: boolean = false): (x: string) => boolean {
  const trimmed = query.toLowerCase().trim()
  if (!trimmed) return () => true

  {
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
  }

  {
    const match = query.match(/^"(.+)"$/)
    if (match) {
      const q = match[1].toLowerCase().trim()
      return (x: string) => x.toLowerCase().includes(q)
    }
  }

  if (strict) {
    return (x: string) => x.toLowerCase().includes(trimmed)
  }

  return (x: string) => !!search(x, query)
}

function wrapQueryWithQuickFilter(query: QueryParam, field?: Record<string, any>, valids?: Record<string, string>) {
  if (!field) return query
  const keys = Object.keys(field)
  if (keys.length === 0) return query

  if (!valids) valids = {}
  const extra: Assertion[] = []
  for (const [k, v] of Object.entries(field)) {
    const op = Object.prototype.hasOwnProperty.call(valids, k) ? valids[k] : null
    if (op == null) continue
    extra.push({ _: 'field', field: k, op: op, operand: v })
  }
  if (extra.length === 0) return query

  // 已保存的过滤器来自 immer 冻结的用户数据，不能就地改
  const base = !query.where ? [] : query.where._ === '&&' ? query.where.operand : [query.where]
  return { ...query, where: { _: '&&', operand: [...base, ...extra] } } satisfies QueryParam
}

export const useQuickFilter = (field: string, value: any) => {
  const [param, setParam] = useAtom(useCpp().queryParamAtom)
  const quick = param.quick || {}
  const current = Object.prototype.hasOwnProperty.call(quick, field) ? quick[field] : undefined
  return {
    active: current === value,
    current: current,
    toggle: useEvent(() => {
      setParam((x) => {
        const quick = x.quick || {}
        const current = quick[field]
        if (current === value) {
          const nq = { ...quick }
          delete nq[field]
          return { ...x, quick: nq }
        }
        return { ...x, quick: { ...quick, [field]: value } }
      })
    }),
  }
}

async function listCharactersQuery<G extends IGame>(cpp: Cpp<G>, param: ListCharactersQueryParam) {
  await Promise.resolve()

  const ga = cpp.gameAdapter
  const store = cpp.store
  const atoms = cpp.atoms.atoms
  const ud = store.get(atoms.rootAtom)
  const uda = ga.getUserDataAdapter()

  const emptyCharacterStatus = uda.getFrozenEmptyCharacterStatus()

  const query = createListQuerier(
    cpp,
    wrapQueryWithQuickFilter(compileQuery(param.query, cpp), param.quick, cpp.gameComponent.quickFilters),
  )

  const matcher = buildMatcher(param.search)
  const strictMatcher = buildMatcher(param.search, true)

  query.execute(
    (function* () {
      for (const x of uda.getAllCharacterIds()) {
        const character = ga.getCharacter(x)
        if (!(matcher(character.name) || matcher(character.appellation) || strictMatcher(character.key))) continue
        yield { character, current: ud.current[character.key] || emptyCharacterStatus, goal: ud.goal[character.key] }
      }
    })(),
  )

  return { query: query, result: query.result }
}

type ExtraField = NonNullable<IGameComponent['extraFields']>[string]

const fallbackExtraFields = new Map<FieldConfiguration<any, any, any, any>, ExtraField>()

// 14px 等宽字体下 "100.00%" 宽约 59px，加上菜单项左右各 8px 内边距
export const percentageColumnWidth = 76

const fallbackNumberStyle: React.CSSProperties = {
  fontFamily: 'monospace',
  textAlign: 'right',
}

function createFallbackExtraField(id: string, config: FieldConfiguration<any, any, any, any>): ExtraField {
  const labelOf = (v: any) => {
    const option = config.options?.().find((x) => x.value === v)
    return option ? String(option.label) : String(v)
  }
  switch (config.type) {
    case QNumber:
      return createSimpleExtraField(
        id,
        config.format === 'percent' ? percentageColumnWidth : 65,
        (v: number) => {
          if (Number.isNaN(v)) return '—'
          if (config.format === 'percent') return `${(v * 100).toFixed(2)}%`
          return labelOf(v)
        },
        fallbackNumberStyle,
      )
    case QBoolean:
      return createSimpleExtraField(id, 65, (v: boolean) =>
        v ? gt.pgettext('query value', '是') : gt.pgettext('query value', '否'),
      )
    case QStrings:
      return createSimpleExtraField(id, 65, (v: string[]) => v.map(labelOf).join(gt.pgettext('list separator', '、')))
    default:
      return createSimpleExtraField(id, 65, labelOf)
  }
}

/** 游戏注册了渲染器的字段用它，其余可查询的字段用通用回退 */
function getExtraField(id: string, query: Querier<any, any>, cpp: Cpp<any>): ExtraField | undefined {
  const registered = cpp.gameComponent.extraFields
  if (registered && Object.prototype.hasOwnProperty.call(registered, id)) return registered[id]
  if (id === query.param.join) return undefined
  const config = query.fields.get(id)
  if (!config) return undefined
  let field = fallbackExtraFields.get(config)
  if (!field) {
    field = createFallbackExtraField(id, config)
    fallbackExtraFields.set(config, field)
  }
  return field
}

function getResponseExtraWidth(input: Awaited<ReturnType<typeof listCharactersQuery>> | undefined, cpp: Cpp<any>) {
  if (!input) return 0
  let width = 0
  for (const x of getResponseExtraFields(input)) {
    width += getExtraField(x, input.query, cpp)?.width ?? 0
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
      <div className="bp6-input-group">
        {!empty ? (
          <Button
            variant="minimal"
            size="small"
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
          <span
            className="bp6-icon bp6-icon-search"
            onClick={() => {
              ref?.current?.focus()
            }}
            style={{
              pointerEvents: 'none',
            }}
          ></span>
        )}
        <input
          style={{ width: active || !empty ? '200px' : '60px' }}
          className="bp6-input"
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
          // title={['/.../ 正则表达式，大小写敏感', '/.../i 正则表达式，大小写不敏感', '"..." 精确匹配'].join('\n')}
        />
      </div>
    </>
  )
})

export function useCustomQueryActive() {
  const param = useAtomValue(useCpp().queryParamAtom)
  return isCustomQuery(param.query)
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
  const activeSaved = param.query.startsWith(SavedQueryPrefix)
    ? data.savedQueries.find((x) => x.id === param.query.slice(SavedQueryPrefix.length))
    : undefined
  const activeName = activePredefined ? String(activePredefined.name) : activeSaved?.name
  const goTo = (query: string) => setParam((x) => ({ ...x, query, source: undefined }))

  return (
    <>
      <QuerySearchBox />
      <Button
        variant="minimal"
        active={param.query === ListModeFav}
        text={gt.pgettext('predefined view name', '想看的')}
        onClick={() => goTo(ListModeFav)}
        style={{ flexShrink: 0 }}
      />
      <Button
        variant="minimal"
        active={param.query === ListModeAll}
        text={gt.pgettext('predefined view name', '全部')}
        onClick={() => goTo(ListModeAll)}
        style={{ flexShrink: 0 }}
      />
      <Button
        variant="minimal"
        active={param.query === ListModeWithGoal}
        text={gt.pgettext('predefined view name', '计划')}
        endIcon={goalCount > 0 ? <Tag round={true}>{goalCount}</Tag> : undefined}
        onClick={() => goTo(ListModeWithGoal)}
        style={{ flexShrink: 0 }}
      />
      <Button
        variant="minimal"
        active={param.query === ListModeAbsent}
        text={gt.pgettext('predefined view name', '缺席')}
        onClick={() => goTo(ListModeAbsent)}
        style={{ flexShrink: 0 }}
      />
      {activeName ? (
        <Button
          variant="minimal"
          active={true}
          text={activeName}
          title={activeName}
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
  const savedQueries = useAtomValue(useAtoms().dataAtom).savedQueries
  const editor = useQueryEditorToggle()
  const goTo = (query: string) => setParam((x) => ({ ...x, query, source: undefined }))

  return (
    <>
      <Popover
        usePortal={true}
        minimal={true}
        placement="bottom-end"
        content={
          <Menu className="cpp-query-menu">
            {savedQueries.length > 0 ? (
              <>
                <MenuDivider title={gt.pgettext('query menu', '我的过滤器')} />
                {savedQueries.map((x) => (
                  <MenuItem
                    key={x.id}
                    active={param.query === SavedQueryPrefix + x.id}
                    text={x.name}
                    onClick={() => goTo(SavedQueryPrefix + x.id)}
                  />
                ))}
              </>
            ) : null}
            <MenuDivider title={gt.pgettext('query menu', '练度统计')} />
            {Object.entries(pgq).map(([k, v]) => {
              return (
                <MenuItem
                  key={k}
                  active={param.query === PredefinedGameQueryPrefix + k}
                  text={v.name}
                  onClick={() => goTo(PredefinedGameQueryPrefix + k)}
                />
              )
            })}
          </Menu>
        }
      >
        <Button
          variant="minimal"
          icon={'chevron-down'}
          title={gt.pgettext('query menu', '更多视图')}
          aria-label={gt.pgettext('query menu', '更多视图')}
        />
      </Popover>
      <Button
        variant="minimal"
        icon={'edit'}
        active={editor.open}
        title={editor.open ? gt.pgettext('query menu', '关闭编辑') : gt.pgettext('query menu', '编辑过滤条件')}
        aria-label={editor.open ? gt.pgettext('query menu', '关闭编辑') : gt.pgettext('query menu', '编辑过滤条件')}
        aria-pressed={editor.open}
        onClick={editor.toggle}
      />
    </>
  )
})

export const QuickFilterBuilder = memo(() => {
  const { QuickFilterBuilder } = useComponents()

  return (
    <>
      {QuickFilterBuilder ? (
        <Navbar
          className="cpp-quick-filter"
          style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            height: 'auto',
            padding: 0,
            marginTop: 1,
            marginBottom: 2,
          }}
        >
          <QuickFilterBuilder />
        </Navbar>
      ) : null}
    </>
  )
})

export const CharacterList = memo(({ charExtraWidthAtom }: { charExtraWidthAtom: PrimitiveAtom<number> }) => {
  const param = useAtomValue(useCpp().queryParamAtom)
  const stale = useAtomValue(queryEditorStaleAtom)

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
            const field = getExtraField(x, response.query, cpp)
            return field ? ([x, field.C] as const) : undefined
          })
        : [],
    [cpp, extraFields, response],
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
      <Navbar
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 15,
          paddingLeft: '0.5em',
          paddingRight: '0.5em',
        }}
      >
        <Navbar.Group style={{ flexShrink: 1 }}>
          <QueryBuilder />
        </Navbar.Group>
        <Navbar.Group style={{ flexShrink: 0 }}>
          <QueryBuilderRight />
          <Button
            icon={loading ? <Spinner size={16} /> : 'refresh'}
            variant="minimal"
            disabled={loading}
            onClick={refresh}
          />
        </Navbar.Group>
      </Navbar>
      <QueryEditor />
      <QuickFilterBuilder />
      {error ? (
        <NonIdealState title={gt.gettext('查询失败')} icon={'warning-sign'}>
          <pre style={{ margin: 0 }}>{error.message}</pre>
        </NonIdealState>
      ) : (
        <Menu
          className={stale ? 'cpp-char-list-stale' : undefined}
          style={{ flex: 1, flexShrink: 1, overflow: 'auto' }}
          ulRef={parentRef}
        >
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
                  key={result[index].key}
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
        className={`bp6-menu-item ${className || ''}`}
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
          <div className="bp6-fill" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div className="bp6-text-overflow-ellipsis" title={text} style={style}>
              {text}
            </div>
          </div>
        </CharacterListColumn>
      )
    }),
  }
}
