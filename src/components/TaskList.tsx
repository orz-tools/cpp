import { Alignment, Button, Icon, IconName, Menu, MenuDivider, MenuItem, Navbar, Spinner } from '@blueprintjs/core'
import { ContextMenu2, MenuItem2 } from '@blueprintjs/popover2'
import { atom, useAtom, useAtomValue, useStore, WritableAtom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import { clone, intersection, sortBy, sum } from 'ramda'
import React, { SetStateAction, useCallback, useEffect, useMemo, useRef } from 'react'
import AutoSizer from 'react-virtualized-auto-sizer'
import { ListChildComponentProps, ListItemKeySelector, VariableSizeList } from 'react-window'
import { useContainer, useInject } from '../hooks/useContainer'
import { useRequest } from '../hooks/useRequest'
import { Container } from '../pkg/container'
import { Character, DataManager, ITEM_VIRTUAL_EXP } from '../pkg/cpp-core/DataManager'
import { Task as TaskDisplay, TaskType, UserDataAtomHolder } from '../pkg/cpp-core/UserData'
import { Store } from '../Store'
import { CachedImg } from './Icons'
import { ValueTag, ValueTagProgressBar } from './Value'

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
  valueTotal: number[]
  valueFulfilled: number[]
}
const emptyTaskExtra: TaskExtra = {
  status: TaskStatus.AllUnmet,
  costStatus: [],
  costConsumed: [],
  costSynthesised: [],
  valueTotal: [],
  valueFulfilled: [],
}

async function taskListQuery(
  container: Container,
  param: TaskListQueryParam,
): Promise<{ result: [TaskDisplay, TaskExtra][]; hideCosts: boolean }> {
  const dm = container.get(DataManager)
  const store = container.get(Store).store
  const atoms = container.get(UserDataAtomHolder)
  const tasks = store.get(atoms.allGoalTasks)
  const forbiddenFormulaTags = store.get(atoms.forbiddenFormulaTagsAtom)
  let quantities = clone(store.get(atoms.itemQuantities))

  const consumeItems = (
    inputCosts: { itemId: string; quantity: number }[],
  ): {
    result: boolean | undefined
    newQuantities?: Record<string, number>
    costStatus: TaskCostStatus[]
    costConsumed: number[]
    costSynthesised: number[]
    valueTotal: number[]
    valueFulfilled: number[]
  } => {
    const costStatus: TaskCostStatus[] = new Array(inputCosts.length).fill(TaskCostStatus.Completable)
    const costConsumed: number[] = new Array(inputCosts.length).fill(0)
    const costSynthesised: number[] = new Array(inputCosts.length).fill(0)
    const valueTotal: number[] = new Array(inputCosts.length).fill(0)
    const valueFulfilled: number[] = new Array(inputCosts.length).fill(0)
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
        valueTotal[cost.source] += (dm.data.items[cost.itemId].valueAsAp || 0) * cost.quantity
        valueFulfilled[cost.source] += (dm.data.items[cost.itemId].valueAsAp || 0) * cost.quantity
        newQuantities[cost.itemId] = quantity - cost.quantity
      } else {
        const left = cost.quantity - quantity
        if (quantity > 0) {
          if (cost.root) {
            costConsumed[cost.source] += quantity
          }
          valueTotal[cost.source] += (dm.data.items[cost.itemId].valueAsAp || 0) * quantity
          valueFulfilled[cost.source] += (dm.data.items[cost.itemId].valueAsAp || 0) * quantity
          newQuantities[cost.itemId] = 0
        }

        const formula = dm.data.formulas.find(
          (x) => x.itemId == cost.itemId && intersection(forbiddenFormulaTags || [], x.tags || []).length === 0,
        )
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
          if (cost.root) {
            costConsumed[cost.source] += sum(
              Object.values(dm.raw.exItems.expItems).map((x) => (newQuantities[x.id] || 0) * x.gainExp),
            )
          }
          let exp = cost.quantity
          valueTotal[cost.source] += (dm.data.items[ITEM_VIRTUAL_EXP].valueAsAp || 0) * exp
          const expItems = Object.values(dm.raw.exItems.expItems).sort((a, b) => -a.gainExp + b.gainExp)
          for (const expItem of expItems) {
            if (!newQuantities[expItem.id]) continue
            const need = Math.min(newQuantities[expItem.id], Math.floor(exp / expItem.gainExp))
            exp -= need * expItem.gainExp
            valueFulfilled[cost.source] += (dm.data.items[expItem.id].valueAsAp || 0) * need
            newQuantities[expItem.id] = newQuantities[expItem.id] - need
          }
          const smallestExpItemWithQuantity = expItems.reverse().find((x) => newQuantities[x.id] > 0)
          if (exp === 0) {
          } else if (smallestExpItemWithQuantity && exp <= smallestExpItemWithQuantity.gainExp) {
            exp = 0
            valueFulfilled[cost.source] += (dm.data.items[smallestExpItemWithQuantity.id].valueAsAp || 0) * 1
            newQuantities[smallestExpItemWithQuantity.id] -= 1
          } else {
            needSynthesis = undefined
            costStatus[cost.source] = TaskCostStatus.AllUnmet
          }
        } else {
          valueTotal[cost.source] += (dm.data.items[cost.itemId].valueAsAp || 0) * left
          // continue for task cost status
          needSynthesis = undefined
          costStatus[cost.source] = TaskCostStatus.AllUnmet
        }
      }
    }
    return {
      result: needSynthesis,
      newQuantities: newQuantities,
      costStatus,
      costConsumed,
      costSynthesised,
      valueFulfilled,
      valueTotal,
    }
  }

  const sortedTasks = tasks
  const map = new Map<TaskDisplay, TaskExtra>()
  const result: [TaskDisplay, TaskExtra][] = []
  for (const task of sortedTasks) {
    const taskExtra: TaskExtra = {
      status: TaskStatus.AllUnmet,
      costStatus: emptyTaskExtra.costStatus,
      costConsumed: emptyTaskExtra.costConsumed,
      costSynthesised: emptyTaskExtra.costSynthesised,
      valueFulfilled: emptyTaskExtra.valueFulfilled,
      valueTotal: emptyTaskExtra.valueTotal,
    }
    map.set(task, taskExtra)
    result.push([task, taskExtra])
    if (task.type._ == 'join') {
      taskExtra.status = TaskStatus.Manually
    } else {
      const { result, newQuantities, costStatus, costConsumed, costSynthesised, valueFulfilled, valueTotal } =
        consumeItems(task.requires)
      taskExtra.costStatus = costStatus
      taskExtra.costConsumed = costConsumed
      taskExtra.costSynthesised = costSynthesised
      taskExtra.valueFulfilled = valueFulfilled
      taskExtra.valueTotal = valueTotal
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

function TaskDisplay({ type, character }: { type: TaskType; character: Character }) {
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
    default:
      throwBad(type)
  }
}

function throwBad(p: never): never {
  throw new Error(`Missing switch coverage: ${p}`)
}

function TaskContextMenu({ task, extra }: { task: TaskDisplay; extra: TaskExtra }) {
  const atoms = useInject(UserDataAtomHolder)
  const store = useInject(Store).store
  const consumeCost = () => {
    for (const i of task.requires) {
      store.set(atoms.itemQuantity(i.itemId), (e) => {
        console.assert(e - i.quantity > 0)
        return e - i.quantity
      })
    }
  }
  const completeTask = () => {
    store.set(atoms.currentCharacter(task.charId), (d) => {
      const type = task.type
      switch (type._) {
        case 'elite':
          d.elite = type.elite
          break
        case 'join':
          d.level = 1
          break
        case 'level':
          d.level = type.to
          break
        case 'mod':
          d.modLevel[type.modId] = type.to
          break
        case 'skill':
          d.skillLevel = type.to
          break
        case 'skillMaster':
          d.skillMaster[type.skillId] = type.to
          break
        default:
          throwBad(type)
      }
    })
  }

  return (
    <Menu>
      <MenuItem
        text={'完成'}
        icon={'tick-circle'}
        disabled={extra.status !== TaskStatus.Completable}
        onClick={() => {
          store.set(atoms.dataAtom, 'transact', () => {
            consumeCost()
            completeTask()
          })
        }}
      />
      <MenuItem text={'强制完成（不消耗材料）'} icon={'cross-circle'} onClick={completeTask} />
    </Menu>
  )
}

export function TaskMenu({
  task,
  extra,
  style,
  same,
  nextSame,
  hideCosts,
}: {
  task: TaskDisplay
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
                  <span style={{ paddingLeft: '0.5em', fontWeight: 'normal', opacity: 0.75 }}>
                    {character.raw.appellation}
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
                <TaskDisplay type={task.type} character={character} />
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

function ItemStack({
  stack,
  task,
  style,
  status,
  consumed,
  synthesised,
}: {
  task: TaskDisplay
  stack: TaskDisplay['requires'][0]
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
      onContextMenu={preventDefault}
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

const emptyList: [TaskDisplay, TaskExtra][] = []
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
  }, [
    send,
    param,
    useAtomValue(atoms.allGoalTasks),
    useAtomValue(atoms.itemQuantities),
    useAtomValue(atoms.forbiddenFormulaTagsAtom),
  ])

  const hideCosts = response?.hideCosts || false
  const list = response?.result || emptyList
  const listRef = useRef<VariableSizeList<[TaskDisplay, TaskExtra][]>>(
    undefined as unknown as VariableSizeList<[TaskDisplay, TaskExtra][]>,
  )
  const child = useCallback(
    ({ index, data, style }: ListChildComponentProps<[TaskDisplay, TaskExtra][]>) => (
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
  const itemKey = useCallback<ListItemKeySelector<[TaskDisplay, TaskExtra][]>>((index, data) => data[index][0].id, [])
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
