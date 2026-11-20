import {
  Button,
  ButtonGroup,
  Checkbox,
  Dialog,
  HTMLTable,
  Icon,
  Menu,
  MenuDivider,
  MenuItem,
  NonIdealState,
  Popover,
  PopoverTargetProps,
  PopupKind,
  Tag,
  mergeRefs,
} from '@blueprintjs/core'
import { useAtom, useAtomValue } from 'jotai'
import React, { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import useEvent from 'react-use-event-hook'
import { useCpp, useGameAdapter } from '../../Cpp'
import { Arknights, ArknightsAdapter, DeployableProfession, Profession, ProfessionNames } from '../../pkg/cpp-arknights'
import {
  BlockReason,
  Board,
  Candidate,
  CandidateSort,
  Capacity,
  MissionInput,
  MissionNames,
  MissionScope,
  TagAlong,
  Ticket,
  deployableProfessions,
  listJoin,
  missionSummary,
  sortCandidates,
  successorTicket,
  tagAlongCandidates,
} from '../../pkg/cpp-arknights/moduleMissions'
import { PSTR, gt, lpstr } from '../../pkg/gt'
import { CachedImg } from '../Icons'
import { PeekTrigger } from '../Peek'
import { AppToaster } from '../Toaster'
import { useOpenCharacterDossier } from '../dossierHooks'
import { usePhoneLayout } from '../phoneLayout'
import { clearRosterPin, setRosterPin } from '../rosterPin'
import { SidebarPanel } from '../types'
import { ProfessionIcon } from './Icons'
import { modulePeek, stagePeek } from './peekKinds'
import {
  MissionGroup,
  addTagAlong,
  candidateSortAtom,
  dropTagAlong,
  keepTagAlongsFor,
  markRunDone,
  missionPrefsAtom,
  moveTagAlongs,
  openGroupsAtom,
  releaseMissions,
  selectedTicketAtom,
  setMissionsDone,
  tagAlongsAtom,
  tidyMissions,
  toggleMission,
  useMissionBoard,
  useMissionNames,
  useRunsAfterTidy,
} from './moduleMissionState'

const scopeNames: Record<MissionScope, PSTR> = {
  plan: lpstr(() => gt.pgettext('module mission scope', '计划内')),
  open: lpstr(() => gt.pgettext('module mission scope', '任务已开放')),
  elite2: lpstr(() => gt.pgettext('module mission scope', '所有精二')),
  owned: lpstr(() => gt.pgettext('module mission scope', '所有已有干员')),
  all: lpstr(() => gt.pgettext('module mission scope', '所有干员')),
  everything: lpstr(() => gt.pgettext('module mission scope', '所有任务')),
}

function useArknights() {
  return useGameAdapter<Arknights>() as ArknightsAdapter
}

export function moduleCode(ga: ArknightsAdapter, equipId: string) {
  const raw = ga.getDataManager().data.uniEquips[equipId]?.raw
  return raw ? [raw.typeName1, raw.typeName2].filter(Boolean).join('-') : equipId
}

/** 模组代号，点了弹出模组卡 */
export const ModuleCode = memo(({ charId, equipId }: { charId: string; equipId: string }) => {
  const ga = useArknights()
  return (
    <PeekTrigger
      peek={modulePeek(charId, equipId)}
      inline={true}
      renderTarget={(peek) => (
        <span
          {...peek}
          role={peek ? 'button' : undefined}
          className={'cpp-mm-equip' + (peek ? ' ' + peek.className : '')}
        >
          {moduleCode(ga, equipId)}
        </span>
      )}
    />
  )
})

/** 单独写出来的关卡号，点了弹出关卡卡。存根上的不用它：那是选中整张券的一部分 */
const StageCode = memo(({ stageId }: { stageId: string }) => {
  const ga = useArknights()
  return (
    <PeekTrigger
      peek={stagePeek(stageId)}
      inline={true}
      renderTarget={(peek) => (
        <span {...peek} role={peek ? 'button' : undefined}>
          {ga.getMissionCatalog().stage(stageId).code}
        </span>
      )}
    />
  )
})

export function blockText(ga: ArknightsAdapter, charId: string, reason: BlockReason) {
  return reason === 'absent'
    ? gt.pgettext('module mission', '未持有')
    : gt
        .pgettext('module mission', '精二 %d 级后才算')
        .replaceAll('%d', String(ga.getCharacter(charId)?.modUnlockLevel ?? 0))
}

/** 任务表「干员」一列窄，写短的；「需」是为了和候选行的练度「精二 %d」分开 */
function blockShort(ga: ArknightsAdapter, charId: string, reason: BlockReason) {
  return reason === 'absent'
    ? gt.pgettext('module mission', '未持有')
    : gt.pgettext('module mission', '需精二 %d').replaceAll('%d', String(ga.getCharacter(charId)?.modUnlockLevel ?? 0))
}

/** 一个数字放大加粗：按 %d 切开模板 */
function Num({ text, value }: { text: string; value: number }) {
  const [before, after = ''] = text.split('%d')
  return (
    <>
      {before}
      <b className="cpp-mm-num">{value}</b>
      {after}
    </>
  )
}

function stageCodeOf(ga: ArknightsAdapter, ticket: Ticket) {
  return ga.getMissionCatalog().stage(ticket.stageId).code
}

function uniqueCharIds(missions: readonly MissionInput[]) {
  return [...new Set(missions.map((x) => x.charId))]
}

/** 干员列表筛成的人：要带的人，加上带上的人 */
function crewIds(ticket: Ticket) {
  return [...uniqueCharIds(ticket.missions), ...ticket.tagAlongs.map((x) => x.charId)]
}

/** 干员列表筛选的标签 */
function ticketLabel(ga: ArknightsAdapter, ticket: Ticket) {
  const code = stageCodeOf(ga, ticket)
  return ticket.total > 1
    ? gt
        .pgettext('module mission', '模组任务 · %1 第 %2 次') /* I10N: %1: stage code; %2: run number */
        .replace('%1', code)
        .replace('%2', String(ticket.index))
    : gt.pgettext('module mission', '模组任务 · %s').replaceAll('%s', code)
}

/** 「2-10 第 1 次」，这一关只打一次时只有关卡号 */
function runName(ga: ArknightsAdapter, ticket: Ticket) {
  const code = stageCodeOf(ga, ticket)
  return ticket.total > 1
    ? gt
        .pgettext('module mission', '%1 第 %2 次') /* I10N: %1: stage code; %2: run number */
        .replace('%1', code)
        .replace('%2', String(ticket.index))
    : code
}

const refsOf = (tagAlongs: readonly TagAlong[]) => tagAlongs.map(({ charId, formId }) => ({ charId, formId }))

export function summaryOf(board: Board, m: MissionInput, names: MissionNames) {
  const parsed = board.parsed.get(m.id)
  return parsed ? missionSummary(parsed, names) : m.desc
}

/** 选中一张券，干员列表随之筛成这一次的干员；null 取消选中。带上的人只属于原来那张券，换了券就清空 */
export function useSelectTicket() {
  const cpp = useCpp<Arknights>()
  const ga = useArknights()
  return useEvent((ticket: Ticket | null) => {
    keepTagAlongsFor(cpp, ticket?.key ?? null)
    if (!ticket) {
      cpp.store.set(selectedTicketAtom, null)
      clearRosterPin(cpp)
      return
    }
    cpp.store.set(selectedTicketAtom, ticket.key)
    setRosterPin(cpp, ticketLabel(ga, ticket), crewIds(ticket))
  })
}

/**
 * 选中的券不在了：只是勾掉或取消了其中一条时，选中和带上的人跟到那张券上，分法变了或者都做完了就取消选中、清筛选。
 * 券还在、但有带上的人不再符合时，只留还在的人
 */
function useSyncSelection(board: Board) {
  const cpp = useCpp<Arknights>()
  const selected = useAtomValue(selectedTicketAtom)
  const tagAlongs = useAtomValue(tagAlongsAtom)
  const select = useSelectTicket()
  const ticket = selected == null ? undefined : board.tickets.find((t) => t.key === selected)
  const missing = selected != null && !ticket
  const dropped = !!ticket && tagAlongs?.ticket === ticket.key && ticket.tagAlongs.length < tagAlongs.chars.length
  useEffect(() => {
    if (missing) {
      const s = successorTicket(board.tickets, selected)
      if (s) moveTagAlongs(cpp, s.key, refsOf(s.tagAlongs))
      select(s ?? null)
    } else if (dropped) {
      moveTagAlongs(cpp, ticket.key, refsOf(ticket.tagAlongs))
      select(ticket)
    }
  }, [missing, dropped, selected, ticket, board.tickets, select, cpp])
}

/** 带上、拿掉一个人；干员列表的筛选跟着加减 */
function useTagAlongActions(ticket: Ticket) {
  const cpp = useCpp<Arknights>()
  const ga = useArknights()
  const add = useEvent((c: Candidate) => {
    addTagAlong(cpp, ticket.key, { charId: c.charId, formId: c.formId })
    setRosterPin(cpp, ticketLabel(ga, ticket), [...crewIds(ticket), c.charId])
  })
  const drop = useEvent((charId: string) => {
    dropTagAlong(cpp, ticket.key, charId)
    setRosterPin(
      cpp,
      ticketLabel(ga, ticket),
      crewIds(ticket).filter((x) => x !== charId),
    )
  })
  return { add, drop }
}

/** 改了数据以后，等这个组件下一次画完，再把焦点交给 pick 找到的元素；那一次没有重画就作罢 */
function useFocusAfterRender() {
  const pending = useRef<(() => HTMLElement | null | undefined) | null>(null)
  useLayoutEffect(() => {
    const pick = pending.current
    if (!pick) return
    pending.current = null
    pick()?.focus()
  })
  return useEvent((pick: () => HTMLElement | null | undefined) => {
    pending.current = pick
    setTimeout(() => {
      if (pending.current === pick) pending.current = null
    })
  })
}

/**
 * 「打完了」以后焦点交给哪张券：新列表里同一个下标上的那张，列表短了就是统计行。按下的那一刻新列表还没画出来，
 * 所以先记在这里，由画出来的那张券认领
 */
let focusAfterFinish: { index: number; wide: boolean } | null = null

function claimFocus(wide: boolean, el: HTMLElement | null, mine: (index: number) => boolean) {
  if (!el || !focusAfterFinish || focusAfterFinish.wide !== wide || !mine(focusAfterFinish.index)) return
  focusAfterFinish = null
  el.focus({ preventScroll: true })
}

/** 「打完了」「其余 N 条也做成了」「放进用过的」；做完了几条决定是哪一个 */
function finishText(ticket: Ticket, board: Board) {
  const left = ticket.missions.filter((x) => !board.done.has(x.id)).length
  if (left === ticket.missions.length) return gt.pgettext('module mission', '打完了')
  if (left === 0) return gt.pgettext('module mission', '放进用过的')
  return gt.ngettext('其余 %d 条也做成了', '其余 %d 条也做成了', left).replaceAll('%d', String(left))
}

/** index 是这张券在列表里的下标，wide 是按钮在不在大窗口里 */
function useFinishRun(wide: boolean) {
  const cpp = useCpp<Arknights>()
  const ga = useArknights()
  const select = useSelectTicket()
  return useEvent((ticket: Ticket, index: number) => {
    const added = markRunDone(
      cpp,
      ticket.missions.map((x) => x.id),
    )
    releaseMissions(
      cpp,
      [...ticket.missions, ...ticket.piggyback, ...ticket.tagAlongs.flatMap((x) => x.missions)].map((x) => x.id),
    )
    focusAfterFinish = { index, wide }
    // 认领的那张券这一次没画出来的话，不能等到以后哪次重画再抢焦点
    setTimeout(() => (focusAfterFinish = null))
    select(null)
    if (added.length === 0) return
    const code = stageCodeOf(ga, ticket)
    void AppToaster.then((toaster) =>
      toaster.show({
        intent: 'success',
        icon: 'tick',
        message: gt
          .ngettext('已标为完成：%1 的 %2 条', '已标为完成：%1 的 %2 条', added.length) /* I10N: %1: stage code */
          .replace('%1', code)
          .replace('%2', String(added.length)),
        action: { text: gt.pgettext('module mission', '撤销'), onClick: () => setMissionsDone(cpp, added, false) },
      }),
    )
  })
}

// ---------------------------------------------------------------------------------------------------------------------
// 小部件

const Avatar = memo(({ charId, size }: { charId: string; size: number }) => {
  const ga = useArknights()
  const character = ga.getCharacter(charId)
  if (!character) return null
  return <CachedImg src={character.avatar} width={size} height={size} alt={character.key} className="cpp-mm-avatar" />
})

/** 阿米娅这类多形态干员，名字前面带上形态的职业图标 */
const OperatorName = memo(({ mission }: { mission: Pick<MissionInput, 'charId' | 'formId' | 'profession'> }) => {
  const ga = useArknights()
  const name = ga.getCharacter(mission.charId)?.name ?? mission.charId
  return (
    <span className="cpp-mm-name">
      {mission.formId !== mission.charId ? <ProfessionIcon profession={mission.profession} /> : null}
      {name}
    </span>
  )
})

/** 头像和名字，点了打开档案 */
export const OperatorButton = memo(
  ({ mission, size = 20 }: { mission: Pick<MissionInput, 'charId' | 'formId' | 'profession'>; size?: number }) => {
    const open = useOpenCharacterDossier()
    return (
      <button type="button" className="cpp-mm-operator" onClick={() => open(mission.charId)}>
        <Avatar charId={mission.charId} size={size} />
        <OperatorName mission={mission} />
      </button>
    )
  },
)

/** label 是读屏读的，用摘要：原文有四十来字 */
export const MissionCheck = memo(
  ({ mission, done, unlocked, label }: { mission: MissionInput; done: boolean; unlocked: boolean; label: string }) => {
    const cpp = useCpp<Arknights>()
    return (
      <Checkbox
        className="cpp-mm-check"
        checked={done}
        disabled={unlocked}
        title={unlocked ? gt.pgettext('module mission', '模组已解锁') : undefined}
        aria-label={label}
        onChange={() => toggleMission(cpp, mission.id, !done)}
      />
    )
  },
)

const Stub = memo(({ ticket, used }: { ticket: Ticket; used?: boolean }) => {
  const ga = useArknights()
  const stage = ga.getMissionCatalog().stage(ticket.stageId)
  return (
    <div className="cpp-mm-stub">
      <div className={'cpp-mm-stub-code' + (stage.code.length > 6 ? ' is-long' : '')}>{stage.code}</div>
      <div className="cpp-mm-stub-line" title={stage.name}>
        {ticket.total > 1 && !used ? `${ticket.index}/${ticket.total}` : stage.name}
      </div>
      <div className="cpp-mm-stub-line">
        {gt.pgettext('module mission', '%d 理智').replaceAll('%d', String(stage.apCost))}
      </div>
    </div>
  )
})

/**
 * 收起的券上要带的人，后面是带上的人：头像加名字，排成一行，放不下就换行。这张券上的任务都做完了的人，名字划掉；
 * 做不了的人名字后面一把锁，悬停是原因
 */
const Crew = memo(({ ticket, board }: { ticket: Ticket; board: Board }) => {
  const ga = useArknights()
  const seen = new Set<string>()
  return (
    <div className="cpp-mm-crew">
      {ticket.missions.map((m) => {
        const key = m.charId + ':' + m.formId
        if (seen.has(key)) return null
        seen.add(key)
        const block = ticket.blocked.find((x) => x.charId === m.charId)
        const why = block ? blockText(ga, m.charId, block.reason) : undefined
        const done = ticket.missions.every(
          (x) => x.charId !== m.charId || x.formId !== m.formId || board.done.has(x.id),
        )
        return (
          <span key={key} className={'cpp-mm-chip' + (done ? ' is-done' : '')} title={why}>
            <Avatar charId={m.charId} size={20} />
            <OperatorName mission={m} />
            {why ? <Icon icon="lock" size={11} className="cpp-mm-lock" title={why} /> : null}
          </span>
        )
      })}
      {ticket.tagAlongs.map((x) => (
        <span
          key={x.charId + ':' + x.formId}
          className={'cpp-mm-chip is-tag-along' + (x.missions.every((m) => board.done.has(m.id)) ? ' is-done' : '')}
          title={gt.pgettext('module mission', '带上的')}
        >
          <span className="cpp-mm-tag-plus" aria-hidden={true}>
            +
          </span>
          <Avatar charId={x.charId} size={20} />
          <OperatorName mission={x} />
        </span>
      ))}
    </div>
  )
})

/** 几条任务所属模组的代号，每个模组一个 */
const ModuleCodes = memo(({ missions }: { missions: readonly MissionInput[] }) => (
  <>
    {[...new Map(missions.map((m) => [m.equipId, m.charId]))].map(([equipId, charId]) => (
      <ModuleCode key={equipId} charId={charId} equipId={equipId} />
    ))}
  </>
))

const professionName = (p: Profession) => String(ProfessionNames[p as DeployableProfession])

function barredLabel(p: Profession, barred: boolean) {
  return barred ? gt.pgettext('module mission', '不能编入%s').replaceAll('%s', professionName(p)) : professionName(p)
}

function capacityNote(cap: Capacity) {
  const notes: string[] = []
  if (cap.position === 'MELEE') notes.push(gt.pgettext('module mission', '只能近战位'))
  if (cap.position === 'RANGED') notes.push(gt.pgettext('module mission', '只能远程位'))
  if (cap.stars) notes.push(gt.pgettext('module mission', '只能 %d★').replaceAll('%d', String(cap.stars)))
  return notes.join(gt.pgettext('list separator', '、'))
}

/** 划掉的职业：不能编入 */
const BarredPro = ({ profession }: { profession: Profession }) => {
  const label = barredLabel(profession, true)
  return (
    <span className="cpp-mm-pro is-barred" role="img" aria-label={label} title={label}>
      <ProfessionIcon profession={profession} />
    </span>
  )
}

/** 「还能编入」那一行变成打开候选弹窗的按钮时，铺到那一行上的东西 */
interface PickerTarget {
  /** 候选人数 */
  count: number
  isOpen: boolean
  props: React.HTMLAttributes<HTMLDivElement> & { ref: React.Ref<HTMLDivElement> }
}

/** 触发那一行的后半截：「 · 还能带 95 位 ▾」 */
const PickerCount = ({ count }: { count: number }) => (
  <>
    {' · '}
    <Num text={gt.ngettext('还能带 %d 位', '还能带 %d 位', count)} value={count} />
    <Icon icon="caret-down" size={12} className="cpp-mm-cap-caret" />
  </>
)

/** 券的下半截：还能再编入几位、哪些职业。面板里选中的券上，有候选时整行打开候选弹窗 */
const CapacityStrip = memo(
  ({
    ticket,
    board,
    pickable,
    fallbackFocus,
  }: {
    ticket: Ticket
    board: Board
    pickable: boolean
    fallbackFocus: () => void
  }) => {
    const cap = ticket.capacity
    const note = cap.count > 0 ? capacityNote(cap) : ''
    const strip = (target?: PickerTarget) => (
      <div
        {...target?.props}
        className={'cpp-mm-cap' + (target ? ' is-button' : '') + (target?.isOpen ? ' is-open' : '')}
      >
        {cap.count === 0 ? (
          <span>{gt.pgettext('module mission', '不能再编入别人')}</span>
        ) : (
          <>
            <span>
              <Num text={gt.ngettext('还能编入 %d 位', '还能编入 %d 位', cap.count)} value={cap.count} />
              {target ? <PickerCount count={target.count} /> : null}
            </span>
            <span className="cpp-mm-pros">
              {deployableProfessions.map((p) =>
                cap.professions.includes(p) ? (
                  <span
                    key={p}
                    className="cpp-mm-pro"
                    role="img"
                    aria-label={professionName(p)}
                    title={professionName(p)}
                  >
                    <ProfessionIcon profession={p} />
                  </span>
                ) : (
                  <BarredPro key={p} profession={p} />
                ),
              )}
            </span>
          </>
        )}
        {note ? <span className="cpp-mm-cap-note">{note}</span> : null}
      </div>
    )
    if (!pickable) return strip()
    return (
      <TagAlongPicker
        ticket={ticket}
        board={board}
        placement="right-start"
        clearOf=".cpp-mm-panel"
        fallbackFocus={fallbackFocus}
      >
        {strip}
      </TagAlongPicker>
    )
  },
)

const EMPTY_PROS: ReadonlySet<Profession> = new Set()

/**
 * 「还能编入」那一行打开的候选弹窗。没有候选（包括编满了）时那一行不是按钮，children 拿到的是 undefined；
 * 弹窗开着时变成这样，弹窗随之关掉，焦点交给 fallbackFocus。给了 clearOf 时，弹窗让开那一行外面的这个元素。
 * 手机上面板占满屏宽，旁边没有地方，候选和别的弹窗一样占满全屏
 */
const TagAlongPicker = ({
  ticket,
  board,
  placement,
  clearOf,
  fallbackFocus,
  children,
}: {
  ticket: Ticket
  board: Board
  placement: 'right-start' | 'bottom-start'
  clearOf?: string
  fallbackFocus: () => void
  children: (target?: PickerTarget) => React.JSX.Element
}) => {
  const phone = usePhoneLayout()
  const target = useRef<HTMLDivElement | null>(null)
  // 侧栏里那一行比侧栏窄一截，还要看有没有滚动条，所以打开时再量
  const offset = useMemo(
    () => ({
      enabled: true,
      options: {
        offset: (): [number, number] => {
          const edge = clearOf ? target.current?.closest(clearOf)?.getBoundingClientRect().right : undefined
          const right = target.current?.getBoundingClientRect().right ?? 0
          return [0, edge != null ? edge - right + 4 : 4]
        },
      },
    }),
    [clearOf],
  )
  const candidates = useMemo(() => tagAlongCandidates(board, ticket), [board, ticket])
  const count = candidates.planned.length + candidates.others.length
  const [open, setOpen] = useState(false)
  // 职业筛选只活到弹窗关掉
  const [pros, setPros] = useState(EMPTY_PROS)
  const close = () => {
    setOpen(false)
    setPros(EMPTY_PROS)
  }
  // 编满了、候选空了：弹窗随之关掉，以后有了候选也不自己打开
  if (open && count === 0) close()
  const showing = open && count > 0
  const wasShowing = useRef(false)
  useLayoutEffect(() => {
    if (wasShowing.current && !showing && count === 0) fallbackFocus()
    wasShowing.current = showing
  })
  if (count === 0) return children()
  const focusFirst = (node: HTMLElement) => node.querySelector<HTMLElement>('.cpp-mm-picker-add')?.focus()
  if (phone) {
    return (
      <>
        {children({
          count,
          isOpen: open,
          props: {
            ref: target,
            role: 'button',
            tabIndex: 0,
            'aria-haspopup': 'dialog',
            'aria-expanded': open,
            onClick: () => setOpen(true),
            onKeyDown: onButtonKey,
          },
        })}
        <Dialog
          isOpen={open}
          onClose={close}
          title={<Num text={gt.ngettext('还能带 %d 位', '还能带 %d 位', count)} value={count} />}
          className="cpp-mm-picker-dialog"
          onOpened={focusFirst}
        >
          <PickerContent
            ticket={ticket}
            board={board}
            candidates={candidates}
            pros={pros}
            onPros={setPros}
            inDialog={true}
          />
        </Dialog>
      </>
    )
  }
  return (
    <Popover
      isOpen={open}
      onInteraction={(next) => (next ? setOpen(true) : close())}
      placement={placement}
      minimal={true}
      popupKind={PopupKind.DIALOG}
      modifiers={{ offset }}
      popoverClassName="cpp-mm-picker-popover"
      onOpened={focusFirst}
      content={<PickerContent ticket={ticket} board={board} candidates={candidates} pros={pros} onPros={setPros} />}
      renderTarget={({
        ref,
        isOpen,
        onClick,
        onKeyDown,
        ...aria
      }: PopoverTargetProps & React.DOMAttributes<HTMLElement>) =>
        children({
          count,
          isOpen,
          props: {
            ref: mergeRefs(ref, target),
            role: 'button',
            tabIndex: 0,
            'aria-haspopup': aria['aria-haspopup'],
            'aria-expanded': aria['aria-expanded'],
            onClick,
            onKeyDown: (e) => {
              if (e.target !== e.currentTarget) return
              // 空格不要滚动面板
              if (e.key === ' ') e.preventDefault()
              onKeyDown?.(e)
            },
          },
        })
      }
    />
  )
}

const sortNames: Record<CandidateSort, PSTR> = {
  recommended: lpstr(() => gt.pgettext('module mission', '推荐')),
  trainingHigh: lpstr(() => gt.pgettext('module mission', '练度高的在前')),
  trainingLow: lpstr(() => gt.pgettext('module mission', '练度低的在前')),
}

/** 弹窗里：标题、带上了、排序、职业筛选，下面是候选列表，自己滚动。inDialog 时标题在 Dialog 的标题栏上 */
const PickerContent = ({
  ticket,
  board,
  candidates,
  pros,
  onPros,
  inDialog,
}: {
  ticket: Ticket
  board: Board
  candidates: { planned: Candidate[]; others: Candidate[] }
  pros: ReadonlySet<Profession>
  onPros: (pros: ReadonlySet<Profession>) => void
  inDialog?: boolean
}) => {
  const ga = useArknights()
  const [sort, setSort] = useAtom(candidateSortAtom)
  const { add, drop } = useTagAlongActions(ticket)
  const focusAfter = useFocusAfterRender()
  const self = useRef<HTMLDivElement>(null)
  const cap = ticket.capacity
  const all = [...candidates.planned, ...candidates.others]
  const shown = (list: readonly Candidate[]) => {
    const sorted = sortCandidates(list, sort)
    return pros.size > 0 ? sorted.filter((c) => pros.has(c.profession)) : sorted
  }
  const planned = shown(candidates.planned)
  const others = shown(candidates.others)

  const find = (selector: string) => [...(self.current?.querySelectorAll<HTMLElement>(selector) ?? [])]
  const firstFilter = () => find('.cpp-mm-picker-pro')[0]
  // 按「+」以后焦点给同一位置的下一位，他是最后一位时给上一位
  const addAt = useEvent((c: Candidate, index: number) => {
    add(c)
    focusAfter(() => {
      const adds = find('.cpp-mm-picker-add')
      return adds[Math.min(index, adds.length - 1)] ?? firstFilter()
    })
  })
  const dropAt = (charId: string, index: number) => {
    drop(charId)
    focusAfter(() => find('.cpp-mm-picker-drop')[index] ?? find('.cpp-mm-picker-add')[0] ?? firstFilter())
  }

  const title = gt.ngettext('还能带 %d 位', '还能带 %d 位', all.length)
  return (
    <div
      className="cpp-mm-picker"
      ref={self}
      role={inDialog ? undefined : 'dialog'}
      aria-label={inDialog ? undefined : title.replaceAll('%d', String(all.length))}
    >
      <div className="cpp-mm-picker-head">
        <div className="cpp-mm-picker-title">
          {inDialog ? null : (
            <span>
              <Num text={title} value={all.length} />
            </span>
          )}
          <span className="cpp-mm-muted">
            {runName(ga, ticket)}
            {' · '}
            {gt.ngettext('还能编入 %d 位', '还能编入 %d 位', cap.count).replaceAll('%d', String(cap.count))}
          </span>
        </div>
        {ticket.tagAlongs.length > 0 ? (
          <div className="cpp-mm-picker-row">
            <span className="cpp-mm-picker-label">{gt.pgettext('module mission', '带上了')}</span>
            {ticket.tagAlongs.map((x, i) => (
              <span key={x.charId} className="cpp-mm-chip">
                <Avatar charId={x.charId} size={20} />
                <OperatorName mission={x} />
                <DropButton className="cpp-mm-picker-drop" charId={x.charId} onClick={() => dropAt(x.charId, i)} />
              </span>
            ))}
          </div>
        ) : null}
        <div className="cpp-mm-picker-row">
          <span className="cpp-mm-picker-label">{gt.pgettext('module mission', '排序')}</span>
          <ButtonGroup variant="minimal" size="small">
            {(Object.keys(sortNames) as CandidateSort[]).map((s) => (
              <Button
                key={s}
                text={sortNames[s].toString()}
                active={sort === s}
                aria-pressed={sort === s}
                onClick={() => setSort(s)}
              />
            ))}
          </ButtonGroup>
        </div>
        <div className="cpp-mm-picker-row">
          {deployableProfessions.map((p) => {
            if (!cap.professions.includes(p)) return <BarredPro key={p} profession={p} />
            const n = all.filter((c) => c.profession === p).length
            const on = pros.has(p)
            const label = gt
              .pgettext('module mission', '只看%1（%2 位）') /* I10N: %1: class; %2: a number */
              .replace('%1', professionName(p))
              .replace('%2', String(n))
            return (
              <Button
                key={p}
                className="cpp-mm-picker-pro"
                variant="minimal"
                size="small"
                active={on}
                aria-pressed={on}
                title={label}
                aria-label={label}
                icon={<ProfessionIcon profession={p} />}
                text={n}
                onClick={() => onPros(on ? new Set([...pros].filter((x) => x !== p)) : new Set([...pros, p]))}
              />
            )
          })}
        </div>
      </div>
      <div className="cpp-mm-picker-list">
        {planned.length > 0 ? (
          <div className="cpp-mm-picker-group">
            {gt.pgettext('module mission', '计划里的 · %d').replaceAll('%d', String(planned.length))}
          </div>
        ) : null}
        {planned.map((c, i) => (
          <CandidateRow key={c.formId} candidate={c} board={board} index={i} onAdd={addAt} />
        ))}
        {planned.length > 0 && others.length > 0 ? (
          <div className="cpp-mm-picker-group">
            {gt.pgettext('module mission', '其他 · %d').replaceAll('%d', String(others.length))}
          </div>
        ) : null}
        {others.map((c, i) => (
          <CandidateRow key={c.formId} candidate={c} board={board} index={planned.length + i} onAdd={addAt} />
        ))}
      </div>
    </div>
  )
}

/** 「不带死芒了」 */
const DropButton = ({ charId, className, onClick }: { charId: string; className: string; onClick: () => void }) => {
  const ga = useArknights()
  const label = gt.pgettext('module mission', '不带%s了').replaceAll('%s', ga.getCharacter(charId)?.name ?? charId)
  return (
    <Button
      className={className}
      variant="minimal"
      size="small"
      icon="cross"
      aria-label={label}
      title={label}
      onClick={onClick}
    />
  )
}

/** 候选两行：「+」、人、模组、练度；他能推进的第一条任务，多条时「等 N 条」 */
const CandidateRow = memo(
  ({
    candidate: c,
    board,
    index,
    onAdd,
  }: {
    candidate: Candidate
    board: Board
    index: number
    onAdd: (c: Candidate, index: number) => void
  }) => {
    const ga = useArknights()
    const names = useMissionNames()
    const label = gt.pgettext('module mission', '带上%s').replaceAll('%s', ga.getCharacter(c.charId)?.name ?? c.charId)
    const summaries = c.missions.map((m) => summaryOf(board, m, names))
    const { level, masters } = c.training
    const training = [
      gt.pgettext('module mission', '精二 %d').replaceAll('%d', String(level)),
      ...(masters.some((x) => x > 0)
        ? [gt.pgettext('module mission', '专精 %s').replaceAll('%s', masters.join('/'))]
        : []),
    ].join(' · ')
    return (
      <div className="cpp-mm-cand">
        <Button
          className="cpp-mm-picker-add"
          variant="minimal"
          size="small"
          icon="plus"
          aria-label={label}
          title={label}
          onClick={() => onAdd(c, index)}
        />
        <div className="cpp-mm-cand-body">
          <div className="cpp-mm-run-line">
            <OperatorButton mission={c} />
            <ModuleCodes missions={c.missions} />
            <span className="cpp-mm-cand-training">{training}</span>
          </div>
          <div className="cpp-mm-cand-summary" title={summaries.join('\n')}>
            {summaries[0]}
            {summaries.length > 1 ? (
              <span className="cpp-mm-cand-more">
                {' '}
                {gt.ngettext('等 %d 条', '等 %d 条', summaries.length).replaceAll('%d', String(summaries.length))}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    )
  },
)

/** 几条提示：都要歼灭的敌人、认不出的条件 */
const RunNotes = memo(({ ticket }: { ticket: Ticket }) => {
  const names = useMissionNames()
  return (
    <>
      {ticket.sharedEnemies.length > 0 ? (
        <div className="cpp-mm-note is-warning">
          {gt
            .pgettext('module mission', '都要歼灭%s，数量可能不够分')
            .replaceAll('%s', listJoin(ticket.sharedEnemies.map((x) => names.enemy(x) ?? x)))}
        </div>
      ) : null}
      {ticket.unknown ? (
        <div className="cpp-mm-note is-warning">
          {gt.pgettext('module mission', '这条任务的条件我们还不认识，只能单独算一次')}
        </div>
      ) : null}
    </>
  )
})

/** 每个人最后一条关卡任务的 id → 他的顺带任务 */
function piggybackAfter(ticket: Ticket) {
  const last = new Map<string, string>()
  for (const m of ticket.missions) last.set(m.charId, m.id)
  const after = new Map<string, MissionInput[]>()
  for (const m of ticket.piggyback) {
    const id = last.get(m.charId)
    if (!id) continue
    let list = after.get(id)
    if (!list) after.set(id, (list = []))
    list.push(m)
  }
  return after
}

/** 挂在干员下面的顺带任务：打一次只是推进，所以「打完了」不标它们 */
const PiggybackRows = memo(({ board, missions }: { board: Board; missions: MissionInput[] }) => {
  const names = useMissionNames()
  return (
    <>
      {missions.map((m) => {
        const done = board.done.has(m.id)
        const summary = summaryOf(board, m, names)
        return (
          <div key={m.id} className={'cpp-mm-piggy' + (done ? ' is-done' : '')}>
            <MissionCheck mission={m} done={done} unlocked={board.unlocked.has(m.equipId)} label={summary} />
            <div className="cpp-mm-piggy-text">
              <span className="cpp-mm-piggy-tag">{gt.pgettext('module mission', '顺带')}</span>
              <span className="cpp-mm-summary" title={m.desc}>
                {summary}
              </span>
            </div>
          </div>
        )
      })}
    </>
  )
})

/** 带上的人：左栏是灰色的「+」，右栏是人、模组和「×」；下面是他这一次能推进的任务，每条一行，勾选框也在左栏 */
const TagAlongRows = memo(
  ({ ticket, board, onDrop }: { ticket: Ticket; board: Board; onDrop: (index: number, charId: string) => void }) => (
    <>
      {ticket.tagAlongs.map((x, i) => (
        <div key={x.charId} className="cpp-mm-run-row is-tag-along">
          <span className="cpp-mm-tag-mark" title={gt.pgettext('module mission', '带上的')} aria-hidden={true}>
            +
          </span>
          <div className="cpp-mm-run-who">
            <div className="cpp-mm-run-line">
              <OperatorButton mission={x} size={24} />
              <ModuleCodes missions={x.missions} />
              <DropButton className="cpp-mm-tag-drop" charId={x.charId} onClick={() => onDrop(i, x.charId)} />
            </div>
          </div>
          <PiggybackRows board={board} missions={x.missions} />
        </div>
      ))}
    </>
  ),
)

/** 选中的券在面板里展开 */
const ExpandedRun = memo(
  ({
    ticket,
    board,
    index,
    onDrop,
  }: {
    ticket: Ticket
    board: Board
    index: number
    onDrop: (index: number, charId: string) => void
  }) => {
    const ga = useArknights()
    const names = useMissionNames()
    const finish = useFinishRun(false)
    const piggyback = piggybackAfter(ticket)
    return (
      <div className="cpp-mm-run">
        {ticket.missions.map((m) => {
          const block = ticket.blocked.find((x) => x.charId === m.charId)
          const done = board.done.has(m.id)
          const summary = summaryOf(board, m, names)
          const piggies = piggyback.get(m.id)
          return (
            <div key={m.id} className={'cpp-mm-run-row' + (done ? ' is-done' : '')}>
              <MissionCheck mission={m} done={done} unlocked={board.unlocked.has(m.equipId)} label={summary} />
              <div className="cpp-mm-run-who">
                <div className="cpp-mm-run-line">
                  <OperatorButton mission={m} size={24} />
                  <ModuleCode charId={m.charId} equipId={m.equipId} />
                </div>
                <div className="cpp-mm-summary" title={m.desc}>
                  {summary}
                </div>
                {block ? <div className="cpp-mm-muted">{blockText(ga, m.charId, block.reason)}</div> : null}
              </div>
              {piggies ? <PiggybackRows board={board} missions={piggies} /> : null}
            </div>
          )
        })}
        <TagAlongRows ticket={ticket} board={board} onDrop={onDrop} />
        <RunNotes ticket={ticket} />
        <div className="cpp-mm-run-actions">
          <Button
            size="small"
            intent="primary"
            icon="tick"
            text={finishText(ticket, board)}
            onClick={() => finish(ticket, index)}
          />
        </div>
      </div>
    )
  },
)

const onButtonKey = (e: React.KeyboardEvent<HTMLElement>) => {
  if (e.target !== e.currentTarget || (e.key !== 'Enter' && e.key !== ' ')) return
  e.preventDefault()
  e.currentTarget.click()
}

/**
 * 一张券是打一次。键盘操作的是存根，选中、收起前后是同一个节点，焦点不会丢；收起时整张也能用鼠标点。
 * index 是它在列表里的下标，「打完了」以后用来交接焦点
 */
const TicketCard = memo(
  ({ ticket, board, expandable, index }: { ticket: Ticket; board: Board; expandable: boolean; index: number }) => {
    const selected = useAtomValue(selectedTicketAtom) === ticket.key
    const select = useSelectTicket()
    const { drop } = useTagAlongActions(ticket)
    const focusAfter = useFocusAfterRender()
    const card = useRef<HTMLDivElement>(null)
    const stub = useRef<HTMLDivElement>(null)
    const expanded = expandable && selected
    const allDone = ticket.allDone && !expanded
    const toggle = () => select(selected ? null : ticket)
    const focusStub = useEvent(() => stub.current?.focus())
    // 焦点给下一位带上的人的「×」；没有了给「还能编入」那一行，它不是按钮了就给存根
    const dropAt = useEvent((i: number, charId: string) => {
      drop(charId)
      focusAfter(
        () =>
          card.current?.querySelectorAll<HTMLElement>('.cpp-mm-tag-drop')[i] ??
          card.current?.querySelector<HTMLElement>('.cpp-mm-cap.is-button') ??
          stub.current,
      )
    })
    useLayoutEffect(() => claimFocus(!expandable, stub.current, (i) => i === index))
    return (
      <div
        ref={card}
        className={
          'cpp-mm-ticket' +
          (selected ? ' is-selected' : '') +
          (expanded ? '' : ' is-clickable') +
          (allDone ? ' is-all-done' : '')
        }
        onClick={
          expanded
            ? undefined
            : (e) => {
                // 存根自己会切换
                if (!stub.current?.contains(e.target as Node)) toggle()
              }
        }
      >
        <div className="cpp-mm-ticket-top">
          <div
            ref={stub}
            className="cpp-mm-stub-button"
            role="button"
            tabIndex={0}
            aria-pressed={selected}
            aria-expanded={expandable ? expanded : undefined}
            onClick={toggle}
            onKeyDown={onButtonKey}
          >
            <Stub ticket={ticket} />
          </div>
          {expanded ? (
            <ExpandedRun ticket={ticket} board={board} index={index} onDrop={dropAt} />
          ) : (
            <Crew ticket={ticket} board={board} />
          )}
        </div>
        <CapacityStrip ticket={ticket} board={board} pickable={expanded} fallbackFocus={focusStub} />
        {allDone ? <span className="cpp-mm-stamp">{gt.pgettext('module mission', '已完成')}</span> : null}
      </div>
    )
  },
)

const UsedCard = memo(({ ticket, board }: { ticket: Ticket; board: Board }) => (
  <div className="cpp-mm-ticket is-used">
    <div className="cpp-mm-ticket-top">
      <Stub ticket={ticket} used={true} />
      <Crew ticket={ticket} board={board} />
      <span className="cpp-mm-stamp">{gt.pgettext('module mission', '已完成')}</span>
    </div>
  </div>
))

const Group = memo(({ id, title, children }: React.PropsWithChildren<{ id: MissionGroup; title: string }>) => {
  const [open, setOpen] = useAtom(openGroupsAtom)
  const isOpen = !!open[id]
  return (
    <div className="cpp-mm-group">
      <Button
        variant="minimal"
        size="small"
        alignText="start"
        fill={true}
        icon={isOpen ? 'chevron-down' : 'chevron-right'}
        text={title}
        aria-expanded={isOpen}
        onClick={() => setOpen((x) => ({ ...x, [id]: !isOpen }))}
      />
      {isOpen ? <div className="cpp-mm-group-body">{children}</div> : null}
    </div>
  )
})

const AnyStageGroup = memo(({ board }: { board: Board }) => {
  const names = useMissionNames()
  if (board.anyStage.length === 0) return null
  const undone = board.anyStage.reduce((n, g) => n + g.missions.filter((m) => !board.done.has(m.id)).length, 0)
  return (
    <Group
      id="anyStage"
      title={gt.ngettext('不限关卡 · %d 条', '不限关卡 · %d 条', undone).replaceAll('%d', String(undone))}
    >
      {board.anyStage.map((g) => (
        <div key={g.charId} className="cpp-mm-any">
          <OperatorButton mission={g.missions[0]} />
          {g.missions.map((m) => {
            const done = board.done.has(m.id)
            const summary = summaryOf(board, m, names)
            return (
              <div key={m.id} className={'cpp-mm-any-row' + (done ? ' is-done' : '')}>
                <MissionCheck mission={m} done={done} unlocked={board.unlocked.has(m.equipId)} label={summary} />
                <span className="cpp-mm-summary" title={m.desc}>
                  <ModuleCode charId={m.charId} equipId={m.equipId} /> {summary}
                </span>
              </div>
            )
          })}
        </div>
      ))}
    </Group>
  )
})

const BlockedGroup = memo(({ board }: { board: Board }) => {
  const ga = useArknights()
  const names = useMissionNames()
  if (board.blocked.length === 0) return null
  return (
    <Group
      id="blocked"
      title={gt
        .ngettext('还不能做 · %d 条', '还不能做 · %d 条', board.blocked.length)
        .replaceAll('%d', String(board.blocked.length))}
    >
      {board.blocked.map(({ mission: m, reason }) => {
        const summary = summaryOf(board, m, names)
        return (
          <div key={m.id} className="cpp-mm-blocked-row">
            <div className="cpp-mm-run-line">
              <OperatorButton mission={m} />
              <ModuleCode charId={m.charId} equipId={m.equipId} />
            </div>
            <div className="cpp-mm-summary" title={m.desc}>
              {m.stageId ? (
                <>
                  <StageCode stageId={m.stageId} />
                  {' · '}
                  {summary}
                </>
              ) : (
                summary
              )}
            </div>
            <div className="cpp-mm-muted">{blockText(ga, m.charId, reason)}</div>
          </div>
        )
      })}
    </Group>
  )
})

const UsedGroup = memo(({ board }: { board: Board }) => {
  if (board.used.length === 0) return null
  return (
    <Group
      id="used"
      title={gt
        .ngettext('用过的 · %d 张', '用过的 · %d 张', board.used.length)
        .replaceAll('%d', String(board.used.length))}
    >
      {board.used.map((t) => (
        <UsedCard key={t.key} ticket={t} board={board} />
      ))}
    </Group>
  )
})

// ---------------------------------------------------------------------------------------------------------------------
// 范围、统计、空状态

const ScopeRow = memo(() => {
  const [prefs, setPrefs] = useAtom(missionPrefsAtom)
  const item = (scope: MissionScope, label?: string) => (
    <MenuItem
      icon={prefs.scope === scope ? 'tick' : 'blank'}
      text={scopeNames[scope].toString()}
      label={label}
      active={prefs.scope === scope}
      onClick={() => setPrefs({ ...prefs, scope })}
    />
  )
  const toggleRarity = (r: number) =>
    setPrefs({
      ...prefs,
      rarities: prefs.rarities.includes(r)
        ? prefs.rarities.filter((x) => x !== r)
        : [...prefs.rarities, r].sort((a, b) => b - a),
    })
  return (
    <div className="cpp-mm-scope">
      <Popover
        minimal={true}
        placement="bottom-start"
        content={
          <Menu>
            {item('plan')}
            <MenuDivider />
            {item('open')}
            {item('elite2')}
            {item('owned')}
            {item('all')}
            <MenuDivider />
            {item('everything', gt.pgettext('module mission scope', '含已完成'))}
          </Menu>
        }
      >
        <Button
          variant="minimal"
          size="small"
          endIcon="caret-down"
          text={scopeNames[prefs.scope].toString()}
          title={gt.pgettext('module mission', '范围')}
        />
      </Popover>
      <ButtonGroup variant="minimal" size="small">
        {[6, 5, 4].map((r) => {
          const on = prefs.rarities.includes(r)
          return (
            <Button
              key={r}
              text={`${r}★`}
              active={on}
              aria-pressed={on}
              title={gt.pgettext('module mission', '只看 %d 星干员的模组').replaceAll('%d', String(r))}
              onClick={() => toggleRarity(r)}
            />
          )
        })}
      </ButtonGroup>
    </div>
  )
})

/** 数字和单位不拆开，放不下时整组换行 */
const Nowrap = ({ children }: React.PropsWithChildren) => <span className="cpp-mm-nowrap">{children}</span>

/** 「打完了」以后列表比原来短，焦点交给这里 */
const StatsRow = memo(({ board, wide }: { board: Board; wide: boolean }) => {
  const { stats } = board
  const self = useRef<HTMLDivElement>(null)
  const count = board.tickets.length
  useLayoutEffect(() => claimFocus(wide, self.current, (i) => i >= count))
  return (
    <div className="cpp-mm-stats" ref={self} tabIndex={-1}>
      <div className="cpp-mm-stats-main">
        {board.tickets.length === 0 ? (
          <span>{gt.pgettext('module mission', '关卡任务都做完了')}</span>
        ) : (
          <span>
            <Nowrap>
              <Num text={gt.ngettext('还剩 %d 次作战', '还剩 %d 次作战', stats.runs)} value={stats.runs} />
            </Nowrap>
            {' · '}
            <Nowrap>
              <Num text={gt.pgettext('module mission', '%d 理智')} value={stats.ap} />
            </Nowrap>
          </span>
        )}
        <span className="cpp-mm-muted cpp-mm-nowrap">
          {gt.ngettext('做完 %d 条', '做完 %d 条', stats.done).replaceAll('%d', String(stats.done))}
        </span>
      </div>
      {stats.runsWithBlocked > 0 ? (
        <div className="cpp-mm-muted">
          {gt
            .ngettext('其中 %d 次有人还不能做', '其中 %d 次有人还不能做', stats.runsWithBlocked)
            .replaceAll('%d', String(stats.runsWithBlocked))}
        </div>
      ) : null}
    </div>
  )
})

const EmptyBoard = memo(() => {
  const [prefs, setPrefs] = useAtom(missionPrefsAtom)
  if (prefs.scope === 'plan') {
    return (
      <NonIdealState
        icon="flag"
        title={gt.pgettext('module mission', '计划里没有要解锁的模组')}
        description={gt.pgettext('module mission', '在干员的培养目标里把模组设到 1 级以上，它的任务就会列在这里。')}
        action={
          <Button
            text={gt.pgettext('module mission', '看任务已开放的')}
            onClick={() => setPrefs({ ...prefs, scope: 'open' })}
          />
        }
      />
    )
  }
  return (
    <NonIdealState
      icon="flag"
      title={gt.pgettext('module mission', '这一档里没有模组')}
      action={
        prefs.rarities.length > 0 ? (
          <Button
            text={gt.pgettext('module mission', '不按星级筛')}
            onClick={() => setPrefs({ ...prefs, rarities: [] })}
          />
        ) : undefined
      }
    />
  )
})

/**
 * 勾掉的还留在券上时贴在底部：出现、消失都不推动上面的东西。读屏要先有这个区域，内容变了才会读，
 * 所以没有要整理的时候也留着一个空的
 */
const TidyBar = memo(({ board }: { board: Board }) => {
  const cpp = useCpp<Arknights>()
  const after = useRunsAfterTidy(board)
  const n = board.stale
  return (
    <div className={'cpp-mm-tidy' + (n > 0 ? '' : ' is-empty')} role="status">
      {n > 0 ? (
        <>
          <span>
            {after != null && after < board.stats.runs
              ? gt
                  .ngettext(
                    '勾掉的 %1 条还留在券上，整理后还剩 %2 次',
                    '勾掉的 %1 条还留在券上，整理后还剩 %2 次',
                    n,
                  ) /* I10N: %1: ticked missions; %2: runs */
                  .replace('%1', String(n))
                  .replace('%2', String(after))
              : gt.ngettext('勾掉的 %d 条还留在券上', '勾掉的 %d 条还留在券上', n).replaceAll('%d', String(n))}
          </span>
          <Button
            variant="minimal"
            size="small"
            intent="primary"
            text={gt.pgettext('module mission', '整理')}
            onClick={() => tidyMissions(cpp)}
          />
        </>
      ) : null}
    </div>
  )
})

/** 面板和大窗口左栏共用：范围、统计、券和三个分组。大窗口里选中的券不展开 */
const BoardView = memo(({ wide }: { wide: boolean }) => {
  const board = useMissionBoard()
  useSyncSelection(board)
  return (
    <div className="cpp-mm-board">
      <ScopeRow />
      {board.stats.modules === 0 ? (
        <EmptyBoard />
      ) : (
        <>
          <StatsRow board={board} wide={wide} />
          {board.tickets.length === 0 ? (
            <div className="cpp-mm-all-done">{gt.pgettext('module mission', '关卡任务都做完了')}</div>
          ) : (
            board.tickets.map((t, i) => (
              <TicketCard key={t.key} ticket={t} board={board} expandable={!wide} index={i} />
            ))
          )}
          <AnyStageGroup board={board} />
          <BlockedGroup board={board} />
          <UsedGroup board={board} />
        </>
      )}
      <TidyBar board={board} />
    </div>
  )
})

const ModuleMissionPanelBody = memo(() => (
  <div className="cpp-mm-panel">
    <BoardView wide={false} />
  </div>
))

// ---------------------------------------------------------------------------------------------------------------------
// 大窗口的右栏

/** 任务表里的一条顺带：打一次只是推进。who 是「干员」格 */
const TablePiggyRow = ({
  mission: x,
  board,
  tagAlong,
  who,
}: {
  mission: MissionInput
  board: Board
  tagAlong?: boolean
  who?: React.ReactNode
}) => {
  const names = useMissionNames()
  const done = board.done.has(x.id)
  const summary = summaryOf(board, x, names)
  return (
    <tr className={'cpp-mm-table-piggy' + (tagAlong ? ' is-tag-along' : '') + (done ? ' is-done' : '')}>
      <td>
        <MissionCheck mission={x} done={done} unlocked={board.unlocked.has(x.equipId)} label={summary} />
      </td>
      <td>{who}</td>
      <td>
        <ModuleCode charId={x.charId} equipId={x.equipId} />
      </td>
      <td>
        <div>
          <span className="cpp-mm-piggy-tag">{gt.pgettext('module mission', '顺带')}</span>
          <span className="cpp-mm-summary">{summary}</span>
        </div>
        {summary !== x.desc ? <div className="cpp-mm-muted">{x.desc}</div> : null}
      </td>
    </tr>
  )
}

const TicketDetail = memo(({ ticket, board }: { ticket: Ticket; board: Board }) => {
  const ga = useArknights()
  const names = useMissionNames()
  const select = useSelectTicket()
  const finish = useFinishRun(true)
  const { drop } = useTagAlongActions(ticket)
  const focusAfter = useFocusAfterRender()
  const self = useRef<HTMLDivElement>(null)
  const title = useRef<HTMLHeadingElement>(null)
  const focusTitle = useEvent(() => title.current?.focus())
  // 焦点给下一位带上的人的「×」；没有了给「还能编入」那一行，它不是按钮了就给标题
  const dropAt = (i: number, charId: string) => {
    drop(charId)
    focusAfter(
      () =>
        self.current?.querySelectorAll<HTMLElement>('.cpp-mm-tag-drop')[i] ??
        self.current?.querySelector<HTMLElement>('.cpp-mm-cap-button') ??
        title.current,
    )
  }
  const piggyback = piggybackAfter(ticket)
  const stage = ga.getMissionCatalog().stage(ticket.stageId)
  const siblings = board.tickets
    .filter((t) => t.stageId === ticket.stageId && t !== ticket)
    .sort((a, b) => a.index - b.index)
  const cap = ticket.capacity
  const note = cap.count > 0 ? capacityNote(cap) : ''
  const capLabel = (target?: PickerTarget) => (
    <div
      {...target?.props}
      className={'cpp-mm-detail-label' + (target ? ' cpp-mm-cap-button' : '') + (target?.isOpen ? ' is-open' : '')}
    >
      {cap.count === 0 ? (
        gt.pgettext('module mission', '不能再编入别人')
      ) : (
        <>
          <Num text={gt.ngettext('还能编入 %d 位', '还能编入 %d 位', cap.count)} value={cap.count} />
          {target ? <PickerCount count={target.count} /> : null}
        </>
      )}
    </div>
  )
  return (
    <div className="cpp-mm-detail" ref={self}>
      <div>
        <h3 className="cpp-mm-detail-title" ref={title} tabIndex={-1}>
          <StageCode stageId={ticket.stageId} />
          {stage.name ? ' ' + stage.name : null}
        </h3>
        <div className="cpp-mm-muted">
          {[
            stage.zoneName,
            gt.pgettext('module mission', '%d 理智').replaceAll('%d', String(stage.apCost)),
            gt
              .pgettext('module mission', '第 %1 次，共 %2 次') /* I10N: %1, %2: numbers */
              .replace('%1', String(ticket.index))
              .replace('%2', String(ticket.total)),
          ]
            .filter(Boolean)
            .join(' · ')}
        </div>
      </div>
      {siblings.length > 0 ? (
        <div className="cpp-mm-siblings">
          {gt
            .ngettext('这一关还有 %d 次：', '这一关还有 %d 次：', siblings.length)
            .replaceAll('%d', String(siblings.length))}
          {siblings.map((t, i) => (
            <React.Fragment key={t.key}>
              {i > 0 ? ' · ' : null}
              <a role="button" tabIndex={0} onClick={() => select(t)} onKeyDown={onButtonKey}>
                {gt.pgettext('module mission', '第 %d 次').replaceAll('%d', String(t.index))}{' '}
                {listJoin(uniqueCharIds(t.missions).map((x) => names.character(x)))}
              </a>
            </React.Fragment>
          ))}
        </div>
      ) : null}
      <div>
        <TagAlongPicker ticket={ticket} board={board} placement="bottom-start" fallbackFocus={focusTitle}>
          {capLabel}
        </TagAlongPicker>
        {cap.count > 0 ? (
          <div className="cpp-mm-detail-pros">
            {deployableProfessions.map((p) => {
              const barred = !cap.professions.includes(p)
              return (
                <Tag
                  key={p}
                  minimal={true}
                  className={barred ? 'is-barred' : undefined}
                  icon={<ProfessionIcon profession={p} />}
                  role="img"
                  aria-label={barredLabel(p, barred)}
                  title={barred ? barredLabel(p, barred) : undefined}
                >
                  {professionName(p)}
                </Tag>
              )
            })}
            {note ? <span className="cpp-mm-muted">{note}</span> : null}
          </div>
        ) : null}
      </div>
      <RunNotes ticket={ticket} />
      <div>
        <div className="cpp-mm-detail-label">{gt.pgettext('module mission', '这一次的任务')}</div>
        <HTMLTable compact={true} className="cpp-mm-table">
          <thead>
            <tr>
              <th>{gt.pgettext('module mission', '完成')}</th>
              <th>{gt.pgettext('module mission', '干员')}</th>
              <th>{gt.pgettext('module mission', '模组')}</th>
              <th>{gt.pgettext('module mission', '任务')}</th>
            </tr>
          </thead>
          <tbody>
            {ticket.missions.map((m) => {
              const block = ticket.blocked.find((x) => x.charId === m.charId)
              const done = board.done.has(m.id)
              const summary = summaryOf(board, m, names)
              return (
                <React.Fragment key={m.id}>
                  <tr className={done ? 'is-done' : undefined}>
                    <td>
                      <MissionCheck mission={m} done={done} unlocked={board.unlocked.has(m.equipId)} label={summary} />
                    </td>
                    <td>
                      <OperatorButton mission={m} />
                      {block ? <div className="cpp-mm-muted">{blockShort(ga, m.charId, block.reason)}</div> : null}
                    </td>
                    <td>
                      <ModuleCode charId={m.charId} equipId={m.equipId} />{' '}
                      {ga.getDataManager().data.uniEquips[m.equipId]?.name}
                    </td>
                    <td>
                      <div className="cpp-mm-summary">{summary}</div>
                      {summary !== m.desc ? <div className="cpp-mm-muted">{m.desc}</div> : null}
                    </td>
                  </tr>
                  {piggyback.get(m.id)?.map((x) => (
                    <TablePiggyRow key={x.id} mission={x} board={board} />
                  ))}
                </React.Fragment>
              )
            })}
            {ticket.tagAlongs.map((x, i) =>
              x.missions.map((m, j) => (
                <TablePiggyRow
                  key={m.id}
                  mission={m}
                  board={board}
                  tagAlong={true}
                  who={
                    j === 0 ? (
                      <>
                        <div className="cpp-mm-run-line">
                          <OperatorButton mission={x} />
                          <DropButton
                            className="cpp-mm-tag-drop"
                            charId={x.charId}
                            onClick={() => dropAt(i, x.charId)}
                          />
                        </div>
                        <div className="cpp-mm-muted">{gt.pgettext('module mission', '带上的')}</div>
                      </>
                    ) : null
                  }
                />
              )),
            )}
          </tbody>
        </HTMLTable>
      </div>
      <div className="cpp-mm-run-actions">
        <Button
          intent="primary"
          icon="tick"
          text={finishText(ticket, board)}
          onClick={() => finish(ticket, board.tickets.indexOf(ticket))}
        />
      </div>
    </div>
  )
})

const BoardSummary = memo(({ board }: { board: Board }) => {
  const { stats } = board
  const fraction = (done: number, total: number) => `${done} / ${total}`
  return (
    <div className="cpp-mm-detail">
      <div className="cpp-mm-summary-big">
        <Nowrap>
          <Num text={gt.ngettext('还剩 %d 次作战', '还剩 %d 次作战', stats.runs)} value={stats.runs} />
        </Nowrap>
        {' · '}
        <Nowrap>
          <Num text={gt.pgettext('module mission', '%d 理智')} value={stats.ap} />
        </Nowrap>
      </div>
      <HTMLTable compact={true} className="cpp-mm-table">
        <tbody>
          <tr>
            <td>{gt.pgettext('module mission', '关卡任务做完')}</td>
            <td>{fraction(stats.stageDone, stats.stageTotal)}</td>
          </tr>
          <tr>
            <td>{gt.pgettext('module mission', '不限关卡任务做完')}</td>
            <td>{fraction(stats.anyStageDone, stats.anyStageTotal)}</td>
          </tr>
        </tbody>
      </HTMLTable>
      <div className="cpp-mm-muted">{gt.pgettext('module mission', '点左边的券，看这一次带谁')}</div>
    </div>
  )
})

const WideRight = memo(() => {
  const board = useMissionBoard()
  const selected = useAtomValue(selectedTicketAtom)
  const ticket = board.tickets.find((t) => t.key === selected)
  return ticket ? <TicketDetail ticket={ticket} board={board} /> : <BoardSummary board={board} />
})

const ModuleMissionWide = memo(() => (
  <div className="cpp-mm-wide">
    <div className="cpp-mm-wide-left">
      <BoardView wide={true} />
    </div>
    <div className="cpp-mm-wide-right">
      <WideRight />
    </div>
  </div>
))

export const moduleMissionsPanel: SidebarPanel = {
  id: 'moduleMissions',
  icon: 'flag',
  label: lpstr(() => gt.pgettext('sidebar panel', '模组')),
  title: lpstr(() => gt.pgettext('sidebar panel', '模组任务')),
  Body: ModuleMissionPanelBody,
  Wide: ModuleMissionWide,
  isAvailable: (ga) => (ga as ArknightsAdapter).hasModuleMissions(),
}
