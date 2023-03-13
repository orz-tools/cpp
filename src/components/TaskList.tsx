import { Alignment, Button, Menu, MenuItem, Navbar, Spinner } from '@blueprintjs/core'
import { atom, useAtomValue } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import { sortBy } from 'ramda'
import { SetStateAction, useCallback, useEffect, useMemo } from 'react'
import AutoSizer from 'react-virtualized-auto-sizer'
import { ListChildComponentProps, ListItemKeySelector, VariableSizeList } from 'react-window'
import { useContainer, useInject } from '../hooks/useContainer'
import { useRequest } from '../hooks/useRequest'
import { Container } from '../pkg/container'
import { Character, DataManager, formatItemStack } from '../pkg/cpp-core/DataManager'
import { Task, TaskType, UserDataAtomHolder } from '../pkg/cpp-core/UserData'
import { Store } from '../Store'
import { CachedImg } from './Icons'

interface TaskListQueryParam {}

// const queryParamAtom = atom<TaskListQueryParam>({ query: '', mode: ListMode.Fav })
const queryParamStorageAtom = atomWithStorage<TaskListQueryParam>('cpp_task_param', undefined as any)
const queryParamAtom = atom(
  (get) => {
    const value = Object.assign({}, get(queryParamStorageAtom) || {})
    return value
  },
  (get, set, value: TaskListQueryParam | SetStateAction<TaskListQueryParam>) => set(queryParamStorageAtom, value),
)

interface TaskExtra {}
const emptyTaskExtra: TaskExtra = {}

async function taskListQuery(container: Container, param: TaskListQueryParam): Promise<[Task, TaskExtra][]> {
  const dm = container.get(DataManager)
  const store = container.get(Store).store
  const atoms = container.get(UserDataAtomHolder)
  const tasks = store.get(atoms.allGoalTasks)

  return tasks.map((x) => [x, emptyTaskExtra])
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
      return <>{`${skill[1].raw.levels[0].name}: ${skillIndex + 1} 技能专${'一二三'[type.to - 1]}`}</>
    }
    case 'mod': {
      const uniEquip = character.uniEquips.find((x) => x.key == type.modId)!
      return <>{`${uniEquip.raw.uniEquipName}: ${uniEquip.raw.typeName2.toUpperCase()} 模组 ${type.to} 级`}</>
    }
  }
}

export function TaskMenu({ task, style }: { task: Task; style?: React.CSSProperties }) {
  const dm = useInject(DataManager)
  const character = dm.data.characters[task.charId]
  const sortedRequires = useMemo(
    () => sortBy((a) => dm.data.items[a.itemId].raw.sortId, task.requires),
    [dm, task.requires],
  )

  return (
    <li role="none" style={style} className="cpp-task-menu-master">
      <a
        role="menuitem"
        tabIndex={0}
        className="bp4-menu-item cpp-task-menu"
        style={{ flexShrink: 1, overflow: 'hidden' }}
      >
        <>
          <span className="bp4-menu-item-icon">
            <CachedImg src={character.avatar} width={'20'} height={'20'} alt={task.id} title={task.id} />
          </span>

          <div className="bp4-fill" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ display: 'flex', flexDirection: 'row', overflow: 'hidden' }}>
              <div className="bp4-text-overflow-ellipsis" style={{ flexShrink: 2, overflow: 'hidden' }}>
                {character.raw.name}
              </div>
              <div
                className="bp4-text-overflow-ellipsis"
                style={{ fontWeight: 'normal', flex: 1, overflow: 'hidden', textAlign: 'right' }}
              >
                <Task type={task.type} character={character} />
              </div>
            </div>
          </div>
        </>
      </a>
      <Menu style={{ padding: 0, paddingLeft: 27 }}>
        {sortedRequires.map((x) => (
          <MenuItem key={x.itemId} text={formatItemStack(dm, x)} style={{ fontWeight: 'normal' }}></MenuItem>
        ))}
      </Menu>
    </li>
  )
}

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

  const list = response || []
  const child = useCallback(
    ({ index, data, style }: ListChildComponentProps<[Task, TaskExtra][]>) => (
      <TaskMenu style={style} task={data[index][0]} />
    ),
    [],
  )
  const itemKey = useCallback<ListItemKeySelector<[Task, TaskExtra][]>>((index, data) => data[index][0].id, [])
  const itemSize = useCallback<(index: number) => number>((index) => list[index][0].requires.length * 30 + 30, [list])

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
        <Navbar.Group align={Alignment.LEFT}></Navbar.Group>
      </Navbar>
      <Menu style={{ flex: 1, flexShrink: 1 }}>
        <AutoSizer>
          {({ height, width }) => (
            <VariableSizeList
              overscanCount={5}
              height={height}
              itemCount={list.length}
              estimatedItemSize={30 * 5}
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
