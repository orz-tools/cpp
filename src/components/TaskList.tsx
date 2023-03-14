import { Alignment, Button, Icon, IconName, Menu, MenuDivider, MenuItem, Navbar, Spinner } from '@blueprintjs/core'
import { MenuItem2 } from '@blueprintjs/popover2'
import { atom, useAtom, useAtomValue, WritableAtom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import { clone, sortBy } from 'ramda'
import React, { SetStateAction, useCallback, useEffect, useMemo, useRef } from 'react'
import AutoSizer from 'react-virtualized-auto-sizer'
import { ListChildComponentProps, ListItemKeySelector, VariableSizeList } from 'react-window'
import { useContainer, useInject } from '../hooks/useContainer'
import { useRequest } from '../hooks/useRequest'
import { Container } from '../pkg/container'
import { Character, DataManager, ITEM_VIRTUAL_EXP } from '../pkg/cpp-core/DataManager'
import { Task, TaskType, UserDataAtomHolder } from '../pkg/cpp-core/UserData'
import { Store } from '../Store'
import { CachedImg } from './Icons'

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

enum TaskStatus {
  Completable,
  Synthesizable,
  DependencyUnmet,
  AllUnmet,
  Manually,
}

enum TaskCostStatus {
  Completable,
  Synthesizable,
  AllUnmet,
}

interface TaskExtra {
  status: TaskStatus
  costStatus: TaskCostStatus[]
  costConsumed: number[]
  costSynthesised: number[]
}
const emptyTaskExtra: TaskExtra = { status: TaskStatus.AllUnmet, costStatus: [], costConsumed: [], costSynthesised: [] }

async function taskListQuery(
  container: Container,
  param: TaskListQueryParam,
): Promise<{ result: [Task, TaskExtra][]; hideCosts: boolean }> {
  const dm = container.get(DataManager)
  const store = container.get(Store).store
  const atoms = container.get(UserDataAtomHolder)
  const tasks = store.get(atoms.allGoalTasks)
  let quantities = clone(store.get(atoms.itemQuantities))

  const consumeItems = (
    inputCosts: { itemId: string; quantity: number }[],
  ): {
    result: boolean | undefined
    newQuantities?: Record<string, number>
    costStatus: TaskCostStatus[]
    costConsumed: number[]
    costSynthesised: number[]
  } => {
    const costStatus: TaskCostStatus[] = new Array(inputCosts.length).fill(TaskCostStatus.Completable)
    const costConsumed: number[] = new Array(inputCosts.length).fill(0)
    const costSynthesised: number[] = new Array(inputCosts.length).fill(0)
    let needSynthesis: boolean | undefined = false
    const newQuantities = clone(quantities)
    const queue: { itemId: string; quantity: number; source: number; root: boolean }[] = inputCosts.map((x, i) => ({
      ...x,
      source: i,
      root: true,
    }))
    while (queue.length > 0) {
      const cost = queue.shift()!
      // if (cost.itemId !== ITEM_VIRTUAL_EXP) {
      const quantity = newQuantities[cost.itemId] || 0
      if (quantity >= cost.quantity) {
        if (cost.root) {
          costConsumed[cost.source] += quantity
        }
        newQuantities[cost.itemId] = quantity - cost.quantity
      } else {
        const left = cost.quantity - quantity
        if (quantity > 0) {
          if (cost.root) {
            costConsumed[cost.source] += quantity
          }
          newQuantities[cost.itemId] = 0
        }

        const formula = dm.data.formulas.find((x) => x.itemId == cost.itemId)
        if (formula) {
          if (cost.root) {
            costSynthesised[cost.source] += left
          }
          if (needSynthesis === false) {
            needSynthesis = true
          }
          if (costStatus[cost.source] === TaskCostStatus.Completable) {
            costStatus[cost.source] = TaskCostStatus.Synthesizable
          }
          const times = Math.ceil(left / formula.quantity)
          const extra = times * formula.quantity - left
          newQuantities[cost.itemId] = (newQuantities[cost.itemId] || 0) + extra
          for (const formulaCost of formula.costs) {
            queue.push({
              itemId: formulaCost.itemId,
              quantity: formulaCost.quantity * times,
              source: cost.source,
              root: false,
            })
          }
        } else if (cost.itemId == ITEM_VIRTUAL_EXP) {
          let exp = cost.quantity
          const expItems = Object.values(dm.raw.exItems.expItems).sort((a, b) => -a.gainExp + b.gainExp)
          for (const expItem of expItems) {
            if (!newQuantities[expItem.id]) continue
            const need = Math.min(newQuantities[expItem.id], Math.floor(exp / expItem.gainExp))
            exp -= need * expItem.gainExp
            newQuantities[expItem.id] = newQuantities[expItem.id] - need
          }
          const smallestExpItemWithQuantity = expItems.reverse().find((x) => newQuantities[x.id] > 0)
          if (exp === 0) {
          } else if (smallestExpItemWithQuantity && exp <= smallestExpItemWithQuantity.gainExp) {
            exp = 0
            newQuantities[smallestExpItemWithQuantity.id] -= 1
          } else {
            needSynthesis = undefined
            costStatus[cost.source] = TaskCostStatus.AllUnmet
          }
        } else {
          // continue for task cost status
          needSynthesis = undefined
          costStatus[cost.source] = TaskCostStatus.AllUnmet
        }
      }
    }
    return { result: needSynthesis, newQuantities: newQuantities, costStatus, costConsumed, costSynthesised }
  }

  const sortedTasks = tasks
  const map = new Map<Task, TaskExtra>()
  const result: [Task, TaskExtra][] = []
  for (const task of sortedTasks) {
    const taskExtra: TaskExtra = {
      status: TaskStatus.AllUnmet,
      costStatus: emptyTaskExtra.costStatus,
      costConsumed: emptyTaskExtra.costConsumed,
      costSynthesised: emptyTaskExtra.costSynthesised,
    }
    map.set(task, taskExtra)
    result.push([task, taskExtra])
    if (task.type._ == 'join') {
      taskExtra.status = TaskStatus.Manually
    } else {
      const { result, newQuantities, costStatus, costConsumed, costSynthesised } = consumeItems(task.requires)
      taskExtra.costStatus = costStatus
      taskExtra.costConsumed = costConsumed
      taskExtra.costSynthesised = costSynthesised
      quantities = newQuantities!
      if (result == null) {
        taskExtra.status = TaskStatus.AllUnmet
      } else {
        if (result) {
          taskExtra.status = TaskStatus.Synthesizable
        } else {
          taskExtra.status = TaskStatus.Completable
        }

        const dependencyUnmet = !task.depends.every((x) => {
          const tx = map.get(x)
          if (!tx) return false
          switch (tx.status) {
            case TaskStatus.AllUnmet:
              return false
            case TaskStatus.Completable:
              return true
            case TaskStatus.DependencyUnmet:
              return false
            case TaskStatus.Synthesizable:
              return true
            case TaskStatus.Manually:
              return false
          }
        })

        if (dependencyUnmet) {
          taskExtra.status = TaskStatus.DependencyUnmet
        }
      }
    }
  }

  return { result: tasks.map((x) => [x, map.get(x)!]), hideCosts: param.hideCosts }
}

export function Task({ type, character }: { type: TaskType; character: Character }) {
  switch (type._) {
    case 'join':
      return <>招募</>
    case 'skill':
      return <>{`技能 ${type.to} 级`}</>
    case 'elite':
      return <>{`精${'零一二'[type.elite]}`}</>
    case 'level':
      return <>{`精${'零一二'[type.elite]}等级 ${type.from} -> ${type.to}`}</>
    case 'skillMaster': {
      const skillIndex = character.skills.findIndex((x) => x[0].skillId == type.skillId)
      const skill = character.skills[skillIndex]
      return <>{`${skillIndex + 1} 技能专${'一二三'[type.to - 1]}: ${skill[1].raw.levels[0].name}`}</>
    }
    case 'mod': {
      const uniEquip = character.uniEquips.find((x) => x.key == type.modId)!
      return <>{`${uniEquip.raw.typeName2.toUpperCase()} 模组 ${type.to} 级: ${uniEquip.raw.uniEquipName}`}</>
    }
  }
}

export function TaskMenu({
  task,
  extra,
  style,
  same,
  nextSame,
  hideCosts,
}: {
  task: Task
  extra: TaskExtra
  style?: React.CSSProperties
  same?: boolean
  nextSame?: boolean
  hideCosts: boolean
}) {
  const dm = useInject(DataManager)
  const character = dm.data.characters[task.charId]
  const sortedRequires = useMemo(
    () =>
      sortBy(
        (a) => dm.data.items[a[0].itemId].raw.sortId,
        task.requires.map((r, i) => [r, i] as const),
      ),
    [dm, task.requires],
  )

  const renderedCosts = sortedRequires.map(([x, i]) => (
    <ItemStack
      key={x.itemId}
      task={task}
      stack={x}
      style={hideCosts ? {} : { marginLeft: 22 }}
      status={extra.costStatus[i]}
      consumed={extra.costConsumed[i]}
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
              <CachedImg src={character.avatar} width={'16'} height={'16'} alt={task.id} title={task.id} />
            </span>

            <div className="bp4-fill" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ display: 'flex', flexDirection: 'row', overflow: 'hidden' }}>
                <div className="bp4-text-overflow-ellipsis" style={{ flexShrink: 2, overflow: 'hidden' }}>
                  {character.raw.name}
                </div>
              </div>
            </div>
          </>
        </a>
      )}
      <Menu style={{ padding: 0 }}>
        <MenuItem2
          style={{ fontWeight: 'normal' }}
          text={<Task type={task.type} character={character} />}
          icon={StatusIcon[extra.status]}
          popoverProps={{ usePortal: true, matchTargetWidth: true }}
        >
          {hideCosts && renderedCosts.length > 0 ? renderedCosts : null}
        </MenuItem2>
        {hideCosts ? null : renderedCosts}
        {nextSame ? <MenuDivider /> : null}
      </Menu>
      {nextSame ? null : <MenuDivider />}
    </li>
  )
}

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

function ItemStack({
  stack,
  task,
  style,
  status,
  consumed,
  synthesised,
}: {
  task: Task
  stack: Task['requires'][0]
  style?: React.CSSProperties
  status: TaskCostStatus
  consumed: number
  synthesised: number
}) {
  const dm = useInject(DataManager)
  const item = dm.data.items[stack.itemId]
  return (
    <MenuItem
      key={stack.itemId}
      icon={
        <div style={{ display: 'flex' }}>
          <Icon icon={CostStatusIcon[status]} size={16} style={{ padding: 2 }} />
          <CachedImg src={item.icon} width={'20'} height={'20'} alt={item.key} title={item.key} />
        </div>
      }
      text={
        <>
          <span>{item.raw.name}</span>
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

const emptyList: [Task, TaskExtra][] = []
export function TaskList() {
  const param = useAtomValue(queryParamAtom)

  const container = useContainer()
  const { send, response, loading } = useRequest(taskListQuery)

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

  const atoms = useInject(UserDataAtomHolder)
  useEffect(() => {
    refresh()
  }, [send, param, useAtomValue(atoms.allGoalTasks), useAtomValue(atoms.itemQuantities)])

  const hideCosts = response?.hideCosts || false
  const list = response?.result || emptyList
  const listRef = useRef<VariableSizeList<[Task, TaskExtra][]>>(
    undefined as unknown as VariableSizeList<[Task, TaskExtra][]>,
  )
  const child = useCallback(
    ({ index, data, style }: ListChildComponentProps<[Task, TaskExtra][]>) => (
      <TaskMenu
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
  const itemKey = useCallback<ListItemKeySelector<[Task, TaskExtra][]>>((index, data) => data[index][0].id, [])
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
  }, [list])

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
              estimatedItemSize={(hideCosts ? 30 : 30 * 5) + 11}
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
