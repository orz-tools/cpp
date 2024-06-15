import {
  Alignment,
  Button,
  ButtonGroup,
  Dialog,
  Icon,
  Menu,
  MenuDivider,
  MenuItem,
  Navbar,
  NumericInput,
  Popover,
} from '@blueprintjs/core'
import { WritableAtom, atom, useAtom, useAtomValue, useSetAtom, useStore } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import { groupBy, intersection, map, sum, uniq } from 'ramda'
import React, { SetStateAction, memo, useEffect, useMemo, useState } from 'react'
import { Level, useAtoms, useGameAdapter } from '../Cpp'
import { IGame, IGameAdapter, IItem } from '../pkg/cpp-basic'
import { gt } from '../pkg/gt'
import { useChamber } from './Chamber'
import { CachedImg } from './Icons'
import { InventorySyncer } from './InventorySyncer'
import { ValueTag, ValueTagProgressBar } from './Value'

const formatter = (q: number) => q.toFixed(0)
const parser = (q: string) => Math.floor(parseFloat(q) || 0)
export const ItemQuantityEditor = memo(
  <G extends IGame>({ item, style }: { item: IItem; style?: React.CSSProperties }) => {
    const ga = useGameAdapter<G>()
    const atoms = useAtoms<G>()
    const [quantity, setQuantity] = useAtom(atoms.itemQuantity(item.key))
    const [input, setInput] = useState(formatter(quantity))
    useEffect(() => setInput(formatter(quantity)), [quantity])

    if (Object.prototype.hasOwnProperty.call(ga.getExpItems(), item.key)) {
      return <NumericInput value={input} style={style} disabled={true} allowNumericCharactersOnly={false} />
    }
    return (
      <NumericInput
        allowNumericCharactersOnly={false}
        value={input}
        style={style}
        min={0}
        onValueChange={(_, valueAsString) => setInput(valueAsString)}
        onBlur={() => {
          if (input === formatter(quantity)) return
          setInput(formatter(quantity))
          setQuantity(parser(input))
        }}
        onButtonClick={(_, valueAsString) => {
          setQuantity(parser(valueAsString))
        }}
      />
    )
  },
)

export const ItemSynthesisPopover = memo(<G extends IGame>({ item, refresh }: { item: IItem; refresh?: () => any }) => {
  const ga = useGameAdapter<G>()
  const atoms = useAtoms<G>()
  const quantities = useAtomValue(atoms.itemQuantities)
  const setData = useSetAtom(atoms.dataAtom)
  const formula = useMemo(() => ga.getFormulas().find((x) => x.itemId === item.key), [ga, item.key])
  const quantity = useAtomValue(atoms.itemQuantity(item.key)) || 0
  const [times, setTimes] = useState(1)

  if (!formula)
    return (
      <>
        无法合成{item.name}，<i>谁让你来的？</i>
      </>
    )

  const synTimes = [24, 12, 6, 3, 1]
  const maxTimes = Math.max(
    0,
    Math.min(...formula.costs.map((x) => Math.floor((quantities[x.itemId] || 0) / x.quantity))),
  )
  if (maxTimes > 0) {
    while (synTimes[0] > maxTimes) {
      synTimes.shift()
    }
    if (synTimes[0] !== maxTimes && ((formula.apCost && maxTimes < 24) || !formula.apCost)) {
      synTimes.unshift(maxTimes)
    }
  } else {
    synTimes.splice(0, synTimes.length - 1)
  }

  return (
    <>
      <ButtonGroup minimal={true} style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
        {formula.apCost ? (
          <>
            <span style={{ marginLeft: 10 }}>
              {gt.gettext('心情')} {formula.apCost}
            </span>
            <div style={{ flex: 1 }} />
          </>
        ) : null}
        {synTimes.map((t) => {
          return (
            <Button
              key={t}
              disabled={t > maxTimes}
              text={
                <span>
                  <Icon icon={'build'} size={10} style={{ padding: 0, paddingBottom: 4, opacity: 0.5, margin: 0 }} />
                  {t}
                </span>
              }
              style={{ opacity: formula.apCost && t > 24 / formula.apCost ? 0.5 : 1 }}
              onMouseEnter={() => setTimes(t)}
              onMouseLeave={() => setTimes(1)}
              onClick={() => {
                setData('modify', (d) => {
                  d.items[item.key] = (d.items[item.key] || 0) + t * formula.quantity
                  formula.costs.forEach((cost) => {
                    d.items[cost.itemId] = (d.items[cost.itemId] || 0) - t * cost.quantity
                  })
                })
                refresh?.()
              }}
            />
          )
        })}
      </ButtonGroup>
      <MenuDivider />
      <MenuItem
        icon={
          <CachedImg
            className="cpp-item-icon"
            src={item.icon}
            width={'20'}
            height={'20'}
            alt={item.key}
            title={item.key}
          />
        }
        text={
          <>
            <span>{item.name}</span>
            <span style={{ float: 'right' }}>
              <Icon icon={'build'} size={10} style={{ padding: 0, paddingBottom: 4, opacity: 0.5 }} />
              {times * formula.quantity}/{quantity}
            </span>
          </>
        }
      />
      <MenuDivider
        title={gt
          .ngettext(`制作 %d 次所需`, `制作 %d 次所需`, times) /* I10N: %d: number */
          .replaceAll('%d', times.toString())}
      />
      {formula.costs.map((cost) => {
        const citem = ga.getItem(cost.itemId)
        return (
          <MenuItem
            key={cost.itemId}
            icon={
              <CachedImg
                className="cpp-item-icon"
                src={citem.icon}
                width={'20'}
                height={'20'}
                alt={citem.key}
                title={citem.key}
              />
            }
            text={
              <>
                <span>{citem.name}</span>
                <span style={{ float: 'right' }}>
                  {times * cost.quantity}/{quantities[cost.itemId] || 0}
                </span>
              </>
            }
          />
        )
      })}
    </>
  )
})

export const ItemTaskRequirements = memo(<G extends IGame>({ item }: { item: IItem }) => {
  const ga = useGameAdapter<G>()
  const formula = useMemo(() => ga.getFormulas().find((x) => x.itemId === item.key), [ga, item.key])
  const atoms = useAtoms<G>()
  const quantities = useAtomValue(atoms.itemQuantities)
  const quantity = useAtomValue(atoms.itemQuantity(item.key)) || 0
  const goal = useAtomValue(atoms.allGoalTaskRequirements)[item.key] || 0
  const finished = useAtomValue(atoms.allFinishedTaskRequirements)[item.key] || 0
  const goalIndirects = useAtomValue(atoms.allGoalIndirects)[item.key] || 0
  const finishedIndirects = useAtomValue(atoms.allFinishedIndirects)[item.key] || 0
  const itemListParam = useAtomValue(itemListParamAtom)
  const forbiddenFormulaTags = useAtomValue(atoms.forbiddenFormulaTagsAtom)

  const synableReal = formula
    ? Math.max(0, Math.min(...formula.costs.map((x) => Math.floor((quantities[x.itemId] || 0) / x.quantity)))) *
      formula.quantity
    : 0
  const canSyn = formula && intersection(forbiddenFormulaTags, formula.tags).length === 0
  const synable = canSyn ? synableReal : 0

  return (
    <>
      <div
        className="cpp-goal-counter"
        style={{ width: '6em', visibility: !formula || synable === 0 ? 'hidden' : undefined }}
        data-label={gt.pgettext('item list counter label', '合成后')}
      >
        <div
          style={{
            textAlign: 'right',
            opacity:
              itemListParam.level == null || itemListParam.level === Level.Goal
                ? goal + goalIndirects - quantity - Math.min(synable, goal + goalIndirects) > 0
                  ? 1
                  : 0.4
                : 0,
          }}
        >
          <span>{goal + goalIndirects - quantity - Math.min(synable, goal + goalIndirects)}</span>
        </div>
        <div
          style={{
            textAlign: 'right',
            opacity:
              itemListParam.level == null || itemListParam.level === Level.Finished
                ? finished + finishedIndirects - quantity - Math.min(synable, finished + finishedIndirects) > 0
                  ? 1
                  : 0.4
                : 0,
          }}
        >
          <span>{finished + finishedIndirects - quantity - Math.min(synable, finished + finishedIndirects)}</span>
        </div>
      </div>
      <a
        role="menuitem"
        tabIndex={0}
        className="bp5-menu-item cpp-item-menu"
        style={{ lineHeight: '21px', padding: 0, fontWeight: 'normal', visibility: !formula ? 'hidden' : undefined }}
      >
        <Popover
          content={
            <Menu style={{ minWidth: '300px' }}>
              <ItemSynthesisPopover item={item} />
            </Menu>
          }
          usePortal={true}
          placement={'bottom-end'}
        >
          <div
            className="cpp-goal-counter"
            style={{ width: '6em' }}
            data-label={gt.pgettext('item list counter label', '可合成')}
          >
            <div
              style={{
                textAlign: 'right',
                opacity:
                  itemListParam.level == null || itemListParam.level === Level.Goal
                    ? canSyn && Math.min(synableReal, goal + goalIndirects) > 0
                      ? 1
                      : 0.4
                    : 0,
              }}
            >
              <span>{Math.min(synableReal, goal + goalIndirects)}</span>
            </div>
            <div
              style={{
                textAlign: 'right',
                opacity:
                  itemListParam.level == null || itemListParam.level === Level.Finished
                    ? canSyn && Math.min(synableReal, finished + finishedIndirects) > 0
                      ? 1
                      : 0.4
                    : 0,
              }}
            >
              <span>{Math.min(synableReal, finished + finishedIndirects)}</span>
            </div>
          </div>
        </Popover>
      </a>
      <div
        className="cpp-goal-counter"
        style={{ width: '6em' }}
        data-label={gt.pgettext('item list counter label', '还需')}
      >
        <div
          style={{
            textAlign: 'right',
            opacity:
              itemListParam.level == null || itemListParam.level === Level.Goal
                ? goal + goalIndirects - quantity > 0
                  ? 1
                  : 0.4
                : 0,
          }}
        >
          <span>{goal + goalIndirects - quantity}</span>
        </div>
        <div
          style={{
            textAlign: 'right',
            opacity:
              itemListParam.level == null || itemListParam.level === Level.Finished
                ? finished + finishedIndirects - quantity > 0
                  ? 1
                  : 0.4
                : 0,
          }}
        >
          <span>{finished + finishedIndirects - quantity}</span>
        </div>
      </div>
      <div
        className="cpp-goal-counter"
        style={{ width: '6em' }}
        data-label={gt.pgettext('item list counter label', '直接需求')}
      >
        <div
          style={{
            textAlign: 'right',
            opacity:
              itemListParam.level == null || itemListParam.level === Level.Goal
                ? goal > 0 && goal - quantity > 0
                  ? 1
                  : 0.4
                : 0,
          }}
        >
          <span>{goal}</span>
        </div>
        <div
          style={{
            textAlign: 'right',
            opacity:
              itemListParam.level == null || itemListParam.level === Level.Finished
                ? finished > 0 && finished - quantity > 0
                  ? 1
                  : 0.4
                : 0,
          }}
        >
          <span>{finished}</span>
        </div>
      </div>
      <div
        className="cpp-goal-counter"
        style={{ width: '6em' }}
        data-label={gt.pgettext('item list counter label', '间接需求')}
      >
        <div
          style={{
            textAlign: 'right',
            opacity:
              itemListParam.level == null || itemListParam.level === Level.Goal
                ? goalIndirects > 0 && goal + goalIndirects - quantity > 0
                  ? 1
                  : 0.4
                : 0,
          }}
        >
          <span>{goalIndirects}</span>
        </div>
        <div
          style={{
            textAlign: 'right',
            opacity:
              itemListParam.level == null || itemListParam.level === Level.Finished
                ? finishedIndirects > 0 && finished + finishedIndirects - quantity > 0
                  ? 1
                  : 0.4
                : 0,
          }}
        >
          <span>{finishedIndirects}</span>
        </div>
      </div>
    </>
  )
})

export const ItemMenu = memo(({ item }: { item: IItem }) => {
  return (
    <li role="none">
      <a
        role="menuitem"
        tabIndex={0}
        className="bp5-menu-item cpp-item-menu cpp-menu-not-interactive"
        style={{ flexShrink: 1, overflow: 'hidden' }}
      >
        <>
          <span className="bp5-menu-item-icon">
            <CachedImg
              src={item.icon}
              width={'40'}
              height={'40'}
              alt={item.key}
              title={item.key}
              className="cpp-item-icon"
            />
          </span>
          <div className="bp5-fill" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div className="bp5-text-overflow-ellipsis" title={item.name}>
              {item.name}
            </div>
            <div className="bp5-text-overflow-ellipsis" style={{ fontWeight: 'normal', opacity: 0.75 }}>
              <ValueTag value={item.valueAsAp} minimal={true} single={true} />
            </div>
          </div>
        </>
      </a>
      <div>
        <ItemQuantityEditor item={item} style={itemQuantityStyle} />
      </div>
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

const AllGoalValue = memo(<G extends IGame>({ level, disabled }: { level: Level; disabled?: boolean }) => {
  const ga = useGameAdapter<G>()
  const atoms = useAtoms<G>()
  const quantites = useAtomValue(atoms.itemQuantities)
  const allGoals = useAtomValue(
    {
      [Level.Finished]: atoms.allFinishedTaskRequirements,
      [Level.Goal]: atoms.allGoalTaskRequirements,
      [Level.Star]: atoms.allStarredTaskRequirements,
    }[level],
  )
  const allGoalsIndirectsDetails = useAtomValue(
    {
      [Level.Finished]: atoms.allFinishedIndirectsDetails,
      [Level.Goal]: atoms.allGoalIndirectsDetails,
      [Level.Star]: atoms.allStarredIndirectsDetails,
    }[level],
  )
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
      minimal={true}
      disabled={disabled}
      text={
        {
          [Level.Finished]: gt.pgettext('item list view label', '毕业'),
          [Level.Goal]: gt.pgettext('item list view label', '计划'),
          [Level.Star]: gt.pgettext('item list view label', '星标'),
        }[level]
      }
      rightIcon={<ValueTagProgressBar value={remaining} maxValue={total} />}
      active={param.level === level}
      onClick={() => {
        setParam((p) => ({ ...p, level: p.level === level ? undefined : level }))
      }}
      style={{ marginLeft: '-1em' }}
    />
  )
})

const HideCompletedButton = memo(() => {
  const [param, setParam] = useAtom(itemListParamAtom)
  return (
    <Button
      minimal={true}
      active={param.hideCompleted}
      icon={'eye-off'}
      onClick={() => {
        setParam((p) => {
          return { ...p, hideCompleted: !p.hideCompleted }
        })
      }}
      style={{ marginRight: '1em' }}
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
      minimal={true}
      icon={'fullscreen'}
      title={gt.gettext('按游戏内仓库排布形式展示')}
      onClick={() => {
        add(Dialog, { isOpen: true, children: <InventorySyncer /> })
      }}
    />
  )
})

export const ItemList = memo(<G extends IGame>() => {
  const param = useAtomValue(itemListParamAtom)
  const ga = useGameAdapter<G>()
  const itemGroups = useMemo(() => buildItemList(ga), [ga])
  const atoms = useAtoms<G>()
  const store = useStore()
  const stars = useAtomValue(atoms.allStarredTaskRequirements)
  const goals = useAtomValue(atoms.allGoalTaskRequirements)
  const finished = useAtomValue(atoms.allFinishedTaskRequirements)
  const starIndirects = useAtomValue(atoms.allStarredIndirects)
  const goalIndirects = useAtomValue(atoms.allGoalIndirects)
  const finishedIndirects = useAtomValue(atoms.allFinishedIndirects)
  const categoryNames = ga.getInventoryCategories()

  return (
    <>
      <Navbar>
        <Navbar.Group align={Alignment.RIGHT}>
          {gt.gettext('总价值')}
          <AllValue />
          <SyncButton />
        </Navbar.Group>
        <Navbar.Group align={Alignment.LEFT}>
          <HideCompletedButton />
          <AllGoalValue level={Level.Star} disabled />
          <AllGoalValue level={Level.Goal} />
          <AllGoalValue level={Level.Finished} />
        </Navbar.Group>
      </Navbar>
      <Menu style={{ flex: 1, flexShrink: 1, overflow: 'auto' }} className="cpp-item-menu-master">
        {itemGroups.map(([key, allItems]) => {
          const items = allItems!.filter((x) => {
            if (!param.hideCompleted) return true
            switch (param.level) {
              case Level.Star:
                return store.get(atoms.itemQuantity(x.key)) < (stars[x.key] || 0) + (starIndirects[x.key] || 0)
              case Level.Goal:
                return store.get(atoms.itemQuantity(x.key)) < (goals[x.key] || 0) + (goalIndirects[x.key] || 0)
              default:
                return store.get(atoms.itemQuantity(x.key)) < (finished[x.key] || 0) + (finishedIndirects[x.key] || 0)
            }
          })
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
