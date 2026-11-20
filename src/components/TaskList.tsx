import {
  Alignment,
  Button,
  ContextMenu,
  Icon,
  IconName,
  Menu,
  MenuDivider,
  MenuItem,
  MenuItemProps,
  Navbar,
  PopoverNextProps,
} from '@blueprintjs/core'
import { useVirtualizer } from '@tanstack/react-virtual'
import { WritableAtom, atom, useAtom, useAtomValue, useSetAtom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import { sortBy, sum, uniq } from 'ramda'
import React, { SetStateAction, memo, useCallback, useEffect, useMemo, useRef } from 'react'
import useEvent from 'react-use-event-hook'
import { useAtoms, useGameAdapter, useStore } from '../Cpp'
import { useComponents } from '../hooks/useComponents'
import { IGame, Task } from '../pkg/cpp-basic'
import { MoveStep, MoveTarget, stepTarget } from '../pkg/cpp-core/planOrder'
import { TaskCostStatus, TaskExtra, TaskStatus, tasksUpTo } from '../pkg/cpp-core/Task'
import { StarStatus } from '../pkg/cpp-core/UserData'
import { gt } from '../pkg/gt'
import { CharacterContextMenu, SortButtonGroup, menuItemKeyDown } from './CharacterList'
import { CachedImg, ItemIcon } from './Icons'
import { ListDrag, useListDrag } from './ListDrag'
import { ListSelectionContext, SelectionBar, handleTitle, useListSelection } from './ListSelection'
import { PlanBatchButtons } from './PlanActions'
import { inRanges } from './listDrag'
import { PeekTrigger } from './Peek'
import { useDossierOpenFor, useOpenCharacterDossier, useShowCharacterDossier } from './dossierHooks'
import { useRequestFrame } from './focusFrame'
import { useLongPressContextMenu } from './longPress'
import { useCoarsePointer, usePhoneLayout } from './phoneLayout'
import {
  TASK_HEADER_HEIGHT,
  charDragGaps,
  charDragRanges,
  charDraggable,
  groupDragGaps,
  groupDraggable,
  headerRange,
  layoutTasks,
} from './taskListLayout'
import { TaskNote } from './types'
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
  const formattedString = ga.getUserDataAdapter().formatTaskAsString(type, charId)
  const C = useComponents().TaskDisplay
  if (C) {
    return <C type={type} charId={charId} formattedString={formattedString} />
  }
  return <>{ga.getUserDataAdapter().formatTaskAsString(type, charId)}</>
})

/** 指针停在「完成至此」上时会被完成的任务 id：TaskContextMenu 写，TaskList 按它给行染色 */
const completePreviewAtom = atom<ReadonlySet<string> | undefined>(undefined)

const TaskContextMenu = memo(
  <G extends IGame>({
    task,
    extra,
    details,
  }: {
    task: Task<G>
    extra: TaskExtra
    /** 触屏上和手机布局里隐藏材料时，悬停的子菜单没有了：备注和材料放在菜单最上面 */
    details?: React.ReactNode
  }) => {
    const store = useStore()
    const atoms = useAtoms<G>()
    const stars = useAtomValue(atoms.stars)

    const list = useAtomValue(atoms.goalTasksWithExtra)
    const range = useMemo(() => tasksUpTo(list, task), [list, task])
    const rangeIds = useMemo<ReadonlySet<string>>(() => new Set(range.map(([t]) => t.id)), [range])
    const setPreview = useSetAtom(completePreviewAtom)
    const shown = useRef<ReadonlySet<string> | undefined>(undefined)
    const showPreview = useEvent(() => {
      shown.current = rangeIds
      setPreview(rangeIds)
    })
    // 只清自己写的那一组：先开的菜单晚卸载时，不能清掉后开的菜单的
    const hidePreview = useEvent(() => setPreview((p) => (p === shown.current ? undefined : p)))
    // 点了以后菜单直接关上，收不到 pointerleave
    useEffect(() => hidePreview, [hidePreview])

    // 按这名干员计划里全部的整项算，不只是本段看得到的那几项
    const goalTasks = useAtomValue(atoms.goalTasks(task.charId))
    const groups = useMemo(() => uniq(goalTasks.flatMap((x) => (x.group ? [x.group] : []))), [goalTasks])
    const moveGroup = (step: MoveStep) => {
      const target = task.group ? stepTarget(groups, [task.group], step) : undefined
      if (target) store.set(atoms.moveTaskGroup, { charId: task.charId, group: task.group!, target })
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
        {details ? (
          <>
            {details}
            <MenuDivider />
          </>
        ) : null}
        {task.group && groups.length >= 2 ? (
          <>
            <SortButtonGroup label={gt.gettext('角色内排序')} onMove={moveGroup} />
            <MenuDivider />
          </>
        ) : null}
        <MenuItem
          text={gt.gettext('完成')}
          icon={'tick-circle'}
          disabled={extra.status !== TaskStatus.Completable || !!task.depends.length}
          onClick={() => store.set(atoms.completeTasks, { tasks: [task], consume: true })}
        />
        <MenuItem
          text={gt.gettext('强制完成（不消耗材料）')}
          disabled={!!task.depends.length}
          icon={'cross-circle'}
          onClick={() => store.set(atoms.completeTasks, { tasks: [task], consume: false })}
        />
        {range.length >= 2 ? (
          <MenuItem
            text={gt.gettext('完成至此')}
            icon={'confirm'}
            label={gt
              .ngettext('%d 项', '%d 项', range.length) /* I10N: %d: number of tasks */
              .replaceAll('%d', range.length.toString())}
            disabled={range.some(([, x]) => x.status !== TaskStatus.Completable)}
            // Blueprint 灰掉菜单项时会去掉 onMouseEnter/onMouseLeave（DISABLED_PROPS），pointer 事件不在里面
            onPointerEnter={showPreview}
            onPointerLeave={hidePreview}
            onFocus={showPreview}
            onBlur={hidePreview}
            onClick={() => store.set(atoms.completeTasks, { tasks: range.map(([t]) => t), consume: true })}
          />
        ) : null}
        <MenuDivider />
        <MenuItem
          text={gt.gettext('优先培养（星标）')}
          icon={'star'}
          active={stars.includes(task.id)}
          onClick={starTask}
        />
      </Menu>
    )
  },
)

/** 拖干员那一行（char）或拖一整项（group），row 是按住的那一行 */
interface TaskDragSource {
  kind: 'char' | 'group'
  row: number
}

export const TaskMenu = memo(
  <G extends IGame>({
    task,
    extra,
    index,
    rowRef,
    style,
    same,
    nextSame,
    hideCosts,
    notes,
    drag,
    dim,
    selected,
    previewed,
    selecting,
    onHeaderClick,
    onHeaderMouseDown,
  }: {
    task: Task<G>
    extra: TaskExtra
    /** 虚拟列表里的序号，和 rowRef 一起让列表量这一行的高度；拖动也按它认行 */
    index?: number
    rowRef?: (el: HTMLLIElement | null) => void
    style?: React.CSSProperties
    same?: boolean
    nextSame?: boolean
    hideCosts: boolean
    notes: readonly TaskNote[]
    drag?: ListDrag<TaskDragSource>
    /** 正在被拖：整组连干员那一行（all），或只是这一项的任务（task） */
    dim?: 'all' | 'task'
    /** 这名干员选中了 */
    selected?: boolean
    /** 指针停在「完成至此」上时，这一项会被完成 */
    previewed?: boolean
    /** 列表有选择：点干员那一行是勾选，不开档案 */
    selecting?: boolean
    /** 返回 true 时已经改了选择（修饰键点击，或在选择模式里），不开档案 */
    onHeaderClick?: (e: React.MouseEvent, index: number) => boolean
    onHeaderMouseDown?: React.MouseEventHandler
  }) => {
    const ga = useGameAdapter<G>()
    const character = ga.getCharacter(task.charId)
    const detailsAtom = useAtoms().allStarredTasksDetails
    const details = useAtomValue(detailsAtom)
    const openDossier = useOpenCharacterDossier()
    const dossierOpen = useDossierOpenFor(character.key)
    // 触屏上长按干员那一行出右键菜单：iOS 长按不触发 contextmenu
    const longPress = useLongPressContextMenu()
    const TaskTag = useComponents().TaskTag
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

    const renderedNotes = notes.map((note) => (
      <TaskNoteRow
        key={`note:${note.key}`}
        charId={character.key}
        note={note}
        style={hideCosts ? {} : { marginLeft: 22 }}
      />
    ))

    const hasDetails = renderedNotes.length > 0 || renderedCosts.length > 0
    // 触屏上没有悬停；手机布局里任务行占满整行，子菜单左右都放不下，用鼠标也一样。
    // 这两种情况点任务行弹出它的右键菜单，隐藏材料时材料也列在那个菜单里
    const coarse = useCoarsePointer()
    const phone = usePhoneLayout()
    const menuOnClick = coarse || phone
    const submenu = !menuOnClick && hideCosts && hasDetails
    const menuDetails = menuOnClick && hideCosts && hasDetails ? [...renderedNotes, ...renderedCosts] : undefined

    const starred = details.directStars.has(task)
      ? StarStatus.Starred
      : details.indirectStars.has(task)
        ? StarStatus.Depended
        : StarStatus.None

    const dragProps = (kind: TaskDragSource['kind']) =>
      drag && index !== undefined
        ? { ...drag.hoverProps({ kind, row: index }), ...drag.pressProps({ kind, row: index }) }
        : null

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

    // 模式里点干员那一行是勾选，不再弹出档案
    const headerRole = selecting
      ? ({ role: 'menuitemcheckbox', 'aria-checked': !!selected } as const)
      : ({ role: 'menuitem', 'aria-haspopup': 'dialog', 'aria-expanded': dossierOpen } as const)

    return (
      <li
        role="none"
        ref={rowRef}
        data-index={index}
        style={style}
        className={'cpp-task-menu-master' + (dim === 'all' ? ' cpp-drag-source' : '')}
      >
        {same ? undefined : (
          <ContextMenu content={<CharacterContextMenu character={character} alwaysSorting={true} />}>
            <a
              {...headerRole}
              tabIndex={0}
              className={
                'bp6-menu-item cpp-task-menu' +
                (dossierOpen ? ' bp6-active bp6-intent-primary cpp-dossier-open' : '') +
                (selected ? ' cpp-list-selected' : '')
              }
              style={{ flexShrink: 1, overflow: 'hidden' }}
              {...longPress}
              onClick={(e) => {
                if (index !== undefined && onHeaderClick?.(e, index)) return
                openDossier(character.key)
              }}
              onMouseDown={onHeaderMouseDown}
              onKeyDown={menuItemKeyDown}
              {...dragProps('char')}
            >
              <>
                <span className="bp6-menu-item-icon">
                  {/* 16px 的头像角上放不下勾和空圈，整个换掉 */}
                  {selected ? (
                    <span className="cpp-select-tick cpp-select-tick-inline">
                      <Icon icon="small-tick" size={12} />
                    </span>
                  ) : selecting ? (
                    <span className="cpp-select-tick cpp-select-tick-inline cpp-select-tick-empty" />
                  ) : (
                    <CachedImg
                      src={character.avatar}
                      width={'16'}
                      height={'16'}
                      alt={character.key}
                      title={character.key}
                    />
                  )}
                </span>

                <div className="bp6-fill" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <div style={{ display: 'flex', flexDirection: 'row', overflow: 'hidden' }}>
                    <div className="bp6-text-overflow-ellipsis" style={{ flexShrink: 2, overflow: 'hidden' }}>
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
        <Menu
          style={{ padding: 0 }}
          className={[dim === 'task' && 'cpp-drag-source', previewed && 'cpp-task-preview'].filter(Boolean).join(' ')}
        >
          <ContextMenu content={<TaskContextMenu task={task} extra={extra} details={menuDetails} />}>
            <MenuItem
              {...(task.group ? dragProps('group') : null)}
              // 没有子菜单时只有右键菜单，悬停不该像能点；触屏上和手机布局里点了就出菜单
              className={'cpp-menu-nosubmenu cpp-task-row' + (submenu || menuOnClick ? '' : ' cpp-task-row-static')}
              onClick={menuOnClick ? openContextMenuBelow : undefined}
              // title={task.id}
              style={{ fontWeight: 'normal' }}
              icon={StatusIcon[extra.status]}
              text={
                <div style={{ display: 'flex' }}>
                  <div style={{ flex: 1, flexShrink: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    <TaskDisplay type={task.type} charId={character.key} />
                  </div>
                  {TaskTag ? <TaskTag type={task.type} charId={character.key} /> : null}
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
                      <Icon icon={starIcon} className="bp6-menu-item-icon" size={16} />
                    </div>
                  )}
                </div>
              }
              popoverProps={taskSubmenuPopoverProps}
            >
              {submenu ? [...renderedNotes, ...renderedCosts] : null}
            </MenuItem>
          </ContextMenu>
          {hideCosts ? null : renderedNotes}
          {hideCosts ? null : renderedCosts}
          {/* MenuDivider 本身是 <li>，只能放在 <ul> 里；放到这一行的 <li> 下就是 <li> 套 <li> */}
          {hideCosts && nextSame ? null : <MenuDivider />}
        </Menu>
      </li>
    )
  },
)

const preventDefault = (e: React.MouseEvent<any, MouseEvent>) => e.preventDefault()

/**
 * 在这一行左下角派发一次右键，由包着它的 ContextMenu 弹出菜单：iOS 长按不触发 contextmenu，
 * 而菜单里的 jotai、Cpp 上下文都要从这一行来，不另写一份
 */
const openContextMenuBelow = (e: React.MouseEvent<HTMLElement>) => {
  const row = e.currentTarget
  const r = row.getBoundingClientRect()
  row.dispatchEvent(
    new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2, clientX: r.left, clientY: r.bottom }),
  )
}

// 材料子菜单至少和任务行一样宽，放不下英文物品名时随内容加宽；matchTargetWidth 会把宽度定死成行宽。
// MenuItem 的子菜单已经是 PopoverNext，popoverProps 却还按旧 Popover 定类型，middleware 只能绕过类型交过去：
// popoverPropsToNextProps 把不认识的键原样转交。哪天转不过去了，子菜单只是按内容收窄，不会坏
const minRowWidth: Pick<PopoverNextProps, 'middleware'> = {
  middleware: {
    size: {
      apply: ({ rects, elements }) => {
        elements.floating.style.minWidth = `${rects.reference.width}px`
      },
    },
  },
}

const taskSubmenuPopoverProps: MenuItemProps['popoverProps'] = {
  usePortal: true,
  popoverClassName: 'cpp-task-submenu',
  ...(minRowWidth as object),
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
      <PeekTrigger
        peek={{ kind: 'item', id: stack.itemId }}
        renderTarget={(peek) => (
          <MenuItem
            {...peek}
            className={peek ? peek.className : 'cpp-menu-not-interactive'}
            // 隐藏花费时这些行在任务行的子菜单里：点了不能把子菜单关掉，否则卡片跟着没了
            shouldDismissPopover={false}
            icon={
              <div style={{ display: 'flex' }}>
                <Icon icon={CostStatusIcon[status]} size={16} style={{ padding: 2 }} />
                <ItemIcon item={item} size={20} />
              </div>
            }
            onContextMenu={preventDefault}
            multiline={true}
            text={
              <div className="cpp-task-cost">
                <span>{item.name}</span>
                <span className="cpp-task-cost-quantity">
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
        )}
      />
    )
  },
)

const TaskNoteRow = memo(({ charId, note, style }: { charId: string; note: TaskNote; style?: React.CSSProperties }) => {
  const showDossier = useShowCharacterDossier()
  const frame = useRequestFrame()
  const { dossier } = note
  const onClick = useEvent(() => {
    if (!dossier) return
    showDossier(charId, { section: dossier.section })
    frame(dossier.frame)
  })
  return (
    <MenuItem
      className={'cpp-task-note' + (dossier ? '' : ' cpp-menu-not-interactive')}
      icon={note.icon}
      text={note.text}
      multiline={true}
      htmlTitle={note.title}
      onClick={dossier ? onClick : undefined}
      onContextMenu={preventDefault}
      style={{ fontWeight: 'normal', ...style }}
    />
  )
})

const NO_NOTES: readonly TaskNote[] = []

const HideCostsButton = memo(() => {
  const [param, setParam] = useAtom(queryParamAtom)
  return (
    <Button
      variant="minimal"
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
  const preview = useAtomValue(completePreviewAtom)

  const hideCosts = param.hideCosts || false
  const list = useAtomValue(atoms.goalTasksWithExtra)
  const starredCount = useAtomValue(atoms.allStarredTasksDetails).sortedStarredTasks.length
  const tasks = useMemo(() => list.map(([task]) => task), [list])
  const layout = useMemo(() => layoutTasks(tasks, starredCount), [tasks, starredCount])
  const same = (index: number) => layout.runs[layout.runOf[index]].first !== index
  const nextSame = (index: number) => layout.runOf[index + 1] === layout.runOf[index]
  const ga = useGameAdapter<G>()
  const store = useStore()
  const taskNotes = useComponents().taskNotes
  const notes = useMemo(() => tasks.map((task) => (taskNotes ? taskNotes(ga, task) : NO_NOTES)), [tasks, ga, taskNotes])
  // 说明行会折行，行高以量出来的为准；这里按每条说明一行估，给还没画出来的行占位。分隔线 9px：1px 线加上下各 4px 边距
  const itemSize = useCallback<(index: number) => number>(
    (index) => {
      const costs = hideCosts ? 0 : (tasks[index].requires.length + notes[index].length) * 30
      const header = layout.runs[layout.runOf[index]].first === index ? TASK_HEADER_HEIGHT : 0
      return costs + header + 30 + (hideCosts && layout.runOf[index + 1] === layout.runOf[index] ? 0 : 9)
    },
    [tasks, layout, notes, hideCosts],
  )

  const parentRef = useRef<HTMLUListElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  const rowVirtualizer = useVirtualizer({
    count: list.length,
    getScrollElement: () => parentRef.current,
    // 量出的高度按键记。键里带上是否隐藏花费：切换时行重新挂上、重新量，不沿用另一种显示方式量出的高度
    getItemKey: (index) => `${list[index][0].id}:${hideCosts ? 'h' : 'e'}`,
    estimateSize: itemSize,
    overscan: 5,
  })

  const charKeys = useMemo(() => uniq(tasks.map((t) => t.charId)), [tasks])
  const selection = useListSelection(charKeys)
  const { selected } = selection
  // 选的是干员：两段里这名干员的标题行一起亮，拖时只出现在另一段的选中干员也跟着挪计划顺序
  const moving = (charId: string): ReadonlySet<string> => (selected.has(charId) ? selected : new Set([charId]))
  const onHeaderClick = useEvent((e: React.MouseEvent, index: number) =>
    selection.click(e, tasks[index].charId, (anchor) => headerRange(layout, anchor, layout.runOf[index])),
  )

  const { drag, active, overlay, handle } = useListDrag<TaskDragSource, MoveTarget>({
    enabled: true,
    scrollRef: parentRef,
    contentRef,
    virtualizer: rowVirtualizer,
    handleInset: 3,
    draggable: ({ kind, row }) =>
      kind === 'group'
        ? groupDraggable(tasks, layout, row)
        : charDraggable(layout, layout.runOf[row], moving(tasks[row].charId)),
    begin: ({ kind, row }) => {
      if (kind === 'group') return groupDragGaps(tasks, layout, row)
      const m = moving(tasks[row].charId)
      return { ranges: charDragRanges(layout, m), gaps: charDragGaps(layout, layout.runOf[row], m), count: m.size }
    },
    commit: ({ kind, row }, target) => {
      const task = tasks[row]
      if (kind === 'char') store.set(atoms.moveInPlan, { charIds: [...moving(task.charId)], target })
      else store.set(atoms.moveTaskGroup, { charId: task.charId, group: task.group!, target })
    },
    selected: ({ kind, row }) => kind === 'char' && selected.has(tasks[row].charId),
    handleTitle: ({ kind, row }) => (kind === 'char' ? handleTitle(selected, tasks[row].charId) : undefined),
    onHandleClick: ({ kind, row }) => {
      if (kind === 'char') selection.toggle(tasks[row].charId)
    },
  })

  return (
    <>
      <Navbar style={{ paddingLeft: '0.5em', paddingRight: '0.5em' }}>
        <Navbar.Group align={Alignment.RIGHT} />
        <Navbar.Group align={Alignment.LEFT}>
          <HideCostsButton />
        </Navbar.Group>
      </Navbar>
      <ListSelectionContext.Provider value={selection}>
        <Menu style={{ flex: 1, flexShrink: 1, overflow: 'auto' }} ulRef={parentRef}>
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
              const dragged = active && inRanges(active.ranges, index)
              return (
                <TaskMenu
                  key={String(virtualRow.key)}
                  index={index}
                  rowRef={rowVirtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  task={list[index][0]}
                  extra={list[index][1]}
                  same={same(index)}
                  nextSame={nextSame(index)}
                  hideCosts={param.hideCosts}
                  notes={notes[index]}
                  drag={drag}
                  dim={dragged ? (active.source.kind === 'char' ? 'all' : 'task') : undefined}
                  // 只有标题行画得出选中，别的行不跟着选择重画
                  selected={!same(index) && selected.has(list[index][0].charId)}
                  previewed={preview?.has(list[index][0].id) ?? false}
                  selecting={!same(index) && selection.selecting}
                  onHeaderClick={onHeaderClick}
                  onHeaderMouseDown={selection.mouseDown}
                />
              )
            })}
            {overlay}
          </div>
        </Menu>
      </ListSelectionContext.Provider>
      <SelectionBar
        count={selected.size}
        compact
        allSelected={selection.allSelected}
        onSelectAll={selection.selectAll}
        onClear={selection.clear}
      >
        <PlanBatchButtons charIds={selection.selectedKeys} compact />
      </SelectionBar>
      {handle}
    </>
  )
})
