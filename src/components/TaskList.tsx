import { Alignment, Button, Icon, IconName, Menu, MenuDivider, MenuItem, Navbar } from '@blueprintjs/core'
import { ContextMenu2, MenuItem2 } from '@blueprintjs/popover2'
import { WritableAtom, atom, useAtom, useAtomValue } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import { sortBy, sum } from 'ramda'
import React, { SetStateAction, useCallback, useEffect, useMemo, useRef } from 'react'
import AutoSizer from 'react-virtualized-auto-sizer'
import { ListChildComponentProps, ListItemKeySelector, VariableSizeList } from 'react-window'
import { useAtoms, useGameAdapter, useStore } from '../Cpp'
import { IGame, Task } from '../pkg/cpp-basic'
import { TaskCostStatus, TaskExtra, TaskStatus } from '../pkg/cpp-core/Task'
import { CachedImg } from './Icons'
import { ValueTagProgressBar } from './Value'

interface TaskListQueryParam {
  hideCosts: boolean
}

// const queryParamAtom = atom<TaskListQueryParam>({ query: '', mode: ListMode.Fav })
const queryParamStorageAtom = atomWithStorage<TaskListQueryParam>('cpp_task_param', undefined as any)
const queryParamAtom: WritableAtom<
  TaskListQueryParam,
  [TaskListQueryParam | SetStateAction<TaskListQueryParam>],
  void
> = atom<TaskListQueryParam, [TaskListQueryParam | SetStateAction<TaskListQueryParam>], void>(
  (get) => {
    const value = Object.assign({}, get(queryParamStorageAtom) || {})
    if (value.hideCosts == null) value.hideCosts = false
    return value
  },
  (get, set, value: TaskListQueryParam | SetStateAction<TaskListQueryParam>) =>
    set(queryParamStorageAtom, typeof value === 'function' ? value(get(queryParamAtom)) : value),
)

function TaskDisplay<G extends IGame>({ type, charId }: { type: G['characterTaskType']; charId: string }) {
  const ga = useGameAdapter()
  return <>{ga.getUserDataAdapter().formatTaskAsString(type, charId)}</>
}

function TaskContextMenu<G extends IGame>({ task, extra }: { task: Task<G>; extra: TaskExtra }) {
  const store = useStore()
  const atoms = useAtoms<G>()
  const ga = useGameAdapter<G>()

  const consumeCost = () => {
    for (const i of task.requires) {
      const allExpItems = ga.getExpItems()
      if (Object.prototype.hasOwnProperty.call(allExpItems, i.itemId)) {
        let exp = i.quantity
        const thisExpItems = allExpItems[i.itemId]
        const expItems = Object.entries(thisExpItems.value).sort((a, b) => -a[1] + b[1])
        const quantities: Record<string, number> = Object.create(null)
        const cost: Record<string, number> = Object.create(null)
        for (const expItem of expItems) {
          quantities[expItem[0]] = store.get(atoms.itemQuantity(expItem[0]))
          cost[expItem[0]] = 0
        }
        for (const expItem of expItems) {
          if (!quantities[expItem[0]]) continue
          const need = Math.min(quantities[expItem[0]], Math.floor(exp / expItem[1]))
          exp -= need * expItem[1]
          quantities[expItem[0]] = quantities[expItem[0]] - need
          cost[expItem[0]] += need
        }
        const smallestExpItemWithQuantity = expItems.reverse().find((x) => quantities[x[0]] > 0)
        if (exp === 0) {
        } else if (smallestExpItemWithQuantity && exp <= smallestExpItemWithQuantity[1]) {
          exp = 0
          quantities[smallestExpItemWithQuantity[0]] -= 1
          cost[smallestExpItemWithQuantity[0]] += 1
        } else {
          console.assert(false, 'virtual exp failed')
        }
        for (const [itemId, quantity] of Object.entries(cost)) {
          store.set(atoms.itemQuantity(itemId), (e) => {
            console.assert(e - quantity > 0, 'exp item failed')
            return e - quantity
          })
        }
      } else {
        store.set(atoms.itemQuantity(i.itemId), (e) => {
          console.assert(e - i.quantity > 0, 'normal item failed')
          return e - i.quantity
        })
      }
    }
  }

  const completeTask = () => {
    store.set(atoms.currentCharacter(task.charId), (d) => {
      ga.getUserDataAdapter().completeTask(task.type, task.charId, d)
    })
  }

  return (
    <Menu>
      <MenuItem
        text={'完成'}
        icon={'tick-circle'}
        disabled={extra.status !== TaskStatus.Completable || !!task.depends.length}
        onClick={() => {
          store.set(atoms.dataAtom, 'transact', () => {
            consumeCost()
            completeTask()
          })
        }}
      />
      <MenuItem
        text={'强制完成（不消耗材料）'}
        disabled={!!task.depends.length}
        icon={'cross-circle'}
        onClick={completeTask}
      />
    </Menu>
  )
}

export function TaskMenu<G extends IGame>({
  task,
  extra,
  style,
  same,
  nextSame,
  hideCosts,
}: {
  task: Task<G>
  extra: TaskExtra
  style?: React.CSSProperties
  same?: boolean
  nextSame?: boolean
  hideCosts: boolean
}) {
  const ga = useGameAdapter<G>()
  const character = ga.getCharacter(task.charId)
  const sortedRequires = useMemo(
    () =>
      sortBy(
        (a) => ga.getItem(a[0].itemId).sortId,
        task.requires.map((r, i) => [r, i] as const),
      ),
    [ga, task.requires],
  )

  const renderedCosts = sortedRequires.map(([x, i]) => (
    <ItemStack<G>
      key={x.itemId}
      task={task}
      stack={x}
      style={hideCosts ? {} : { marginLeft: 22 }}
      status={extra.costStatus[i]}
      consumed={extra.quantityCanConsume[i]}
      synthesised={extra.costSynthesised[i]}
    />
  ))

  return (
    <li role="none" style={style} className="cpp-task-menu-master">
      {same ? undefined : (
        <a
          role="menuitem"
          tabIndex={0}
          className="bp4-menu-item cpp-task-menu"
          style={{ flexShrink: 1, overflow: 'hidden' }}
        >
          <>
            <span className="bp4-menu-item-icon">
              <CachedImg src={character.avatar} width={'16'} height={'16'} alt={character.key} title={character.key} />
            </span>

            <div className="bp4-fill" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ display: 'flex', flexDirection: 'row', overflow: 'hidden' }}>
                <div className="bp4-text-overflow-ellipsis" style={{ flexShrink: 2, overflow: 'hidden' }}>
                  {character.name}
                  <span style={{ paddingLeft: '0.5em', fontWeight: 'normal', opacity: 0.75 }}>
                    {character.appellation}
                  </span>
                </div>
              </div>
            </div>
          </>
        </a>
      )}
      <Menu style={{ padding: 0 }}>
        <ContextMenu2 content={<TaskContextMenu task={task} extra={extra} />}>
          <MenuItem2
            // title={task.id}
            style={{ fontWeight: 'normal' }}
            text={
              <>
                {extra.status == TaskStatus.AllUnmet ? (
                  <ValueTagProgressBar
                    value={sum(extra.valueTotal) - sum(extra.valueFulfilled)}
                    maxValue={sum(extra.valueTotal)}
                    minimal={true}
                    style={{ float: 'right' }}
                  />
                ) : null}
                <TaskDisplay type={task.type} charId={character.key} />
              </>
            }
            icon={StatusIcon[extra.status]}
            popoverProps={{ usePortal: true, matchTargetWidth: true }}
          >
            {hideCosts && renderedCosts.length > 0 ? renderedCosts : null}
          </MenuItem2>
        </ContextMenu2>
        {hideCosts ? null : renderedCosts}
        {nextSame ? <MenuDivider /> : null}
      </Menu>
      {nextSame ? null : <MenuDivider />}
    </li>
  )
}

const preventDefault = (e: React.MouseEvent<any, MouseEvent>) => e.preventDefault()

const StatusIcon = {
  [TaskStatus.AllUnmet]: 'cross',
  [TaskStatus.Completable]: 'tick',
  [TaskStatus.DependencyUnmet]: 'blank',
  [TaskStatus.Synthesizable]: 'build',
  [TaskStatus.Manually]: 'pulse',
} satisfies { [K in TaskStatus]: IconName }

const CostStatusIcon = {
  [TaskCostStatus.AllUnmet]: 'cross',
  [TaskCostStatus.Completable]: 'tick',
  [TaskCostStatus.Synthesizable]: 'build',
} satisfies { [K in TaskCostStatus]: IconName }

function ItemStack<G extends IGame>({
  stack,
  task,
  style,
  status,
  consumed,
  synthesised,
}: {
  task: Task<G>
  stack: Task<G>['requires'][0]
  style?: React.CSSProperties
  status: TaskCostStatus
  consumed: number
  synthesised: number
}) {
  const ga = useGameAdapter<G>()
  const item = ga.getItem(stack.itemId)
  return (
    <MenuItem
      key={stack.itemId}
      icon={
        <div style={{ display: 'flex' }}>
          <Icon icon={CostStatusIcon[status]} size={16} style={{ padding: 2 }} />
          <CachedImg src={item.icon} width={'20'} height={'20'} alt={item.key} title={item.key} />
        </div>
      }
      onContextMenu={preventDefault}
      text={
        <>
          <span>{item.name}</span>
          <span style={{ float: 'right' }}>
            {consumed > 0 || (consumed <= 0 && synthesised <= 0) ? consumed : undefined}
            {consumed > 0 && synthesised > 0 ? ' + ' : undefined}
            {synthesised > 0 ? (
              <>
                <Icon icon={'build'} size={10} style={{ padding: 0, paddingBottom: 4, opacity: 0.5 }} />
                {synthesised}
              </>
            ) : undefined}
            {' / '}
            {stack.quantity}
          </span>
        </>
      }
      style={{ fontWeight: 'normal', ...style }}
    ></MenuItem>
  )
}

function HideCostsButton() {
  const [param, setParam] = useAtom(queryParamAtom)
  return (
    <Button
      minimal={true}
      active={param.hideCosts}
      icon={'eye-off'}
      onClick={() => {
        setParam((p) => {
          return { ...p, hideCosts: !p.hideCosts }
        })
      }}
    />
  )
}

export function TaskList<G extends IGame>() {
  const atoms = useAtoms<G>()
  const param = useAtomValue(queryParamAtom)

  const hideCosts = param.hideCosts || false
  const list = useAtomValue(atoms.goalTasksWithExtra)
  const listRef = useRef<VariableSizeList<[Task<G>, TaskExtra][]>>(
    undefined as unknown as VariableSizeList<[Task<G>, TaskExtra][]>,
  )
  const child = useCallback(
    ({ index, data, style }: ListChildComponentProps<[Task<G>, TaskExtra][]>) => (
      <TaskMenu<G>
        style={style}
        task={data[index][0]}
        extra={data[index][1]}
        same={data[index - 1]?.[0].charId == data[index][0].charId}
        nextSame={data[index + 1]?.[0].charId == data[index][0].charId}
        hideCosts={param.hideCosts}
      />
    ),
    [param],
  )
  const itemKey = useCallback<ListItemKeySelector<[Task<G>, TaskExtra][]>>((index, data) => data[index][0].id, [])
  const itemSize = useCallback<(index: number) => number>(
    (index) => {
      const same = list[index - 1]?.[0].charId == list[index][0].charId
      const nextSame = list[index + 1]?.[0].charId == list[index][0].charId
      const costs = hideCosts ? 0 : list[index][0].requires.length * 30
      const base = costs + (same ? 0 : 30) + 30 + (hideCosts && nextSame ? 0 : 11)
      return base
    },
    [list, hideCosts],
  )

  useEffect(() => {
    if (!listRef.current) return
    listRef.current.resetAfterIndex(0)
  }, [list, param])

  return (
    <>
      <Navbar>
        <Navbar.Group align={Alignment.RIGHT}></Navbar.Group>
        <Navbar.Group align={Alignment.LEFT}>
          <HideCostsButton />
        </Navbar.Group>
      </Navbar>
      <Menu style={{ flex: 1, flexShrink: 1 }}>
        <AutoSizer>
          {({ height, width }) => (
            <VariableSizeList
              ref={listRef}
              overscanCount={5}
              height={height}
              itemCount={list.length}
              estimatedItemSize={hideCosts ? 30 : 30 * 5 + 11}
              itemSize={itemSize}
              width={width}
              itemKey={itemKey}
              itemData={list}
            >
              {child}
            </VariableSizeList>
          )}
        </AutoSizer>
      </Menu>
    </>
  )
}
