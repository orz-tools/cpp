import {
  Button,
  ButtonGroup,
  Classes,
  ContextMenu,
  Menu,
  MenuDivider,
  MenuItem,
  Navbar,
  NonIdealState,
  Popover,
  PopoverProps,
  PopupKind,
  Spinner,
  Tag,
} from '@blueprintjs/core'
import { useVirtualizer } from '@tanstack/react-virtual'
import deepEqual from 'deep-equal'
import { PrimitiveAtom, useAtom, useAtomValue, useSetAtom } from 'jotai'
import { selectAtom } from 'jotai/utils'
import { equals } from 'ramda'
import React, { forwardRef, memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import useEvent from 'react-use-event-hook'
import { search } from 'text-search-engine'
import {
  Cpp,
  ListCharactersQueryParam,
  useAtoms,
  useCpp,
  useGameAdapter,
  useGameDataGeneration,
  useGameDataMemo,
  useStore,
} from '../Cpp'
import { CharacterStatusPopover } from '../components/CharacterStatusPopover'
import { CachedImg } from '../components/Icons'
import { AppToaster } from '../components/Toaster'
import { useComponents } from '../hooks/useComponents'
import { useRequest } from '../hooks/useRequest'
import { ListDrag, useListDrag } from './ListDrag'
import { CharacterPlanMenuItems } from './PlanActions'
import { ValueTag } from './Value'
import { useDossierOpenFor, useOpenCharacterDossier } from './dossierHooks'
import { listGaps } from './listDrag'
import { IGameComponent } from './types'
import {
  FieldConfiguration,
  FieldContext,
  ICharacter,
  IGame,
  QBoolean,
  QNumber,
  QStrings,
  Querier,
  QueryFieldEntry,
  listQueryFields,
  resolveField,
} from '../pkg/cpp-basic'
import { fieldLabel } from '../pkg/cpp-basic/queryEditorModel'
import { MoveStep, MoveTarget, followOrder, stepTarget } from '../pkg/cpp-core/planOrder'
import { gt } from '../pkg/gt'
import {
  HoldingAbsent,
  HoldingTrainable,
  ListModeAll,
  ListModeFav,
  ListModeWithGoal,
  PredefinedGameQueryPrefix,
  SavedQueryPrefix,
  compileQuery,
  createListQuerier,
  isCustomQuery,
} from './characterQuery'
import { presetMenu } from './presetMenu'
import { quickFiltersFor, wrapQueryWithQuickFilter } from './quickFilters'
import { ColumnHeader, clampColumnWidth, useColumnWidths } from './queryEditor/ColumnHeader'
import { QueryEditor, queryEditorStaleAtom, useQueryEditorToggle } from './queryEditor/QueryEditor'
import { RosterPin, clearRosterPin, useActiveRosterPin } from './rosterPin'

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

/** 右键菜单最上面那一排：移到最前、上移、下移、移到最后 */
export const SortButtonGroup = ({ label, onMove }: { label: string; onMove: (step: MoveStep) => void }) => (
  <ButtonGroup variant="minimal" style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
    <span style={{ marginLeft: 10 }}>{label}</span>
    <div style={{ flex: 1 }} />
    <Button icon={'double-chevron-up'} onClick={() => onMove('first')} />
    <Button icon={'chevron-up'} onClick={() => onMove('up')} />
    <Button icon={'chevron-down'} onClick={() => onMove('down')} />
    <Button icon={'double-chevron-down'} onClick={() => onMove('last')} />
  </ButtonGroup>
)

export const CharacterContextMenu = memo(
  ({ character, alwaysSorting }: { character: ICharacter; alwaysSorting?: boolean }) => {
    const { CharacterContextMenuItems } = useComponents()
    const atoms = useAtoms<IGame>()
    const store = useStore()
    const param = useAtomValue(useCpp().queryParamAtom)
    const order = useAtomValue(atoms.goalOrder)
    const move = (step: MoveStep) => {
      const target = stepTarget(order, character.key, step)
      if (target) store.set(atoms.moveInPlan, { charId: character.key, target })
    }
    // 和「角色内排序」一样：计划里没有别的干员可换时，四个按钮哪个都挪不动
    const movable = order.length > 1 && order.includes(character.key)

    return (
      <Menu>
        {movable && (alwaysSorting || (alwaysSorting !== false && param.query === ListModeWithGoal)) ? (
          <>
            <SortButtonGroup label={gt.gettext('角色计划排序')} onMove={move} />
            <MenuDivider />
          </>
        ) : null}
        <CharacterPlanMenuItems charId={character.key} />
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

// 纵向放不下时交给 preventOverflow 往上挪，不因此翻到左边；顶上让出 40px 的顶栏
const statusPopoverModifiers: PopoverProps['modifiers'] = {
  flip: { options: { fallbackPlacements: ['left-start'], altAxis: false } },
  preventOverflow: { options: { altAxis: true, tether: false, padding: { top: 48, right: 8, bottom: 8, left: 8 } } },
}

/**
 * 浮层按 portal 在 body 里的先后叠放，而弹窗一直用第一次打开时建的 portal，之后打开的档案、大窗口会盖住它；
 * 挂在格子旁边时常常和档案重叠，所以每次打开都挪到最后，后打开的在上面。焦点在下一帧才移进弹窗，挪动不会丢焦点
 */
export function raisePortal(node: HTMLElement) {
  const portal = node.closest(`.${Classes.PORTAL}`)
  if (portal?.nextElementSibling) portal.parentElement?.appendChild(portal)
}

/** 弹窗关上时 Blueprint 卸载内容，所以切换过的那一边不记住，下次按点的是哪一格重新开始 */
const StatusPopoverContent = ({ character, initialGoal }: { character: ICharacter; initialGoal: boolean }) => {
  const CSP = useComponents().CharacterStatusPopover || CharacterStatusPopover
  const [isGoal, setIsGoal] = useState(initialGoal)
  // 以模式为 key：打开着的 (i) 说明和输入到一半的等级不带到另一边
  return <CSP key={isGoal ? 'goal' : 'current'} character={character} isGoal={isGoal} onModeChange={setIsGoal} />
}

const CharacterMenu = memo(
  <G extends IGame>({
    character,
    style,
    item,
    renderExtraFields,
    drag,
    row,
    dimmed,
  }: {
    character: ICharacter
    style?: React.CSSProperties
    item: FieldContext<G, ICharacter, any>
    renderExtraFields?: (item: FieldContext<G, ICharacter, any>) => React.ReactNode
    drag?: ListDrag<number>
    row?: number
    dimmed?: boolean
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
    const openDossier = useOpenCharacterDossier()
    const dossierOpen = useDossierOpenFor(charId)

    return (
      <li
        role="none"
        className={[
          'cpp-char-menu-master',
          `cpp-char-rarity-${character.rarity}`,
          ...(character.characterViewExtraClass || []),
          ...(dimmed ? ['cpp-drag-source'] : []),
        ].join(' ')}
        style={style}
        {...(drag && row !== undefined ? drag.hoverProps(row) : null)}
      >
        <ContextMenu content={<CharacterContextMenu character={character} />}>
          <a
            role="menuitem"
            tabIndex={0}
            className={
              'bp6-menu-item cpp-char-menu-char' +
              (dossierOpen ? ' bp6-active bp6-intent-primary cpp-dossier-open' : '')
            }
            aria-haspopup="dialog"
            aria-expanded={dossierOpen}
            onClick={() => openDossier(charId)}
            onKeyDown={menuItemKeyDown}
            {...(drag && row !== undefined ? drag.pressProps(row) : null)}
          >
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
          popoverClassName="cpp-popover cpp-status-popover"
          popupKind={PopupKind.DIALOG}
          content={<StatusPopoverContent character={character} initialGoal={false} />}
          placement="right-start"
          modifiers={statusPopoverModifiers}
          onOpening={raisePortal}
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
          popoverClassName="cpp-popover cpp-status-popover"
          popupKind={PopupKind.DIALOG}
          content={<StatusPopoverContent character={character} initialGoal={true} />}
          placement="right-start"
          modifiers={statusPopoverModifiers}
          onOpening={raisePortal}
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

const holdingValues = (quick: Record<string, any> | undefined): string[] =>
  Array.isArray(quick?.holding) ? quick.holding : []

const useHoldingFilter = (value: string) => {
  const [param, setParam] = useAtom(useCpp().queryParamAtom)
  const current = holdingValues(param.quick)
  return {
    active: current.includes(value),
    toggle: useEvent(() => {
      setParam((x) => {
        const quick = x.quick || {}
        const current = holdingValues(quick)
        const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value]
        const { holding: _, ...rest } = quick
        return { ...x, quick: next.length === 0 ? rest : { ...rest, holding: next } }
      })
    }),
  }
}

const HoldingFilter = memo(() => {
  const trainable = useHoldingFilter(HoldingTrainable)
  const absent = useHoldingFilter(HoldingAbsent)
  return (
    <ButtonGroup>
      <Button
        variant="minimal"
        active={trainable.active}
        aria-pressed={trainable.active}
        text={gt.pgettext('holding filter', '可练')}
        title={gt.pgettext('holding filter', '已持有、还没练完的干员')}
        onClick={trainable.toggle}
      />
      {/* 两个都选上时留一道缝，看得出是两个按钮 */}
      <Button
        variant="minimal"
        active={absent.active}
        aria-pressed={absent.active}
        text={gt.pgettext('holding filter', '缺席')}
        title={gt.pgettext('holding filter', '还没有持有的干员')}
        onClick={absent.toggle}
        style={{ marginLeft: 2 }}
      />
    </ButtonGroup>
  )
})

async function listCharactersQuery<G extends IGame>(
  cpp: Cpp<G>,
  param: ListCharactersQueryParam,
  pin: RosterPin | null,
) {
  await Promise.resolve()

  const ga = cpp.gameAdapter
  const store = cpp.store
  const atoms = cpp.atoms.atoms
  const ud = store.get(atoms.rootAtom)
  const uda = ga.getUserDataAdapter()

  const emptyCharacterStatus = uda.getFrozenEmptyCharacterStatus()

  // 面板的筛选不看当前视图的条件、快捷过滤和搜索词，只列它给的干员
  const compiled = compileQuery(pin ? ListModeAll : param.query, cpp)
  const query = createListQuerier(
    cpp,
    pin ? compiled : wrapQueryWithQuickFilter(compiled, param.quick, quickFiltersFor(cpp.gameComponent, compiled.join)),
  )

  const matcher = buildMatcher(pin ? '' : param.search)
  const strictMatcher = buildMatcher(pin ? '' : param.search, true)

  query.execute(
    (function* () {
      for (const x of pin ? pin.charIds : uda.getAllCharacterIds()) {
        const character = ga.getCharacter(x)
        if (!character) continue
        if (!(matcher(character.name) || matcher(character.appellation) || strictMatcher(character.key))) continue
        yield { character, current: ud.current[character.key] || emptyCharacterStatus, goal: ud.goal[character.key] }
      }
    })(),
  )
  if (pin) {
    const rank = new Map(pin.charIds.map((x, i) => [x, i]))
    query.result.sort((a, b) => rank.get(a.character.key)! - rank.get(b.character.key)!)
  }

  return { query: query, result: query.result, param, pin }
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

function columnLabel(id: string, query: Querier<any, any>, entries: QueryFieldEntry[]) {
  if (id === query.param.join) return String(query.rootQuery.subQueries.get(id)?.name ?? id)
  const entry = resolveField(entries, query, id)
  return entry ? fieldLabel(entry) : id
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

/** 当前视图的 totalValue 字段在列表各行上的和 */
interface ViewTotal {
  querier: Querier<any, any>
  field: string
}

const QueryBuilder = memo(({ total }: { total?: ViewTotal }) => {
  const cpp = useCpp()
  // 游戏数据第一次带上基建技能时，那一组预设才出现
  const [pgq, pgqKeys] = useGameDataMemo(() => {
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
  const pin = useActiveRosterPin()
  const viewActive = (query: string) => !pin && param.query === query
  // 每行用 store 里现在的练度重新取值，所以在行尾改了练度，总数和格子一样马上跟着变
  const { current: currents, goal: goals } = data
  const totalValue = useMemo(() => {
    if (!total) return undefined
    const empty = cpp.gameAdapter.getUserDataAdapter().getFrozenEmptyCharacterStatus()
    let sum = 0
    let known = false
    for (const item of total.querier.result) {
      const key = item.character.key
      const v = total.querier.getFieldValue(total.field, { ...item, current: currents[key] || empty, goal: goals[key] })
      if (!Number.isFinite(v)) continue
      sum += v
      known = true
    }
    return known || total.querier.result.length === 0 ? sum : NaN
  }, [cpp, total, currents, goals])

  return (
    <>
      <QuerySearchBox />
      <Button
        variant="minimal"
        active={viewActive(ListModeFav)}
        text={gt.pgettext('predefined view name', '常看')}
        onClick={() => goTo(ListModeFav)}
        style={{ flexShrink: 0 }}
      />
      <Button
        variant="minimal"
        active={viewActive(ListModeAll)}
        text={gt.pgettext('predefined view name', '全部')}
        onClick={() => goTo(ListModeAll)}
        style={{ flexShrink: 0 }}
      />
      <Button
        variant="minimal"
        active={viewActive(ListModeWithGoal)}
        text={gt.pgettext('predefined view name', '计划')}
        endIcon={goalCount > 0 ? <Tag round={true}>{goalCount}</Tag> : undefined}
        onClick={() => goTo(ListModeWithGoal)}
        style={{ flexShrink: 0 }}
      />
      {activeName ? (
        <Button
          variant="minimal"
          active={!pin}
          text={activeName}
          title={activeName}
          endIcon={
            totalValue === undefined ? undefined : (
              <ValueTag
                value={totalValue}
                minimal={true}
                title={gt.pgettext('training cost', '列表里这些干员一共花了多少')}
              />
            )
          }
          onClick={() => {}}
          style={{ flexShrink: 42 }}
          className="cpp-overflow-button"
        />
      ) : null}
      {pin ? (
        <Tag
          intent="primary"
          onRemove={() => clearRosterPin(cpp)}
          title={pin.label}
          style={{ flexShrink: 1, minWidth: 0, marginLeft: 4 }}
        >
          {pin.label}
        </Tag>
      ) : null}
    </>
  )
})

export const menuItemKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
  if (e.key !== 'Enter' && e.key !== ' ') return
  e.preventDefault()
  e.currentTarget.click()
}

/** 一个指标的几版合成一行：名字进这一版，后面每段进各自那一版，各段各自可点、各自高亮 */
const PresetSplitMenuItem = memo(
  ({
    text,
    title,
    active,
    onClick,
    segments,
  }: {
    text: string
    title?: string
    active: boolean
    onClick: () => void
    segments: { key: string; label: string; title: string; active: boolean; onClick: () => void }[]
  }) => {
    const className = (on: boolean, extra?: string) =>
      [
        'bp6-menu-item',
        'bp6-popover-dismiss',
        ...(on ? ['bp6-active', 'bp6-intent-primary'] : []),
        ...(extra ? [extra] : []),
      ].join(' ')
    return (
      <li role="none" className="cpp-split-menu-item">
        <a
          role="menuitem"
          tabIndex={0}
          className={className(active)}
          title={title ?? gt.pgettext('query menu', '只列出还没练到的')}
          onClick={onClick}
          onKeyDown={menuItemKeyDown}
        >
          <div className="bp6-text-overflow-ellipsis bp6-fill">{text}</div>
        </a>
        {segments.map((s) => (
          <a
            key={s.key}
            role="menuitem"
            tabIndex={0}
            className={className(s.active, 'cpp-split-menu-item-segment')}
            title={s.title}
            onClick={s.onClick}
            onKeyDown={menuItemKeyDown}
          >
            {s.label}
          </a>
        ))}
      </li>
    )
  },
)

const QueryBuilderRight = memo(() => {
  const cpp = useCpp()
  const menu = useGameDataMemo(
    () => presetMenu(cpp.gameAdapter.getPredefinedQueryGroups(), cpp.gameAdapter.getPredefinedQueries()),
    [cpp],
  )
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
                    intent={param.query === SavedQueryPrefix + x.id ? 'primary' : undefined}
                    text={x.name}
                    onClick={() => goTo(SavedQueryPrefix + x.id)}
                  />
                ))}
              </>
            ) : null}
            {menu.map(({ group, rows }) => (
              <React.Fragment key={group.id}>
                <MenuDivider title={group.title.toString()} />
                {rows.map(({ key, preset, segments }) => {
                  const ref = PredefinedGameQueryPrefix + key
                  return segments.length > 0 ? (
                    <PresetSplitMenuItem
                      key={key}
                      text={preset.name}
                      title={preset.title?.toString()}
                      active={param.query === ref}
                      onClick={() => goTo(ref)}
                      segments={segments.map((s) => ({
                        key: s.key,
                        label: s.label.toString(),
                        title: s.title.toString(),
                        active: param.query === PredefinedGameQueryPrefix + s.key,
                        onClick: () => goTo(PredefinedGameQueryPrefix + s.key),
                      }))}
                    />
                  ) : (
                    <MenuItem
                      key={key}
                      active={param.query === ref}
                      intent={param.query === ref ? 'primary' : undefined}
                      text={preset.name}
                      htmlTitle={preset.title?.toString()}
                      onClick={() => goTo(ref)}
                    />
                  )
                })}
              </React.Fragment>
            ))}
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
  const cpp = useCpp()
  const query = useAtomValue(cpp.queryParamAtom).query
  // 游戏按查询展开的是什么画按钮；正在编辑、还编译不了的查询当作没有展开
  const join = useGameDataMemo(() => {
    try {
      return compileQuery(query, cpp).join ?? undefined
    } catch {
      return undefined
    }
  }, [cpp, query])

  // 「可练」「缺席」只看持有和练度，每个游戏、每种展开都适用，所以由这里放在最前面，不归游戏的快捷过滤管
  return (
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
      <HoldingFilter />
      {QuickFilterBuilder ? (
        <>
          <Navbar.Divider />
          <QuickFilterBuilder join={join} />
        </>
      ) : null}
    </Navbar>
  )
})

export const CharacterList = memo(({ charExtraWidthAtom }: { charExtraWidthAtom: PrimitiveAtom<number> }) => {
  const param = useAtomValue(useCpp().queryParamAtom)
  const stale = useAtomValue(queryEditorStaleAtom)

  const cpp = useCpp()
  const { send, response, loading, error } = useRequest(listCharactersQuery)
  const pin = useActiveRosterPin()

  const refresh = useEvent(() => {
    send(cpp, param, pin)
  })

  const generation = useGameDataGeneration()
  useEffect(() => refresh(), [param, pin, refresh, generation])
  useEffect(() => {
    if (error) console.error('Failed to query', error)
  }, [error])

  const query = response?.query
  const atoms = useAtoms<IGame>()
  const store = useStore()
  // goalOrder 每次改用户数据都是新数组，只在顺序真的变了时重画列表
  const planOrder = useAtomValue(useMemo(() => selectAtom(atoms.goalOrder, (x) => x, equals), [atoms]))
  // 「计划」视图列哪些干员是查询时的快照，但先后每次都按现在的计划顺序排：拖动、右键的按钮、撤销都马上看得到
  const planView = response?.param.query === ListModeWithGoal && !response.pin
  const rows = useMemo(() => {
    const result = response?.result || []
    return planView ? followOrder(result, (x) => x.character.key, planOrder) : result
  }, [response, planView, planOrder])
  // 查询中、或者结果还是上一个视图的时候不给，免得显示过时的总数
  const total = useMemo(() => {
    if (loading || !response || response.param !== param || response.pin !== pin || pin) return undefined
    if (!param.query.startsWith(PredefinedGameQueryPrefix)) return undefined
    const preset = cpp.gameAdapter.getPredefinedQueries()[param.query.slice(PredefinedGameQueryPrefix.length)]
    return preset?.totalValue ? { querier: response.query, field: preset.totalValue } : undefined
  }, [cpp, loading, response, param, pin])
  const list = rows.map((x) => x.character)
  const extraColumns = useMemo(
    () =>
      response
        ? getResponseExtraFields(response).flatMap((id) => {
            const field = getExtraField(id, response.query, cpp)
            return field ? [{ id, field }] : []
          })
        : [],
    [cpp, response],
  )

  const editing = isCustomQuery(param.query)
  // 编辑时一直在，免得加上第一列时整个列表往下一跳
  const wantHeader = editing || extraColumns.length > 0
  const columnWidths = useColumnWidths(param.query)
  const [preview, setPreview] = useState<{ id: string; width: number }>()
  const widths = useMemo(
    () =>
      extraColumns.map(({ id, field }) => {
        if (preview?.id === id) return preview.width
        const custom = columnWidths.widths[id]
        return custom == null ? field.width : clampColumnWidth(custom)
      }),
    [extraColumns, columnWidths.widths, preview],
  )

  const renderExtraFields = useCallback(
    (item: FieldContext<IGame, ICharacter, any>) => {
      return extraColumns.map(({ id, field: { C } }, i) => (
        <div key={id}>
          <C query={query!} context={item} width={widths[i]} />
        </div>
      ))
    },
    [extraColumns, widths, query],
  )

  const columnHeads = useMemo(() => {
    if (!query) return []
    const entries = listQueryFields(query)
    return extraColumns.map(({ id, field }, i) => ({
      id,
      label: columnLabel(id, query, entries),
      width: widths[i],
      defaultWidth: field.width,
      Tip: field.Tip,
      align: field.align,
    }))
  }, [query, extraColumns, widths])

  const onPreview = useCallback(
    (id: string, width: number | undefined) => setPreview(width == null ? undefined : { id, width }),
    [],
  )

  const parentRef = useRef<HTMLUListElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  const rowVirtualizer = useVirtualizer({
    count: list.length,
    getScrollElement: () => parentRef.current,
    getItemKey: (index) => list[index].key,
    overscan: 5,
    estimateSize: () => 50,
  })

  const canDrag =
    param.query === ListModeWithGoal && !pin && !loading && response?.param === param && response.pin === pin
  const { drag, active, overlay, handle } = useListDrag<number, MoveTarget>({
    enabled: canDrag,
    scrollRef: parentRef,
    contentRef,
    virtualizer: rowVirtualizer,
    handleInset: 4,
    draggable: () => list.length > 1,
    begin: (row) => ({
      rows: [row, row],
      gaps: listGaps(
        list.map((x) => x.key),
        row,
      ),
    }),
    commit: (row, target) => store.set(atoms.moveInPlan, { charId: list[row].key, target }),
  })

  // 列头的状态格量自第一行：状态格的宽度由各游戏的渲染结果决定
  const [statusWidths, setStatusWidths] = useState<readonly number[]>([])
  const hasRows = rowVirtualizer.getVirtualItems().length > 0
  useLayoutEffect(() => {
    if (!wantHeader || !hasRows) return
    const row = parentRef.current?.querySelector('.cpp-char-menu-master')
    if (!row) return
    const measured = [...row.children].slice(-2).map((x) => x.getBoundingClientRect().width)
    setStatusWidths((x) => (deepEqual(x, measured) ? x : measured))
  }, [wantHeader, hasRows, response])

  const remeasure = useEvent(() => {
    rowVirtualizer.measure()
  })

  useEffect(() => {
    remeasure()
  }, [param, pin, remeasure])

  const setCharExtraWidth = useSetAtom(charExtraWidthAtom)
  useEffect(() => {
    return () => setCharExtraWidth(0)
  }, [setCharExtraWidth])

  useEffect(() => {
    setCharExtraWidth(widths.reduce((a, b) => a + b, 0))
  }, [widths, setCharExtraWidth])

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
          <QueryBuilder total={total} />
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
          {/* 一行都还没出现过时量不到状态格，画出来对不齐 */}
          {wantHeader && statusWidths.length > 0 ? (
            <ColumnHeader
              columns={columnHeads}
              statusWidths={statusWidths}
              disabled={stale}
              onPreview={onPreview}
              onResize={columnWidths.setWidth}
            />
          ) : null}
          <div
            ref={contentRef}
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
                  key={rows[index].key}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  character={list[index]}
                  item={rows[index]}
                  renderExtraFields={renderExtraFields}
                  drag={drag}
                  row={index}
                  dimmed={active?.source === index}
                />
              )
            })}
            {overlay}
          </div>
        </Menu>
      )}
      {handle}
    </>
  )
})

/**
 * 附加列的一格。默认不能点：没有 role、Tab 不到、悬停没有底色；有 onClick 时（PeekTrigger 的目标、基建技能格）才像能点。
 * bp6-menu-item 留着，排版靠它
 */
export const CharacterListColumn = memo(
  forwardRef<
    HTMLDivElement,
    React.PropsWithChildren<{ width: number; className?: string } & React.HTMLAttributes<HTMLDivElement>>
  >(({ children, width, className, ...props }, ref) => {
    const interactive = props.onClick != null
    const classes = new Set(['bp6-menu-item', interactive ? 'cpp-peek-target' : 'cpp-char-col-static'])
    for (const x of className?.split(' ') ?? []) if (x) classes.add(x)
    return (
      <div
        role={interactive ? 'button' : undefined}
        tabIndex={interactive ? 0 : undefined}
        onKeyDown={interactive ? menuItemKeyDown : undefined}
        {...props}
        ref={ref}
        className={[...classes].join(' ')}
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
  }),
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
    align: style.textAlign === 'right' ? ('right' as const) : undefined,
    C: memo(({ context, query, width }: { query: Querier<G, C>; context: FieldContext<G, C, Args>; width: number }) => {
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
