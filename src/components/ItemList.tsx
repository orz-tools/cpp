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
} from '@blueprintjs/core'
import { Popover2 } from '@blueprintjs/popover2'
import { WritableAtom, atom, useAtom, useAtomValue, useSetAtom, useStore } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import { groupBy, intersection, map, sum, uniq } from 'ramda'
import React, { SetStateAction, useEffect, useMemo, useState } from 'react'
import { useAtoms, useGameAdapter } from '../Cpp'
import { useComponents } from '../hooks/useComponents'
import { IGame, IGameAdapter, IItem } from '../pkg/cpp-basic'
import { CachedImg } from './Icons'
import { ValueTag, ValueTagProgressBar } from './Value'
import { InventorySyncer } from './InventorySyncer'

const formatter = (q: number) => q.toFixed(0)
const parser = (q: string) => Math.floor(parseFloat(q) || 0)
export function ItemQuantityEditor<G extends IGame>({ item, style }: { item: IItem; style?: React.CSSProperties }) {
  const ga = useGameAdapter<G>()
  const atoms = useAtoms<G>()
  const [quantity, setQuantity] = useAtom(atoms.itemQuantity(item.key))
  const [input, setInput] = useState(formatter(quantity))
  useEffect(() => setInput(formatter(quantity)), [quantity])

  if (Object.prototype.hasOwnProperty.call(ga.getExpItems(), item.key)) {
    return <NumericInput value={input} style={style} disabled={true} />
  }
  return (
    <NumericInput
      value={input}
      style={style}
      min={0}
      onValueChange={(_, valueAsString) => setInput(valueAsString)}
      onBlur={() => {
        if (input === formatter(quantity)) return
        setQuantity(parser(input))
      }}
      onButtonClick={(_, valueAsString) => {
        setQuantity(parser(valueAsString))
      }}
    />
  )
}

export function ItemSynthesisPopover<G extends IGame>({ item }: { item: IItem }) {
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
    <Menu style={{ width: '300px' }}>
      <ButtonGroup minimal={true} style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
        {formula.apCost ? (
          <>
            <span style={{ marginLeft: 10 }}>
              {'心情 '}
              {formula.apCost}
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
      <MenuDivider title={`制作 ${times} 次所需`} />
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
    </Menu>
  )
}

export function ItemTaskRequirements<G extends IGame>({ item }: { item: IItem }) {
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
        data-label="合成后"
      >
        <div
          style={{
            textAlign: 'right',
            opacity:
              itemListParam.mode === 'all' || itemListParam.mode === 'goal'
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
              itemListParam.mode === 'all' || itemListParam.mode === 'finished'
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
        className="bp4-menu-item cpp-item-menu"
        style={{ lineHeight: '21px', padding: 0, fontWeight: 'normal', visibility: !formula ? 'hidden' : undefined }}
      >
        <Popover2 content={<ItemSynthesisPopover item={item} />} usePortal={true} placement={'bottom-end'}>
          <div className="cpp-goal-counter" style={{ width: '6em' }} data-label="可合成">
            <div
              style={{
                textAlign: 'right',
                opacity:
                  itemListParam.mode === 'all' || itemListParam.mode === 'goal'
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
                  itemListParam.mode === 'all' || itemListParam.mode === 'finished'
                    ? canSyn && Math.min(synableReal, finished + finishedIndirects) > 0
                      ? 1
                      : 0.4
                    : 0,
              }}
            >
              <span>{Math.min(synableReal, finished + finishedIndirects)}</span>
            </div>
          </div>
        </Popover2>
      </a>
      <div className="cpp-goal-counter" style={{ width: '6em' }} data-label="还需">
        <div
          style={{
            textAlign: 'right',
            opacity:
              itemListParam.mode === 'all' || itemListParam.mode === 'goal'
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
              itemListParam.mode === 'all' || itemListParam.mode === 'finished'
                ? finished + finishedIndirects - quantity > 0
                  ? 1
                  : 0.4
                : 0,
          }}
        >
          <span>{finished + finishedIndirects - quantity}</span>
        </div>
      </div>
      <div className="cpp-goal-counter" style={{ width: '6em' }} data-label="直接需求">
        <div
          style={{
            textAlign: 'right',
            opacity:
              itemListParam.mode === 'all' || itemListParam.mode === 'goal'
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
              itemListParam.mode === 'all' || itemListParam.mode === 'finished'
                ? finished > 0 && finished - quantity > 0
                  ? 1
                  : 0.4
                : 0,
          }}
        >
          <span>{finished}</span>
        </div>
      </div>
      <div className="cpp-goal-counter" style={{ width: '6em' }} data-label="间接需求">
        <div
          style={{
            textAlign: 'right',
            opacity:
              itemListParam.mode === 'all' || itemListParam.mode === 'goal'
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
              itemListParam.mode === 'all' || itemListParam.mode === 'finished'
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
}

export function ItemMenu({ item }: { item: IItem }) {
  return (
    <li role="none">
      <a
        role="menuitem"
        tabIndex={0}
        className="bp4-menu-item cpp-item-menu"
        style={{ flexShrink: 1, overflow: 'hidden' }}
      >
        <>
          <span className="bp4-menu-item-icon">
            <CachedImg
              src={item.icon}
              width={'40'}
              height={'40'}
              alt={item.key}
              title={item.key}
              className="cpp-item-icon"
            />
          </span>
          <div className="bp4-fill" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div className="bp4-text-overflow-ellipsis" title={item.name}>
              {item.name}
            </div>
            <div className="bp4-text-overflow-ellipsis" style={{ fontWeight: 'normal', opacity: 0.75 }}>
              <ValueTag value={item.valueAsAp} minimal={true} single={true} />
            </div>
          </div>
        </>
      </a>
      <div style={{}}>
        <ItemQuantityEditor item={item} style={{ width: '6em', textAlign: 'right' }} />
      </div>
      <ItemTaskRequirements item={item} />
    </li>
  )
}

const byCategory = groupBy<IItem, string>((i) => {
  return i.inventoryCategory
})

export function buildItemList(ga: IGameAdapter<IGame>) {
  return Object.entries(byCategory(ga.getInventoryItems())).sort(([a], [b]) => {
    return a > b ? 1 : a < b ? -1 : 0
  })
}

function AllValue<G extends IGame>() {
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
}

function AllGoalValue<G extends IGame>({ finished = false }: { finished?: boolean }) {
  const ga = useGameAdapter<G>()
  const atoms = useAtoms<G>()
  const quantites = useAtomValue(atoms.itemQuantities)
  const allGoals = useAtomValue(finished ? atoms.allFinishedTaskRequirements : atoms.allGoalTaskRequirements)
  const allGoalsIndirectsDetails = useAtomValue(
    finished ? atoms.allFinishedIndirectsDetails : atoms.allGoalIndirectsDetails,
  )
  const [param, setParam] = useAtom(itemListParamAtom)
  const targetMode = finished ? 'finished' : 'goal'

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
      text={finished ? `毕业` : `计划`}
      rightIcon={<ValueTagProgressBar value={remaining} maxValue={total} />}
      active={param.mode === targetMode}
      onClick={() => {
        setParam((p) => ({ ...p, mode: p.mode === targetMode ? 'all' : targetMode }))
      }}
    />
  )
}

function HideCompletedButton() {
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
    />
  )
}

interface ItemListParam {
  mode: 'all' | 'goal' | 'finished'
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
    if (!value.mode) value.mode === 'all'
    if (value.hideCompleted == null) value.hideCompleted = false
    return value
  },
  (get, set, value: ItemListParam | SetStateAction<ItemListParam>) =>
    set(itemListParamStorageAtom, typeof value === 'function' ? value(get(itemListParamAtom)) : value),
)

export function SyncButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        minimal={true}
        icon={'fullscreen'}
        title={'按游戏内仓库排布形式展示'}
        onClick={() => {
          setOpen(true)
        }}
      />
      <Dialog isOpen={open} onClose={() => setOpen(false)}>
        <InventorySyncer />
      </Dialog>
    </>
  )
}

export function ItemList<G extends IGame>() {
  const param = useAtomValue(itemListParamAtom)
  const ga = useGameAdapter<G>()
  const itemGroups = useMemo(() => buildItemList(ga), [ga])
  const atoms = useAtoms<G>()
  const store = useStore()
  const goals = useAtomValue(atoms.allGoalTaskRequirements)
  const finished = useAtomValue(atoms.allFinishedTaskRequirements)
  const goalIndirects = useAtomValue(atoms.allGoalIndirects)
  const finishedIndirects = useAtomValue(atoms.allFinishedIndirects)
  const categoryNames = ga.getInventoryCategories()
  const { ItemImportButton } = useComponents()

  return (
    <>
      <Navbar>
        <Navbar.Group align={Alignment.RIGHT}>
          总价值
          <AllValue />
          {ItemImportButton && <ItemImportButton />}
          <SyncButton />
        </Navbar.Group>
        <Navbar.Group align={Alignment.LEFT}>
          <HideCompletedButton />
          <AllGoalValue />
          <AllGoalValue finished={true} />
        </Navbar.Group>
      </Navbar>
      <Menu style={{ flex: 1, flexShrink: 1, overflow: 'auto' }} className="cpp-item-menu-master">
        {itemGroups.map(([key, allItems]) => {
          const items = allItems.filter((x) => {
            if (!param.hideCompleted) return true
            switch (param.mode) {
              case 'goal':
                return store.get(atoms.itemQuantity(x.key)) < (goals[x.key] || 0) + (goalIndirects[x.key] || 0)
              case 'finished':
              case 'all':
                return store.get(atoms.itemQuantity(x.key)) < (finished[x.key] || 0) + (finishedIndirects[x.key] || 0)
            }
          })
          if (!items.length) return null

          return (
            <React.Fragment key={key}>
              <MenuDivider title={categoryNames[key]} />
              {items.map((x) => (
                <ItemMenu key={x.key} item={x} />
              ))}
            </React.Fragment>
          )
        })}
      </Menu>
    </>
  )
}
