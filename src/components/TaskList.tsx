import { Alignment, Button, ContextMenu, Icon, IconName, Menu, MenuDivider, MenuItem, Navbar } from '@blueprintjs/core'
import { useVirtualizer } from '@tanstack/react-virtual'
import { WritableAtom, atom, useAtom, useAtomValue } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import { sortBy, sum } from 'ramda'
import React, { SetStateAction, memo, useCallback, useEffect, useMemo, useRef } from 'react'
import useEvent from 'react-use-event-hook'
import { useAtoms, useGameAdapter, useStore } from '../Cpp'
import { IGame, Task } from '../pkg/cpp-basic'
import { TaskCostStatus, TaskExtra, TaskStatus } from '../pkg/cpp-core/Task'
import { StarStatus } from '../pkg/cpp-core/UserData'
import { gt } from '../pkg/gt'
import { CharacterContextMenu } from './CharacterList'
import { CachedImg, ItemIcon } from './Icons'
import { ValueTagProgressBar } from './Value'

interface TaskListQueryParam {
  hideCosts: boolean
}

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

const TaskDisplay = memo(<G extends IGame>({ type, charId }: { type: G['characterTaskType']; charId: string }) => {
  const ga = useGameAdapter()
  return <>{ga.getUserDataAdapter().formatTaskAsString(type, charId)}</>
})

const TaskContextMenu = memo(<G extends IGame>({ task, extra }: { task: Task<G>; extra: TaskExtra }) => {
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
          //
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

  const stars = useAtomValue(atoms.stars)

  const completeTask = () => {
    store.set(atoms.currentCharacter(task.charId), (d) => {
      ga.getUserDataAdapter().completeTask(task.type, task.charId, d)
    })
  }

  const starTask = () => {
    store.set(atoms.stars, (d) => {
      const pos = d.indexOf(task.id)
      if (pos >= 0) {
        d.splice(pos, 1)
      } else {
        d.push(task.id)
      }
    })
  }

  return (
    <Menu>
      <MenuItem
        text={gt.gettext('完成')}
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
        text={gt.gettext('强制完成（不消耗材料）')}
        disabled={!!task.depends.length}
        icon={'cross-circle'}
        onClick={completeTask}
      />
      <MenuDivider />
      <MenuItem
        text={gt.gettext('优先培养（星标）')}
        icon={'star'}
        active={stars.includes(task.id)}
        onClick={starTask}
      />
    </Menu>
  )
})

export const TaskMenu = memo(
  <G extends IGame>({
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
  }) => {
    const ga = useGameAdapter<G>()
    const character = ga.getCharacter(task.charId)
    const detailsAtom = useAtoms().allStarredTasksDetails
    const details = useAtomValue(detailsAtom)
    const sortedRequires = useMemo(
      () =>
        sortBy(
          (a) => ga.getItem(a[0].itemId).sortId,
          task.requires.map((r, i) => [r, i] as const),
        ),
      [ga, task.requires],
    )

    const renderedCosts = sortedRequires.map(([x, i]) => (
      <ItemStack
        key={x.itemId}
        task={task}
        stack={x}
        style={hideCosts ? {} : { marginLeft: 22 }}
        status={extra.costStatus[i]}
        consumed={extra.quantityCanConsume[i]}
        synthesised={extra.costSynthesised[i]}
      />
    ))

    const starred = details.directStars.has(task)
      ? StarStatus.Starred
      : details.indirectStars.has(task)
      ? StarStatus.Depended
      : StarStatus.None

    const starIcon: IconName | null = hideCosts
      ? (
          {
            [StarStatus.None]: 'caret-right',
            [StarStatus.Starred]: 'star',
            [StarStatus.Depended]: 'star-empty',
          } as const
        )[starred]
      : (
          {
            [StarStatus.None]: null,
            [StarStatus.Starred]: 'star',
            [StarStatus.Depended]: 'star-empty',
          } as const
        )[starred]

    return (
      <li role="none" style={style} className="cpp-task-menu-master">
        {same ? undefined : (
          <ContextMenu content={<CharacterContextMenu character={character} alwaysSorting={true} />}>
            <a
              role="menuitem"
              tabIndex={0}
              className="bp5-menu-item cpp-task-menu"
              style={{ flexShrink: 1, overflow: 'hidden' }}
            >
              <>
                <span className="bp5-menu-item-icon">
                  <CachedImg
                    src={character.avatar}
                    width={'16'}
                    height={'16'}
                    alt={character.key}
                    title={character.key}
                  />
                </span>

                <div className="bp5-fill" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <div style={{ display: 'flex', flexDirection: 'row', overflow: 'hidden' }}>
                    <div className="bp5-text-overflow-ellipsis" style={{ flexShrink: 2, overflow: 'hidden' }}>
                      {character.name}
                      <span style={{ paddingLeft: '0.5em', fontWeight: 'normal', opacity: 0.75 }}>
                        {character.appellation}
                      </span>
                    </div>
                  </div>
                </div>
              </>
            </a>
          </ContextMenu>
        )}
        <Menu style={{ padding: 0 }}>
          <ContextMenu content={<TaskContextMenu task={task} extra={extra} />}>
            <MenuItem
              className="cpp-menu-nosubmenu"
              // title={task.id}
              style={{ fontWeight: 'normal' }}
              icon={StatusIcon[extra.status]}
              text={
                <div style={{ display: 'flex' }}>
                  <div style={{ flex: 1, flexShrink: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    <TaskDisplay type={task.type} charId={character.key} />
                  </div>
                  {extra.status === TaskStatus.AllUnmet ? (
                    <div>
                      <ValueTagProgressBar
                        value={sum(extra.valueTotal) - sum(extra.valueFulfilled)}
                        maxValue={sum(extra.valueTotal)}
                        minimal={true}
                        style={{ flexShrink: 0 }}
                      />{' '}
                    </div>
                  ) : null}
                  {starIcon == null ? null : (
                    <div style={{ marginLeft: 4 }}>
                      <Icon icon={starIcon} className="bp5-menu-item-icon" size={16} />
                    </div>
                  )}
                </div>
              }
              popoverProps={{ usePortal: true, matchTargetWidth: true }}
            >
              {hideCosts && renderedCosts.length > 0 ? renderedCosts : null}
            </MenuItem>
          </ContextMenu>
          {hideCosts ? null : renderedCosts}
          {nextSame && !hideCosts ? <MenuDivider /> : null}
        </Menu>
        {nextSame ? null : <MenuDivider />}
      </li>
    )
  },
)

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

const ItemStack = memo(
  <G extends IGame>({
    stack,
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
  }) => {
    const ga = useGameAdapter<G>()
    const item = ga.getItem(stack.itemId)
    return (
      <MenuItem
        className="cpp-menu-not-interactive"
        key={stack.itemId}
        icon={
          <div style={{ display: 'flex' }}>
            <Icon icon={CostStatusIcon[status]} size={16} style={{ padding: 2 }} />
            <ItemIcon item={item} size={20} />
          </div>
        }
        onContextMenu={preventDefault}
        text={
          <div style={{ display: 'flex' }}>
            <span style={{ flex: 1, flexShrink: 1 }}>{item.name}</span>
            <span>
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
          </div>
        }
        style={{ fontWeight: 'normal', ...style }}
      />
    )
  },
)

const HideCostsButton = memo(() => {
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
})

export const TaskList = memo(<G extends IGame>() => {
  const atoms = useAtoms<G>()
  const param = useAtomValue(queryParamAtom)

  const hideCosts = param.hideCosts || false
  const list = useAtomValue(atoms.goalTasksWithExtra)
  const itemSize = useCallback<(index: number) => number>(
    (index) => {
      const same = list[index - 1]?.[0].charId === list[index][0].charId
      const nextSame = list[index + 1]?.[0].charId === list[index][0].charId
      const costs = hideCosts ? 0 : list[index][0].requires.length * 30
      const base = costs + (same ? 0 : 30) + 30 + (hideCosts && nextSame ? 0 : 11)
      return base
    },
    [list, hideCosts],
  )

  const parentRef = useRef<HTMLUListElement>(null)

  const rowVirtualizer = useVirtualizer({
    count: list.length,
    getScrollElement: () => parentRef.current,
    getItemKey: (index) => list[index][0].id,
    estimateSize: itemSize,
    overscan: 5,
  })

  const remeasure = useEvent(() => {
    rowVirtualizer.measure()
  })

  useEffect(() => {
    remeasure()
  }, [param, remeasure])

  return (
    <>
      <Navbar>
        <Navbar.Group align={Alignment.RIGHT} />
        <Navbar.Group align={Alignment.LEFT}>
          <HideCostsButton />
        </Navbar.Group>
      </Navbar>
      <Menu style={{ flex: 1, flexShrink: 1, overflow: 'auto' }} ulRef={parentRef}>
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
              <TaskMenu
                key={virtualRow.key}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                task={list[index][0]}
                extra={list[index][1]}
                same={list[index - 1]?.[0].charId === list[index][0].charId}
                nextSame={list[index + 1]?.[0].charId === list[index][0].charId}
                hideCosts={param.hideCosts}
              />
            )
          })}
        </div>
      </Menu>
    </>
  )
})
