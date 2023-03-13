import { Alignment, Button, Menu, MenuDivider, MenuItem, Navbar, Spinner } from '@blueprintjs/core'
import { Atom, atom, useAtom, useAtomValue, WritableAtom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import { sortBy } from 'ramda'
import React, { SetStateAction, useCallback, useEffect, useMemo, useRef } from 'react'
import AutoSizer from 'react-virtualized-auto-sizer'
import { ListChildComponentProps, ListItemKeySelector, VariableSizeList } from 'react-window'
import { useContainer, useInject } from '../hooks/useContainer'
import { useRequest } from '../hooks/useRequest'
import { Container } from '../pkg/container'
import { Character, DataManager, formatItemStack } from '../pkg/cpp-core/DataManager'
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

interface TaskExtra {}
const emptyTaskExtra: TaskExtra = {}

async function taskListQuery(
  container: Container,
  param: TaskListQueryParam,
): Promise<{ result: [Task, TaskExtra][]; hideCosts: boolean }> {
  const dm = container.get(DataManager)
  const store = container.get(Store).store
  const atoms = container.get(UserDataAtomHolder)
  const tasks = store.get(atoms.allGoalTasks)

  return { result: tasks.map((x) => [x, emptyTaskExtra]), hideCosts: param.hideCosts }
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
  style,
  same,
  nextSame,
  hideCosts,
}: {
  task: Task
  style?: React.CSSProperties
  same?: boolean
  nextSame?: boolean
  hideCosts: boolean
}) {
  const dm = useInject(DataManager)
  const character = dm.data.characters[task.charId]
  const sortedRequires = useMemo(
    () => sortBy((a) => dm.data.items[a.itemId].raw.sortId, task.requires),
    [dm, task.requires],
  )

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
        <MenuItem
          style={{ fontWeight: 'normal' }}
          text={<Task type={task.type} character={character} />}
          icon={'tick'}
        />
        {hideCosts
          ? null
          : sortedRequires.map((x) => <ItemStack key={x.itemId} task={task} stack={x} style={{ marginLeft: 22 }} />)}
        {nextSame ? <MenuDivider /> : null}
      </Menu>
      {nextSame ? null : <MenuDivider />}
    </li>
  )
}

function ItemStack({ stack, task, style }: { task: Task; stack: Task['requires'][0]; style?: React.CSSProperties }) {
  const dm = useInject(DataManager)
  const item = dm.data.items[stack.itemId]
  return (
    <MenuItem
      key={stack.itemId}
      icon={<CachedImg src={item.icon} width={'20'} height={'20'} alt={item.key} title={item.key} />}
      text={
        <>
          <span>{item.raw.name}</span>
          <span style={{ float: 'right' }}>{stack.quantity}</span>
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
  const tasks = useAtomValue(atoms.allGoalTasks)
  useEffect(() => {
    refresh()
  }, [tasks, send, param])

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
