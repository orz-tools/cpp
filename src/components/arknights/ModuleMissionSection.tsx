import { Button } from '@blueprintjs/core'
import { useAtomValue } from 'jotai'
import React, { memo } from 'react'
import { useAtoms, useGameAdapter } from '../../Cpp'
import { Arknights, ArknightsAdapter, Character } from '../../pkg/cpp-arknights'
import { MissionInput, missionProgress, missionSummary, parseMission } from '../../pkg/cpp-arknights/moduleMissions'
import { ICharacter } from '../../pkg/cpp-basic'
import { gt, lpstr } from '../../pkg/gt'
import { useShowSidebarPanel } from '../Sidebar'
import { DossierSection } from '../types'
import { MissionCheck, ModuleCode, OperatorButton, blockText, summaryOf, useSelectTicket } from './ModuleMissionPanel'
import { useDoneMissions, useMissionBoard, useMissionNames } from './moduleMissionState'

const ModuleMissionSectionBody = memo(({ character }: { character: ICharacter }) => {
  const ga = useGameAdapter<Arknights>() as ArknightsAdapter
  const c = character as Character
  const atoms = useAtoms<Arknights>()
  const current = useAtomValue(atoms.currentCharacter(c.key))
  const goal = useAtomValue(atoms.goalCharacter(c.key))
  const doneSet = useDoneMissions()
  const board = useMissionBoard()
  const names = useMissionNames()
  const showPanel = useShowSidebarPanel()
  const select = useSelectTicket()

  const catalog = ga.getMissionCatalog()
  const modules = catalog.modules.filter((m) => m.charId === c.key)
  const owned = catalog.isOwned(c.key, current)
  const levelBlocked = owned && (current.elite < 2 || current.level < c.modUnlockLevel)

  return (
    <div className="cpp-mm-dossier">
      {modules.map((mod) => {
        const name = ga.getDataManager().data.uniEquips[mod.equipId]?.name ?? ''
        if ((current.modLevel[mod.equipId] ?? 0) >= 1) {
          return (
            <div key={mod.equipId} className="cpp-mm-dossier-module">
              <ModuleCode charId={c.key} equipId={mod.equipId} /> {gt.pgettext('module mission', '已解锁，任务已完成')}
            </div>
          )
        }
        const planned = goal?.modLevel[mod.equipId] ?? 0
        return (
          <div key={mod.equipId} className="cpp-mm-dossier-module">
            <div className="cpp-mm-dossier-title">
              <ModuleCode charId={c.key} equipId={mod.equipId} /> {name}{' '}
              <span className="cpp-mm-muted">
                {planned >= 1
                  ? gt.pgettext('module mission', '未解锁 · 计划解锁到 %d 级').replaceAll('%d', String(planned))
                  : gt.pgettext('module mission', '未解锁')}
              </span>
            </div>
            {mod.missions.map((m) => {
              const done = doneSet.has(m.id)
              const ticket = board.ticketOf.get(m.id)
              const others = ticket && board.tickets.includes(ticket) ? otherCrew(ticket.missions, m) : []
              const stage = m.stageId ? catalog.stage(m.stageId) : null
              const summary = missionSummary(parseMission(m, catalog.world), names)
              return (
                <div key={m.id} className={'cpp-mm-dossier-mission' + (done ? ' is-done' : '')}>
                  <div className="cpp-mm-dossier-row">
                    <MissionCheck mission={m} done={done} unlocked={false} label={summary} />
                    <div>
                      <div className="cpp-mm-summary">{summary}</div>
                      {/* 摘要就是原文时不重复 */}
                      {summary !== m.desc || stage ? (
                        <div className="cpp-mm-muted">{stage ? `${stage.code} · ${m.desc}` : m.desc}</div>
                      ) : null}
                      {levelBlocked ? <div className="cpp-mm-muted">{blockText(ga, c.key, 'level')}</div> : null}
                    </div>
                  </div>
                  {ticket && others.length > 0 && stage ? (
                    <div className="cpp-mm-together">
                      <div className="cpp-mm-together-title">
                        <span>
                          {gt
                            .pgettext('module mission', '%s 这一次还能做') /* I10N: %s: stage code */
                            .replaceAll('%s', stage.code)}
                          {ticket.total > 1 ? ` (${ticket.index}/${ticket.total})` : null}
                        </span>
                        <Button
                          variant="minimal"
                          size="small"
                          intent="primary"
                          icon="flag"
                          text={gt.pgettext('module mission', '在侧栏里看')}
                          onClick={() => {
                            showPanel('moduleMissions')
                            select(ticket)
                          }}
                        />
                      </div>
                      <div className="cpp-mm-together-list">
                        {others.map((x) => {
                          const otherDone = board.done.has(x.id)
                          return (
                            <React.Fragment key={x.id}>
                              <span className={'cpp-mm-chip' + (otherDone ? ' is-done' : '')}>
                                <OperatorButton mission={x} />
                              </span>
                              <span className={'cpp-mm-summary' + (otherDone ? ' is-done' : '')} title={x.desc}>
                                {summaryOf(board, x, names)}
                              </span>
                            </React.Fragment>
                          )
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
})

/** 同一次里的别人，每人一个 */
function otherCrew(missions: readonly MissionInput[], self: MissionInput) {
  const seen = new Set([self.charId])
  return missions.filter((x) => !seen.has(x.charId) && seen.add(x.charId))
}

/** 页签上的「已完成/全部」：只算还没解锁的模组，全部解锁了就不写 */
function useMissionTag(character: ICharacter): string | null {
  const ga = useGameAdapter<Arknights>() as ArknightsAdapter
  const current = useAtomValue(useAtoms<Arknights>().currentCharacter(character.key))
  const done = useDoneMissions()
  const modules = ga.getMissionCatalog().modules.filter((m) => m.charId === character.key)
  const progress = missionProgress(modules, current, done)
  return progress ? `${progress.done}/${progress.total}` : null
}

export const moduleMissionsSection: DossierSection = {
  id: 'moduleMissions',
  title: lpstr(() => gt.pgettext('dossier section', '模组任务')),
  Body: ModuleMissionSectionBody,
  useTag: useMissionTag,
  isAvailable: (ga, character) => {
    const aga = ga as ArknightsAdapter
    return aga.hasModuleMissions() && aga.getMissionCatalog().modules.some((m) => m.charId === character.key)
  },
}
