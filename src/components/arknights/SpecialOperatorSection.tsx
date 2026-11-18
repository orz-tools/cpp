import { Icon, IconName } from '@blueprintjs/core'
import { useAtomValue } from 'jotai'
import React, { memo, useRef } from 'react'
import { useAtoms, useGameAdapter } from '../../Cpp'
import { Arknights, ArknightsAdapter, ArknightsCharacterStatus, Character } from '../../pkg/cpp-arknights'
import type { UnlockAt } from '../../pkg/cpp-arknights/baseSkills'
import {
  SoExpRow,
  SoMaster,
  SoNode,
  SoState,
  expRows,
  needUnmet,
  nodeState,
  soProgress,
} from '../../pkg/cpp-arknights/specialOperators'
import { ICharacter } from '../../pkg/cpp-basic'
import { gt, lpstr } from '../../pkg/gt'
import { CachedImg } from '../Icons'
import { PeekTrigger } from '../Peek'
import { useFocusFrame } from '../focusFrame'
import { DossierSection } from '../types'
import { moduleCode } from './ModuleMissionPanel'
import { modulePeek, skillPeek } from './peekKinds'
import { countText, eliteName, skillLevelText } from './statusEditor/text'
import { SPECIAL_OPERATOR_SECTION, soFrame, soTopicText } from './taskNotes'

const STATE_ICONS = { done: 'tick', planned: 'flag', idle: 'lock' } satisfies Record<SoState, IconName>

function stateText(state: SoState) {
  switch (state) {
    case 'done':
      return gt.pgettext('special operator', '已解锁')
    case 'planned':
      return gt.pgettext('special operator', '在计划里')
    case 'idle':
      return gt.pgettext('special operator', '没计划')
  }
}

/** 「需要精一 80 级」；1 级不写等级：「需要精二」 */
function needText({ elite, level }: UnlockAt) {
  if (level <= 1) {
    return gt
      .pgettext('special operator', '需要%s') /* I10N: %s: elite phase, e.g. 精二 */
      .replace('%s', eliteName(elite))
  }
  return gt
    .pgettext('special operator', '需要%s %d 级') /* I10N: %s: elite phase, e.g. 精一; %d: level */
    .replace('%s', eliteName(elite))
    .replace('%d', `${level}`)
}

function nodeTarget(node: SoNode) {
  switch (node.kind) {
    case 'elite':
      return eliteName(node.elite)
    case 'skill':
      return gt
        .pgettext('arknights task', `技能 %d 级`) /* I10N: %d: number */
        .replaceAll('%d', `${node.level}`)
    case 'mastery':
      return skillLevelText(7, node.mastery)
    case 'mod':
      return skillLevelText(node.level, 0)
  }
}

const StateIcon = ({ state }: { state: SoState | null }) => (
  <span className="cpp-so-st">
    {state ? <Icon icon={STATE_ICONS[state]} size={16} title={stateText(state)} /> : null}
  </span>
)

interface Progress {
  current: ArknightsCharacterStatus
  goal: ArknightsCharacterStatus | undefined
}

/** 精英化、技能、模组的一行；从任务列表点了说明行跳过来时框出 */
const NodeRow = memo(({ charId, node, current, goal }: { charId: string; node: SoNode } & Progress) => {
  const ref = useRef<HTMLDivElement>(null)
  const framed = useFocusFrame(soFrame(charId, node.key), ref)
  const state = nodeState(node, current, goal)
  return (
    <div ref={ref} className={`cpp-so-row is-${state}` + (framed ? ' cpp-framed' : '')}>
      <StateIcon state={state} />
      <span className="cpp-so-target">{nodeTarget(node)}</span>
      <span className="cpp-so-text">
        <span className="cpp-so-mission" title={node.mission.full}>
          {node.mission.text}
        </span>
        {state !== 'done' && needUnmet(node.need, current) ? (
          <span className="cpp-so-need">{needText(node.need)}</span>
        ) : null}
      </span>
    </div>
  )
})

function expLevelName(elite: number) {
  return gt
    .pgettext('special operator', '%s等级') /* I10N: %s: elite phase, e.g. 精一 */
    .replace('%s', eliteName(elite))
}

const ExpRow = memo(({ charId, row }: { charId: string; row: SoExpRow }) => {
  const ref = useRef<HTMLDivElement>(null)
  const framed = useFocusFrame(soFrame(charId, row.key), ref)
  const whole = row.from === 1 && row.to === row.top
  return (
    <div ref={ref} className={`cpp-so-exp is-${row.state}` + (framed ? ' cpp-framed' : '')}>
      <StateIcon state={row.state} />
      <span className="cpp-so-target">{expLevelName(row.elite)}</span>
      <span className="cpp-so-range">
        {`${row.from} → ${row.to}`}
        {whole
          ? null
          : gt
              .pgettext('special operator', '（整段共 %s）') /* I10N: %s: experience from level 1 to the top level */
              .replace('%s', countText(row.total))}
      </span>
      <span className="cpp-so-num">{countText(row.exp)}</span>
    </div>
  )
})

const MasterGroup = memo(({ master, current }: { master: SoMaster; current: ArknightsCharacterStatus }) => (
  <>
    <div className="cpp-so-sub">
      {master.name ??
        gt
          .pgettext('special operator', '精通 %d') /* I10N: %d: the master's number, for a master without a name */
          .replace('%d', `${master.number}`)}
    </div>
    {master.levels.map((level) => (
      <div key={level.level} className="cpp-so-row is-master">
        <StateIcon state={null} />
        <span className="cpp-so-target">{skillLevelText(level.level, 0)}</span>
        <span className="cpp-so-text">
          {level.mission ? (
            <>
              <span className="cpp-so-mission" title={level.mission.full}>
                {level.mission.text}
              </span>
              {needUnmet(level.need, current) ? <span className="cpp-so-need">{needText(level.need)}</span> : null}
            </>
          ) : (
            <span className="cpp-so-mission">
              {gt
                .pgettext('special operator', '%s时自动解锁') /* I10N: %s: elite phase, e.g. 精二 */
                .replace('%s', eliteName(level.need.elite))}
            </span>
          )}
        </span>
      </div>
    ))}
  </>
))

const SpecialOperatorSectionBody = memo(({ character }: { character: ICharacter }) => {
  const ga = useGameAdapter<Arknights>() as ArknightsAdapter
  const c = character as Character
  const atoms = useAtoms<Arknights>()
  const current = useAtomValue(atoms.currentCharacter(c.key))
  // goalCharacter() 没有计划时给的是现在的练度，分不出有没有计划
  const goal = useAtomValue(atoms.goalCharacters)[c.key]
  const so = c.specialOperator
  if (!so) return null
  const progress = { current, goal }
  const topic = soTopicText(so)
  // I10N: %s: game mode and topic, e.g. 集成战略：沉沦者的黑流树海
  const masterNote = gt.pgettext('special operator', '只在%s里生效；Closure++ 不记录精通，这里不标是否解锁')

  return (
    <div className="cpp-so">
      <div className="cpp-so-context">
        <strong>{topic}</strong> {gt.pgettext('special operator', '等级靠探索得分按比例换成的特勤经验')}
      </div>

      {so.elites.length > 0 || so.expMap.length > 0 ? (
        <div className="cpp-so-group">
          <div className="cpp-so-title">{gt.pgettext('special operator', '精英化')}</div>
          {so.elites.map((node) => (
            <NodeRow key={node.key} charId={c.key} node={node} {...progress} />
          ))}
          {expRows(so, current, goal).map((row) => (
            <ExpRow key={row.key} charId={c.key} row={row} />
          ))}
        </div>
      ) : null}

      {so.skillLevels.length > 0 || so.masteries.length > 0 ? (
        <div className="cpp-so-group">
          <div className="cpp-so-title">{gt.pgettext('special operator', '技能')}</div>
          {so.skillLevels.map((node) => (
            <NodeRow key={node.key} charId={c.key} node={node} {...progress} />
          ))}
          {c.skills.map(({ skillId, skill }) => {
            const nodes = so.masteries.filter((n) => n.skillId === skillId)
            if (nodes.length === 0) return null
            return (
              <React.Fragment key={skillId}>
                <div className="cpp-so-sub">
                  <PeekTrigger
                    peek={skillPeek(c.key, skillId)}
                    inline={true}
                    renderTarget={(peek) => (
                      <span
                        {...peek}
                        role={peek ? 'button' : undefined}
                        className={'cpp-so-sub-name' + (peek ? ' ' + peek.className : '')}
                      >
                        <CachedImg src={skill.icon} width="20" height="20" alt="" />
                        {skill.name}
                      </span>
                    )}
                  />
                </div>
                {nodes.map((node) => (
                  <NodeRow key={node.key} charId={c.key} node={node} {...progress} />
                ))}
              </React.Fragment>
            )
          })}
        </div>
      ) : null}

      {so.modules.length > 0 ? (
        <div className="cpp-so-group">
          <div className="cpp-so-title">{gt.pgettext('special operator', '模组')}</div>
          {[...new Set(so.modules.map((n) => n.equipId))].map((equipId) => (
            <React.Fragment key={equipId}>
              <div className="cpp-so-sub">
                <PeekTrigger
                  peek={modulePeek(c.key, equipId)}
                  inline={true}
                  renderTarget={(peek) => (
                    <span
                      {...peek}
                      role={peek ? 'button' : undefined}
                      className={'cpp-so-sub-name' + (peek ? ' ' + peek.className : '')}
                    >
                      <span className="cpp-so-code">{moduleCode(ga, equipId)}</span>
                      {ga.getDataManager().data.uniEquips[equipId]?.name ?? equipId}
                    </span>
                  )}
                />
              </div>
              {so.modules
                .filter((n) => n.equipId === equipId)
                .map((node) => (
                  <NodeRow key={node.key} charId={c.key} node={node} {...progress} />
                ))}
            </React.Fragment>
          ))}
        </div>
      ) : null}

      {so.masters.length > 0 ? (
        <div className="cpp-so-group">
          <div className="cpp-so-title">{gt.pgettext('special operator', '精通')}</div>
          <div className="cpp-so-note">{masterNote.replace('%s', topic)}</div>
          {so.masters.map((master) => (
            <MasterGroup key={master.masterId} master={master} current={current} />
          ))}
        </div>
      ) : null}
    </div>
  )
})

/** 精英化、技能、模组里已解锁的 / 全部；精通 Closure++ 不记录，不算 */
function useSpecialOperatorTag(character: ICharacter): string | null {
  const current = useAtomValue(useAtoms<Arknights>().currentCharacter(character.key))
  const so = (character as Character).specialOperator
  if (!so) return null
  const { done, total } = soProgress(so, current)
  return `${done}/${total}`
}

export const specialOperatorSection: DossierSection = {
  id: SPECIAL_OPERATOR_SECTION,
  title: lpstr(() => gt.pgettext('dossier section', '特勤任务')),
  Body: SpecialOperatorSectionBody,
  isAvailable: (_ga, c) => !!(c as Character).specialOperator,
  useTag: useSpecialOperatorTag,
}
