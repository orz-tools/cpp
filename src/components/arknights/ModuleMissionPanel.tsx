import {
  Button,
  ButtonGroup,
  Callout,
  Checkbox,
  HTMLTable,
  Menu,
  MenuDivider,
  MenuItem,
  NonIdealState,
  Popover,
  Tag,
} from '@blueprintjs/core'
import { useAtom, useAtomValue } from 'jotai'
import React, { memo, useEffect, useLayoutEffect, useRef } from 'react'
import useEvent from 'react-use-event-hook'
import { useCpp, useGameAdapter } from '../../Cpp'
import { Arknights, ArknightsAdapter, DeployableProfession, Profession, ProfessionNames } from '../../pkg/cpp-arknights'
import {
  BlockReason,
  Board,
  Capacity,
  MissionInput,
  MissionNames,
  MissionScope,
  Ticket,
  deployableProfessions,
  formatPiggybackConflict,
  formatSplitReasons,
  listJoin,
  missionSummary,
  successorTicket,
} from '../../pkg/cpp-arknights/moduleMissions'
import { PSTR, gt, lpstr } from '../../pkg/gt'
import { CachedImg } from '../Icons'
import { AppToaster } from '../Toaster'
import { useOpenCharacterDossier } from '../dossierHooks'
import { clearRosterPin, setRosterPin } from '../rosterPin'
import { SidebarPanel } from '../types'
import { ProfessionIcon } from './Icons'
import {
  MissionGroup,
  markRunDone,
  missionPrefsAtom,
  openGroupsAtom,
  releaseMissions,
  selectedTicketAtom,
  setMissionsDone,
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

export function blockText(ga: ArknightsAdapter, charId: string, reason: BlockReason) {
  return reason === 'absent'
    ? gt.pgettext('module mission', '未持有')
    : gt
        .pgettext('module mission', '精二 %d 级后才算')
        .replaceAll('%d', String(ga.getCharacter(charId)?.modUnlockLevel ?? 0))
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

export function summaryOf(board: Board, m: MissionInput, names: MissionNames) {
  const parsed = board.parsed.get(m.id)
  return parsed ? missionSummary(parsed, names) : m.desc
}

/** 选中一张券，干员列表随之筛成这一次的干员；null 取消选中 */
export function useSelectTicket() {
  const cpp = useCpp<Arknights>()
  const ga = useArknights()
  return useEvent((ticket: Ticket | null) => {
    if (!ticket) {
      cpp.store.set(selectedTicketAtom, null)
      clearRosterPin(cpp)
      return
    }
    const code = stageCodeOf(ga, ticket)
    const label =
      ticket.total > 1
        ? gt
            .pgettext('module mission', '模组任务 · %1 第 %2 次') /* I10N: %1: stage code; %2: run number */
            .replace('%1', code)
            .replace('%2', String(ticket.index))
        : gt.pgettext('module mission', '模组任务 · %s').replaceAll('%s', code)
    cpp.store.set(selectedTicketAtom, ticket.key)
    setRosterPin(cpp, label, uniqueCharIds(ticket.missions))
  })
}

/** 选中的券不在了：只是勾掉或取消了其中一条时跟到那张券上，分法变了或者都做完了就取消选中、清筛选 */
function useSyncSelection(board: Board) {
  const selected = useAtomValue(selectedTicketAtom)
  const select = useSelectTicket()
  const missing = selected != null && !board.tickets.some((t) => t.key === selected)
  useEffect(() => {
    if (missing) select(successorTicket(board.tickets, selected) ?? null)
  }, [missing, selected, board.tickets, select])
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
      [...ticket.missions, ...ticket.piggyback].map((x) => x.id),
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
      <div className="cpp-mm-stub-code">{stage.code}</div>
      <div className="cpp-mm-stub-line" title={stage.name}>
        {ticket.total > 1 && !used ? `${ticket.index}/${ticket.total}` : stage.name}
      </div>
      <div className="cpp-mm-stub-line">
        {gt.pgettext('module mission', '%d 理智').replaceAll('%d', String(stage.apCost))}
      </div>
    </div>
  )
})

/** 收起的券上要带的人：头像加名字，排成一行，放不下就换行。这张券上的任务都做完了的人，名字划掉 */
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
        const done = ticket.missions.every(
          (x) => x.charId !== m.charId || x.formId !== m.formId || board.done.has(x.id),
        )
        return (
          <span
            key={key}
            className={'cpp-mm-chip' + (block ? ' is-blocked' : '') + (done ? ' is-done' : '')}
            title={block ? blockText(ga, m.charId, block.reason) : undefined}
          >
            <Avatar charId={m.charId} size={20} />
            <OperatorName mission={m} />
          </span>
        )
      })}
    </div>
  )
})

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

/** 券的下半截：还能再编入几位、哪些职业 */
const CapacityStrip = memo(({ cap }: { cap: Capacity }) => {
  const note = cap.count > 0 ? capacityNote(cap) : ''
  return (
    <div className="cpp-mm-cap">
      {cap.count === 0 ? (
        <span>{gt.pgettext('module mission', '不能再编入别人')}</span>
      ) : (
        <>
          <span>
            <Num text={gt.ngettext('还能编入 %d 位', '还能编入 %d 位', cap.count)} value={cap.count} />
          </span>
          <span className="cpp-mm-pros">
            {deployableProfessions.map((p) => {
              const barred = !cap.professions.includes(p)
              const label = barredLabel(p, barred)
              return (
                <span
                  key={p}
                  className={'cpp-mm-pro' + (barred ? ' is-barred' : '')}
                  role="img"
                  aria-label={label}
                  title={label}
                >
                  <ProfessionIcon profession={p} />
                </span>
              )
            })}
          </span>
        </>
      )}
      {note ? <span className="cpp-mm-cap-note">{note}</span> : null}
    </div>
  )
})

function runReason(ga: ArknightsAdapter, ticket: Ticket, names: MissionNames) {
  return gt
    .pgettext('module mission', '%1 要打 %2 次：%3') /* I10N: %1: stage code; %2: a number; %3: the reasons */
    .replace('%1', stageCodeOf(ga, ticket))
    .replace('%2', String(ticket.total))
    .replace('%3', formatSplitReasons(ticket.reasons, names))
}

/** 几条提示：分开的原因、都要歼灭的敌人、认不出的条件 */
const RunNotes = memo(({ ticket, withReason }: { ticket: Ticket; withReason: boolean }) => {
  const ga = useArknights()
  const names = useMissionNames()
  return (
    <>
      {withReason && ticket.total > 1 ? (
        <div className="cpp-mm-note is-warning">{runReason(ga, ticket, names)}</div>
      ) : null}
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
const PiggybackRows = memo(
  ({ ticket, board, missions }: { ticket: Ticket; board: Board; missions: MissionInput[] }) => {
    const names = useMissionNames()
    return (
      <>
        {missions.map((m) => {
          const done = board.done.has(m.id)
          const c = ticket.piggybackConflicts.get(m.id)
          const summary = summaryOf(board, m, names)
          return (
            <div key={m.id} className={'cpp-mm-piggy' + (done ? ' is-done' : '') + (c ? ' is-off' : '')}>
              <MissionCheck mission={m} done={done} unlocked={board.unlocked.has(m.equipId)} label={summary} />
              <div className="cpp-mm-piggy-text">
                <span className="cpp-mm-piggy-tag">{gt.pgettext('module mission', '顺带')}</span>
                <span className="cpp-mm-summary" title={m.desc}>
                  {summary}
                </span>
                {c ? <div className="cpp-mm-note is-warning">{formatPiggybackConflict(c, names)}</div> : null}
              </div>
            </div>
          )
        })}
      </>
    )
  },
)

/** 选中的券在面板里展开 */
const ExpandedRun = memo(({ ticket, board, index }: { ticket: Ticket; board: Board; index: number }) => {
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
            <div className={'cpp-mm-run-who' + (block ? ' is-blocked' : '')}>
              <div className="cpp-mm-run-line">
                <OperatorButton mission={m} size={24} />
                <span className="cpp-mm-equip">{moduleCode(ga, m.equipId)}</span>
              </div>
              <div className="cpp-mm-summary" title={m.desc}>
                {summary}
              </div>
              {block ? <div className="cpp-mm-muted">{blockText(ga, m.charId, block.reason)}</div> : null}
              {piggies ? <PiggybackRows ticket={ticket} board={board} missions={piggies} /> : null}
            </div>
          </div>
        )
      })}
      <RunNotes ticket={ticket} withReason={true} />
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
})

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
    const stub = useRef<HTMLDivElement>(null)
    const expanded = expandable && selected
    const allDone = ticket.allDone && !expanded
    const toggle = () => select(selected ? null : ticket)
    useLayoutEffect(() => claimFocus(!expandable, stub.current, (i) => i === index))
    return (
      <div
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
            <ExpandedRun ticket={ticket} board={board} index={index} />
          ) : (
            <Crew ticket={ticket} board={board} />
          )}
        </div>
        <CapacityStrip cap={ticket.capacity} />
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
  const ga = useArknights()
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
                  <span className="cpp-mm-equip">{moduleCode(ga, m.equipId)}</span> {summary}
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
              <span className="cpp-mm-equip">{moduleCode(ga, m.equipId)}</span>
            </div>
            <div className="cpp-mm-summary" title={m.desc}>
              {m.stageId ? `${ga.getMissionCatalog().stage(m.stageId).code} · ${summary}` : summary}
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

const TicketDetail = memo(({ ticket, board }: { ticket: Ticket; board: Board }) => {
  const ga = useArknights()
  const names = useMissionNames()
  const select = useSelectTicket()
  const finish = useFinishRun(true)
  const piggyback = piggybackAfter(ticket)
  const stage = ga.getMissionCatalog().stage(ticket.stageId)
  const siblings = board.tickets
    .filter((t) => t.stageId === ticket.stageId && t !== ticket)
    .sort((a, b) => a.index - b.index)
  const cap = ticket.capacity
  const note = cap.count > 0 ? capacityNote(cap) : ''
  return (
    <div className="cpp-mm-detail">
      <div>
        <h3 className="cpp-mm-detail-title">{[stage.code, stage.name].filter(Boolean).join(' ')}</h3>
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
      {ticket.total > 1 ? (
        <Callout intent="warning" compact={true} icon={null}>
          {runReason(ga, ticket, names)}
          {siblings.length > 0 ? (
            <>
              {gt.pgettext('module mission', '。其余几次：')}
              {siblings.map((t, i) => (
                <React.Fragment key={t.key}>
                  {i > 0 ? ' · ' : null}
                  <a role="button" tabIndex={0} onClick={() => select(t)} onKeyDown={onButtonKey}>
                    {gt.pgettext('module mission', '第 %d 次').replaceAll('%d', String(t.index))}{' '}
                    {listJoin(uniqueCharIds(t.missions).map((x) => names.character(x)))}
                  </a>
                </React.Fragment>
              ))}
            </>
          ) : null}
        </Callout>
      ) : null}
      <div>
        <div className="cpp-mm-detail-label">
          {cap.count === 0 ? (
            gt.pgettext('module mission', '不能再编入别人')
          ) : (
            <Num text={gt.ngettext('还能编入 %d 位', '还能编入 %d 位', cap.count)} value={cap.count} />
          )}
        </div>
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
      <RunNotes ticket={ticket} withReason={false} />
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
                    <td
                      className={block ? 'is-blocked' : undefined}
                      title={block ? blockText(ga, m.charId, block.reason) : undefined}
                    >
                      <OperatorButton mission={m} />
                    </td>
                    <td>
                      <span className="cpp-mm-equip">{moduleCode(ga, m.equipId)}</span>{' '}
                      {ga.getDataManager().data.uniEquips[m.equipId]?.name}
                    </td>
                    <td>
                      <div className="cpp-mm-summary">{summary}</div>
                      {summary !== m.desc ? <div className="cpp-mm-muted">{m.desc}</div> : null}
                    </td>
                  </tr>
                  {piggyback.get(m.id)?.map((x) => {
                    const done = board.done.has(x.id)
                    const c = ticket.piggybackConflicts.get(x.id)
                    const summary = summaryOf(board, x, names)
                    return (
                      <tr key={x.id} className={'cpp-mm-table-piggy' + (done ? ' is-done' : '') + (c ? ' is-off' : '')}>
                        <td>
                          <MissionCheck
                            mission={x}
                            done={done}
                            unlocked={board.unlocked.has(x.equipId)}
                            label={summary}
                          />
                        </td>
                        <td />
                        <td>
                          <span className="cpp-mm-equip">{moduleCode(ga, x.equipId)}</span>
                        </td>
                        <td>
                          <div>
                            <span className="cpp-mm-piggy-tag">{gt.pgettext('module mission', '顺带')}</span>
                            <span className="cpp-mm-summary">{summary}</span>
                          </div>
                          {summary !== x.desc ? <div className="cpp-mm-muted">{x.desc}</div> : null}
                          {c ? <div className="cpp-mm-note is-warning">{formatPiggybackConflict(c, names)}</div> : null}
                        </td>
                      </tr>
                    )
                  })}
                </React.Fragment>
              )
            })}
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
