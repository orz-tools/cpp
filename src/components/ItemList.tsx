import {
  Alignment,
  Button,
  Callout,
  ControlGroup,
  Dialog,
  Menu,
  MenuDivider,
  Navbar,
  NumericInput,
} from '@blueprintjs/core'
import { WritableAtom, atom, useAtom, useAtomValue, useStore } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import { groupBy, intersection, map, sum, uniq } from 'ramda'
import React, { SetStateAction, memo, useEffect, useRef, useState } from 'react'
import useEvent from 'react-use-event-hook'
import { Level, useAtoms, useCpp, useGameAdapter, useGameDataMemo } from '../Cpp'
import { IGame, IGameAdapter, IItem } from '../pkg/cpp-basic'
import { UserDataAtomHolder } from '../pkg/cpp-core/UserData'
import { gt } from '../pkg/gt'
import { useChamber } from './Chamber'
import { ItemIcon } from './Icons'
import { InventorySyncer } from './InventorySyncer'
import { formatQuantity } from './quantity'
import { PeekTrigger } from './Peek'
import { ItemCounterKind, itemCounterCells, itemCounterSlots } from './itemCounters'
import { SLOP_PX } from './longPress'
import { useCoarsePointer } from './phoneLayout'
import {
  COMMIT_DELAY_MS,
  HOLD_DELAY_MS,
  REPEAT_MS,
  createDeferredCommit,
  createHoldRepeat,
  formatter,
  parser,
  stepQuantity,
} from './quantityStepper'
import { ValueTag, ValueTagProgressBar } from './Value'

// NumericInput sanitizes its value whenever its parent renders, even when it then skips its own render as a pure
// component; the item list holds one per item, and they all render again with each new game data generation.
const MemoNumericInput = memo(NumericInput)
export const ItemQuantityEditor = memo(
  <G extends IGame>({
    item,
    style,
    compact,
    stepper,
  }: {
    item: IItem
    style?: React.CSSProperties
    /** 和价值标签一样高、没有上下箭头（键盘 ↑↓ 照样加减），宽度跟着数字 */
    compact?: boolean
    /** 手机条目的 [数][−][+]：一串加减停手才写进用户数据，是一步撤销 */
    stepper?: boolean
  }) => {
    const ga = useGameAdapter<G>()
    const atoms = useAtoms<G>()
    const [quantity, setQuantity] = useAtom(atoms.itemQuantity(item.key))
    const [input, setInput] = useState(formatter(quantity))
    // 从别处来的改动（撤销、导入）也把框里没写的那几下丢掉；还没到点的那次写入届时读到的框和数量一样，什么都不写
    const [inputQuantity, setInputQuantity] = useState(quantity)
    if (inputQuantity !== quantity) {
      setInputQuantity(quantity)
      setInput(formatter(quantity))
    }
    // Stable handlers let MemoNumericInput skip the re-render each new game data generation brings.
    const onValueChange = useEvent((_: number, valueAsString: string) => setInput(valueAsString))
    // 框里直接放新数而不是先退回旧数：紧跟着点的加减从框里的字算起
    const commitNow = useEvent(() => {
      const next = parser(input)
      setInput(formatter(next))
      if (next !== quantity) setQuantity(next)
    })
    const onButtonClick = useEvent((_: number, valueAsString: string) => {
      setQuantity(parser(valueAsString))
    })
    const [deferred] = useState(() => createDeferredCommit(COMMIT_DELAY_MS, commitNow))
    // 筛掉、换档案、换布局会卸载；切区域不会，到点照样写
    useEffect(() => () => deferred.flush(), [deferred])
    const onBlur = useEvent(() => {
      deferred.cancel()
      commitNow()
    })
    const onFocus = useEvent(() => deferred.flush())
    const step = useEvent((delta: number) => {
      setInput((prev) => formatter(stepQuantity(prev, delta)))
      deferred.schedule()
    })

    const isExp = Object.prototype.hasOwnProperty.call(ga.getExpItems(), item.key)
    if (stepper) {
      // 经验由各级作战记录折算，改不了
      if (isExp) return <span className="cpp-quantity-readonly">{input}</span>
      return (
        <ControlGroup className="cpp-quantity-stepper">
          <MemoNumericInput
            size="large"
            buttonPosition="none"
            inputMode="numeric"
            min={0}
            allowNumericCharactersOnly={false}
            value={input}
            title={input}
            onValueChange={onValueChange}
            onBlur={onBlur}
            onFocus={onFocus}
          />
          <StepButton
            icon="minus"
            label={gt.pgettext('item quantity button', '减少')}
            delta={-1}
            disabled={parser(input) === 0}
            onStep={step}
          />
          <StepButton icon="plus" label={gt.pgettext('item quantity button', '增加')} delta={1} onStep={step} />
        </ControlGroup>
      )
    }

    const look = compact
      ? ({
          size: 'small',
          buttonPosition: 'none',
          className: 'cpp-quantity-compact',
          style: { ...style, width: `calc(${Math.max(input.length, 3)}ch + 14px)` },
        } as const)
      : { style }

    if (isExp) {
      return <NumericInput value={input} {...look} title={input} disabled={true} allowNumericCharactersOnly={false} />
    }
    return (
      <MemoNumericInput
        allowNumericCharactersOnly={false}
        value={input}
        {...look}
        title={input}
        min={0}
        onValueChange={onValueChange}
        onBlur={onBlur}
        onButtonClick={onButtonClick}
      />
    )
  },
)

/**
 * 点一下加减一下；按住一会儿开始连加，松手停。按下时不加：手指落在按钮上开始滑动列表，浏览器发 pointercancel，
 * 这次什么都不改，也不会有 click
 */
const StepButton = memo(
  ({
    icon,
    label,
    delta,
    disabled,
    onStep,
  }: {
    icon: 'minus' | 'plus'
    label: string
    delta: number
    disabled?: boolean
    onStep: (delta: number) => void
  }) => {
    // 只管紧跟着的那一次 click：连加过的那次按住，松手时浏览器还会补一次 click
    const repeated = useRef(false)
    const origin = useRef<{ x: number; y: number } | null>(null)
    const fire = useEvent(() => onStep(delta))
    const fireHeld = useEvent(() => {
      repeated.current = true
      onStep(delta)
    })
    const [repeat] = useState(() => createHoldRepeat(HOLD_DELAY_MS, REPEAT_MS, fireHeld))
    const halt = useEvent(() => {
      repeat.stop()
      origin.current = null
    })
    // 减到 0 禁用时停下：禁用的按钮不一定再收到 pointerup，也不会有 click 来清掉标记
    useEffect(() => {
      if (!disabled) return
      halt()
      repeated.current = false
    }, [disabled, halt])
    useEffect(() => () => halt(), [halt])

    return (
      <Button
        size="large"
        icon={icon}
        aria-label={label}
        disabled={disabled}
        onClick={() => {
          if (repeated.current) {
            repeated.current = false
            return
          }
          fire()
        }}
        onPointerDown={(e) => {
          if (e.button !== 0 || disabled) return
          repeated.current = false
          origin.current = { x: e.clientX, y: e.clientY }
          repeat.start()
        }}
        onPointerMove={(e) => {
          const o = origin.current
          if (o && !repeated.current && Math.hypot(e.clientX - o.x, e.clientY - o.y) > SLOP_PX) halt()
        }}
        onPointerUp={halt}
        onPointerCancel={halt}
        onPointerLeave={halt}
        // 安卓长按会弹系统菜单
        onContextMenu={(e) => e.preventDefault()}
      />
    )
  },
)

function levelAtoms<G extends IGame>(atoms: UserDataAtomHolder<G>['atoms'], level: Level) {
  switch (level) {
    case Level.Star:
      return {
        requirements: atoms.allStarredTaskRequirements,
        indirects: atoms.allStarredIndirects,
        indirectsDetails: atoms.allStarredIndirectsDetails,
      }
    case Level.Goal:
      return {
        requirements: atoms.allGoalTaskRequirements,
        indirects: atoms.allGoalIndirects,
        indirectsDetails: atoms.allGoalIndirectsDetails,
      }
    case Level.Finished:
      return {
        requirements: atoms.allFinishedTaskRequirements,
        indirects: atoms.allFinishedIndirects,
        indirectsDetails: atoms.allFinishedIndirectsDetails,
      }
  }
}

function counterLabel(kind: ItemCounterKind) {
  switch (kind) {
    case 'afterSynthesis':
      return gt.pgettext('item list counter label', '合成后')
    case 'synthesizable':
      return gt.pgettext('item list counter label', '可合成')
    case 'remaining':
      return gt.pgettext('item list counter label', '还需')
    case 'direct':
      return gt.pgettext('item list counter label', '直接需求')
    case 'indirect':
      return gt.pgettext('item list counter label', '间接需求')
  }
}

function levelLabel(level: Level) {
  switch (level) {
    case Level.Star:
      return gt.pgettext('item list view label', '星标')
    case Level.Goal:
      return gt.pgettext('item list view label', '计划')
    case Level.Finished:
      return gt.pgettext('item list view label', '毕业')
  }
}

function useItemCounters<G extends IGame>(item: IItem) {
  const ga = useGameAdapter<G>()
  const formula = useGameDataMemo(() => ga.getFormulas().find((x) => x.itemId === item.key), [ga, item.key])
  const atoms = useAtoms<G>()
  const quantities = useAtomValue(atoms.itemQuantities)
  const quantity = useAtomValue(atoms.itemQuantity(item.key)) || 0
  const itemListParam = useAtomValue(itemListParamAtom)
  const slots = itemCounterSlots(itemListParam.level)
  const upper = levelAtoms(atoms, slots[0].level)
  const lower = levelAtoms(atoms, slots[1].level)
  const upperDirect = useAtomValue(upper.requirements)[item.key] || 0
  const upperIndirect = useAtomValue(upper.indirects)[item.key] || 0
  const lowerDirect = useAtomValue(lower.requirements)[item.key] || 0
  const lowerIndirect = useAtomValue(lower.indirects)[item.key] || 0
  const forbiddenFormulaTags = useAtomValue(atoms.forbiddenFormulaTagsAtom)
  const compact = useAtomValue(useCpp().preferenceAtoms.compactQuantitiesAtom)

  const synableReal = formula
    ? Math.max(0, Math.min(...formula.costs.map((x) => Math.floor((quantities[x.itemId] || 0) / x.quantity)))) *
      formula.quantity
    : 0
  const canSyn = !!formula && intersection(forbiddenFormulaTags, formula.tags).length === 0
  const synable = canSyn ? synableReal : 0
  const cells = [
    itemCounterCells(upperDirect, upperIndirect, quantity, synableReal, canSyn),
    itemCounterCells(lowerDirect, lowerIndirect, quantity, synableReal, canSyn),
  ] as const
  return { slots, cells, compact, hasFormula: !!formula, afterSynthesisShown: !!formula && synable !== 0 }
}

export const ItemTaskRequirements = memo(({ item }: { item: IItem }) => {
  const { slots, cells, compact, hasFormula, afterSynthesisShown } = useItemCounters(item)
  const rows = (cell: ItemCounterKind) =>
    slots.map((slot, i) => (
      <div key={i} style={{ textAlign: 'right', opacity: slot.shown ? (cells[i][cell].strong ? 1 : 0.4) : 0 }}>
        <span title={compact ? formatter(cells[i][cell].value) : undefined} style={{ whiteSpace: 'nowrap' }}>
          {formatQuantity(cells[i][cell].value, compact)}
        </span>
      </div>
    ))

  return (
    <>
      <div
        className="cpp-goal-counter"
        style={{ visibility: afterSynthesisShown ? undefined : 'hidden' }}
        data-label={counterLabel('afterSynthesis')}
      >
        {rows('afterSynthesis')}
      </div>
      <PeekTrigger
        peek={{ kind: 'item', id: item.key }}
        renderTarget={(target) => (
          <a
            role="menuitem"
            {...target}
            className={'bp6-menu-item cpp-item-menu ' + (target?.className ?? 'cpp-menu-not-interactive')}
            style={{
              lineHeight: '21px',
              padding: 0,
              fontWeight: 'normal',
              visibility: hasFormula ? undefined : 'hidden',
            }}
          >
            <div className="cpp-goal-counter" data-label={counterLabel('synthesizable')}>
              {rows('synthesizable')}
            </div>
          </a>
        )}
      />
      <div className="cpp-goal-counter" data-label={counterLabel('remaining')}>
        {rows('remaining')}
      </div>
      <div className="cpp-goal-counter" data-label={counterLabel('direct')}>
        {rows('direct')}
      </div>
      <div className="cpp-goal-counter" data-label={counterLabel('indirect')}>
        {rows('indirect')}
      </div>
    </>
  )
})

function ItemLink({ item }: { item: IItem }) {
  return (
    <PeekTrigger
      peek={{ kind: 'item', id: item.key }}
      renderTarget={(target) => (
        <a
          role="menuitem"
          {...target}
          className={'bp6-menu-item cpp-item-menu ' + (target?.className ?? 'cpp-menu-not-interactive')}
          style={{ flexShrink: 1, overflow: 'hidden' }}
        >
          <span className="bp6-menu-item-icon">
            <ItemIcon item={item} size={40} />
          </span>
          <div className="bp6-fill" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div className="bp6-text-overflow-ellipsis" title={item.name}>
              {item.name}
            </div>
            <div className="bp6-text-overflow-ellipsis" style={{ fontWeight: 'normal', opacity: 0.75 }}>
              <ValueTag value={item.valueAsAp} minimal={true} single={true} />
            </div>
          </div>
        </a>
      )}
    />
  )
}

export const ItemMenu = memo(({ item }: { item: IItem }) => {
  return (
    <li role="none">
      <ItemLink item={item} />
      <div>
        <ItemQuantityEditor item={item} style={itemQuantityStyle} />
      </div>
      {/* 手机上计数格从这里折到第二层 */}
      <span className="cpp-item-row-break" aria-hidden />
      <ItemTaskRequirements item={item} />
    </li>
  )
})

const itemQuantityStyle: React.CSSProperties = { width: '6em', textAlign: 'right' }

const byCategory = groupBy<IItem, string>((i) => {
  return i.inventoryCategory
})

export function buildItemList(ga: IGameAdapter<IGame>) {
  return Object.entries(byCategory(ga.getInventoryItems())).sort(([a], [b]) => {
    return a > b ? 1 : a < b ? -1 : 0
  })
}

const AllValue = memo(<G extends IGame>() => {
  const ga = useGameAdapter<G>()
  const atoms = useAtoms<G>()
  const quantites = useAtomValue(atoms.itemQuantities)

  let valid = false
  const a = sum(
    Object.entries(quantites).map(([k, v]) => {
      const value = ga.getItem(k).valueAsAp
      if (value == null) return 0
      valid = true
      return value * v
    }),
  )
  return <ValueTag value={valid ? a : null} minimal={true} />
})

const AllGoalValue = memo(<G extends IGame>({ level }: { level: Level }) => {
  const ga = useGameAdapter<G>()
  const atoms = useAtoms<G>()
  const quantites = useAtomValue(atoms.itemQuantities)
  const levelAtom = levelAtoms(atoms, level)
  const allGoals = useAtomValue(levelAtom.requirements)
  const allGoalsIndirectsDetails = useAtomValue(levelAtom.indirectsDetails)
  const [param, setParam] = useAtom(itemListParamAtom)

  const data = uniq([...Object.keys(allGoals), ...Object.keys(allGoalsIndirectsDetails.indirects)]).map((k) => {
    const total =
      (allGoals[k] || 0) +
      (allGoalsIndirectsDetails.indirects[k] || 0) -
      (allGoalsIndirectsDetails.synthisisedRequirements[k] || 0)
    const remaining = Math.max(0, total - (quantites[k] || 0))
    // console.log(finished, dataManager.data.items[k].raw.name, k, total, remaining)
    const value = ga.getItem(k).valueAsAp
    if (value == null) return [0, 0]
    return [value * total, value * remaining]
  })

  const total = sum(map((x) => x[0]!, data))
  const remaining = sum(map((x) => x[1]!, data))

  return (
    <Button
      variant="minimal"
      text={levelLabel(level)}
      endIcon={<ValueTagProgressBar value={remaining} maxValue={total} />}
      active={param.level === level}
      onClick={() => {
        setParam((p) => ({ ...p, level: p.level === level ? undefined : level }))
      }}
    />
  )
})

const HideCompletedButton = memo(() => {
  const [param, setParam] = useAtom(itemListParamAtom)
  return (
    <Button
      variant="minimal"
      active={param.hideCompleted}
      icon={'eye-off'}
      onClick={() => {
        setParam((p) => {
          return { ...p, hideCompleted: !p.hideCompleted }
        })
      }}
    />
  )
})

interface ItemListParam {
  mode?: 'all' | 'goal' | 'finished' // deprecated
  level?: Level
  hideCompleted: boolean
}

const itemListParamStorageAtom = atomWithStorage<ItemListParam>('cpp_item_param', undefined as any)
const itemListParamAtom: WritableAtom<ItemListParam, [ItemListParam | SetStateAction<ItemListParam>], void> = atom<
  ItemListParam,
  [ItemListParam | SetStateAction<ItemListParam>],
  void
>(
  (get) => {
    const value = Object.assign({}, get(itemListParamStorageAtom) || {})
    if (value.mode === 'all') {
      value.level = undefined
    } else if (value.level === Level.Goal) {
      value.level = Level.Goal
    } else if (value.level === Level.Finished) {
      value.level = Level.Finished
    }
    delete value.mode
    if (value.level != null && !Reflect.has(Level, value.level)) {
      value.level = undefined
    }

    if (value.hideCompleted == null) value.hideCompleted = false
    return value
  },
  (get, set, value: ItemListParam | SetStateAction<ItemListParam>) =>
    set(itemListParamStorageAtom, typeof value === 'function' ? value(get(itemListParamAtom)) : value),
)

export const SyncButton = memo(() => {
  const { add } = useChamber()
  return (
    <Button
      variant="minimal"
      icon={'fullscreen'}
      title={gt.gettext('按游戏内仓库排布形式展示')}
      onClick={() => {
        add(Dialog, { isOpen: true, children: <InventorySyncer /> })
      }}
    />
  )
})

const NoStarsCallout = memo(<G extends IGame>() => {
  const param = useAtomValue(itemListParamAtom)
  const atoms = useAtoms<G>()
  const starredTasks = useAtomValue(atoms.allStarredTasks)
  const coarse = useCoarsePointer()
  if (param.level !== Level.Star || starredTasks.length > 0) return null

  return (
    <Callout intent="primary" icon="star" compact style={{ borderRadius: 0, flexShrink: 0 }}>
      {coarse
        ? gt.gettext(
            '还没有星标任务。在任务列表里点一项任务，选「优先培养（星标）」，这里就列出它和它前置任务要用的材料。',
          )
        : gt.gettext(
            '还没有星标任务。在任务列表里右键一项任务，选「优先培养（星标）」，这里就列出它和它前置任务要用的材料。',
          )}
    </Callout>
  )
})

export const ItemList = memo(<G extends IGame>() => {
  const param = useAtomValue(itemListParamAtom)
  const ga = useGameAdapter<G>()
  const itemGroups = useGameDataMemo(() => buildItemList(ga), [ga])
  const atoms = useAtoms<G>()
  const store = useStore()
  const filterAtoms = levelAtoms(atoms, param.level ?? Level.Finished)
  const requirements = useAtomValue(filterAtoms.requirements)
  const indirects = useAtomValue(filterAtoms.indirects)
  const categoryNames = ga.getInventoryCategories()

  return (
    <>
      <Navbar
        style={{
          paddingLeft: '0.5em',
          paddingRight: '0.5em',
        }}
      >
        <Navbar.Group align={Alignment.RIGHT}>
          {gt.gettext('总价值')}
          <AllValue />
          <SyncButton />
        </Navbar.Group>
        <Navbar.Group align={Alignment.LEFT}>
          <HideCompletedButton />
        </Navbar.Group>
      </Navbar>
      <Navbar style={{ height: 'auto', marginTop: '1px', padding: 0 }}>
        <AllGoalValue level={Level.Star} />
        <AllGoalValue level={Level.Goal} />
        <AllGoalValue level={Level.Finished} />
      </Navbar>
      <NoStarsCallout />
      <Menu style={{ flex: 1, flexShrink: 1, overflow: 'auto' }} className="cpp-item-menu-master">
        {itemGroups.map(([key, allItems]) => {
          const items = allItems!.filter(
            (x) =>
              !param.hideCompleted ||
              store.get(atoms.itemQuantity(x.key)) < (requirements[x.key] || 0) + (indirects[x.key] || 0),
          )
          if (!items.length) return null

          return (
            <React.Fragment key={key}>
              <MenuDivider title={categoryNames[key]?.toString() ?? key} />
              {items.map((x) => (
                <ItemMenu key={x.key} item={x} />
              ))}
            </React.Fragment>
          )
        })}
      </Menu>
    </>
  )
})
