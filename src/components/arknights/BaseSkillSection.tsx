import { Button, Classes } from '@blueprintjs/core'
import { useAtomValue } from 'jotai'
import React, { memo, useLayoutEffect, useRef, useState } from 'react'
import useEvent from 'react-use-event-hook'
import { useAtoms, useCpp, useGameAdapter } from '../../Cpp'
import { Arknights, ArknightsAdapter, ArknightsCharacterStatus, Character } from '../../pkg/cpp-arknights'
import { BaseSkill } from '../../pkg/cpp-arknights/DataManager'
import {
  BaseSkillState,
  baseRoomName,
  baseSkillState,
  reached,
  unlockCost,
  unlockFrom,
} from '../../pkg/cpp-arknights/baseSkills'
import { Details, getBuildingBuffDetail } from '../../pkg/cpp-arknights/details'
import { parseRichText } from '../../pkg/cpp-arknights/richText'
import { ICharacter } from '../../pkg/cpp-basic'
import { gt, lpstr } from '../../pkg/gt'
import { CachedImg } from '../Icons'
import { ValueTag } from '../Value'
import { DossierSection } from '../types'
import { BaseSkillEffect } from './BaseSkillEffect'
import { unlockSentence, unlockShort } from './baseSkillText'
import { RichText } from './statusEditor/Detail'
import { LoadedDetails, useDetails } from './useDetails'
import elite1 from './assets/elite1-small.png'
import elite2 from './assets/elite2-small.png'

const eliteImages = [undefined, elite1, elite2]

const isHave = (state: BaseSkillState) => state === 'unlocked' || state === 'replaced'

interface Placed {
  skill: BaseSkill
  state: BaseSkillState
  owned: boolean
}

/** 图标；没解锁的去色、半透明，右下角压精英化徽记，精零有等级条件时压等级数 */
const SkillIcon = memo(({ placed, size }: { placed: Placed; size: number }) => {
  const { skill, state } = placed
  const have = isHave(state)
  return (
    <span className={'cpp-bskill-plate-icon' + (have ? '' : ' is-locked')} style={{ width: size, height: size }}>
      <CachedImg src={skill.buff.icon} width={size} height={size} alt="" />
      {have ? null : (
        <span className={'cpp-bskill-badge' + (state === 'planned' ? ' is-plan' : '') + (skill.elite ? '' : ' is-num')}>
          {skill.elite ? <img src={eliteImages[skill.elite]} alt="" /> : skill.level}
        </span>
      )}
    </span>
  )
})

/** 挂件之间至少留这么宽 */
const HANG_GAP = 4
/** 段与段之间的缝 */
const SEGMENT_GAP = 2
/** 计划升阶到新一段的 1 级时，蓝色至少画进这一段这么宽，免得看不见 */
const MIN_INTO_SEGMENT = 8

/**
 * 每个解锁点的挂件先以自己的点居中，和前一个重叠时往右推；超出右边时整排往左收。
 * widths 是量出来的挂件宽度，还没量时按估计的算。
 */
function placeHangs(points: readonly number[], widths: readonly number[], width: number): number[] {
  const lefts: number[] = []
  points.forEach((x, i) => {
    let left = Math.max(0, x - widths[i] / 2)
    if (i > 0) left = Math.max(left, lefts[i - 1] + widths[i - 1] + HANG_GAP)
    lefts.push(left)
  })
  let limit = width
  for (let i = lefts.length - 1; i >= 0; i--) {
    lefts[i] = Math.max(0, Math.min(lefts[i], limit - widths[i]))
    limit = lefts[i] - HANG_GAP
  }
  return lefts
}

/** 一条按精英化阶段分段的轨道：灰到现在，蓝到目标，解锁点下面挂图标和还没到的点的花费 */
const UnlockRail = memo(
  ({
    ga,
    character,
    current,
    goal,
    placed,
  }: {
    ga: ArknightsAdapter
    character: Character
    current: ArknightsCharacterStatus
    goal: ArknightsCharacterStatus | undefined
    placed: Placed[][]
  }) => {
    // 换价值单位时花费的宽度跟着变，要重新量
    useAtomValue(useCpp().preferenceAtoms.valueTypeAtom)
    const ref = useRef<HTMLDivElement>(null)
    const [measured, setMeasured] = useState<{ width: number; hangs: number[] }>()

    // 同一点解锁的技能挂在一起，共用一笔花费
    const points = new Map<string, Placed[]>()
    for (const p of placed.flat().sort((a, b) => a.skill.elite - b.skill.elite || a.skill.level - b.skill.level)) {
      const key = `${p.skill.elite}.${p.skill.level}`
      points.set(key, [...(points.get(key) ?? []), p])
    }
    const groups = [...points.values()].map((list) => {
      const at = list[0].skill
      const planned = list.some((x) => x.state === 'planned')
      const free = list.every((x) => isHave(x.state)) || reached(unlockFrom(ga, character, current), at)
      return { list, at, planned, cost: free ? null : unlockCost(ga, character, current, at) }
    })

    const measure = useEvent(() => {
      const el = ref.current
      if (!el) return
      const width = el.clientWidth
      const hangs = [...el.querySelectorAll<HTMLElement>('.cpp-bskill-hang')].map((x) => x.offsetWidth)
      // 和画着的一样就不能调 setMeasured：给回原来的值 React 也会再画一次，画完又量，就画不停了（同 CPP-69）
      if (measured && measured.width === width && measured.hangs.join() === hangs.join()) return
      setMeasured({ width, hangs })
    })
    useLayoutEffect(() => measure())
    useLayoutEffect(() => {
      const el = ref.current
      if (!el) return
      const observer = new ResizeObserver(() => measure())
      observer.observe(el)
      return () => observer.disconnect()
    }, [measure])

    const width = measured?.width ?? 440
    const maxLevels = character.maxLevels
    const n = maxLevels.length
    const segment = (width - SEGMENT_GAP * (n - 1)) / n
    const x = (elite: number, level: number) => {
      const e = Math.min(elite, n - 1)
      const max = maxLevels[e]
      const f = max > 1 ? Math.min(1, Math.max(0, (level - 1) / (max - 1))) : 0
      return e * (segment + SEGMENT_GAP) + segment * f
    }

    const owned = !ga.getUserDataAdapter().isAbsentCharacter(character, current)
    const currentX = owned ? x(current.elite, current.level) : 0
    let goalX = goal ? x(goal.elite, goal.level) : currentX
    if (goal && goal.elite > 0 && (!owned || goal.elite > current.elite)) {
      goalX = Math.max(goalX, x(goal.elite, 1) + MIN_INTO_SEGMENT)
    }

    // 填色按段切开，段间的缝不涂
    const fill = (from: number, to: number, className: string) =>
      maxLevels.flatMap((_, i) => {
        const start = i * (segment + SEGMENT_GAP)
        const a = Math.max(from, start)
        const b = Math.min(to, start + segment)
        return b > a ? [<i key={`${className}${i}`} className={className} style={{ left: a, width: b - a }} />] : []
      })

    const pointX = groups.map((g) => x(g.at.elite, g.at.level))
    const estimated = groups.map((g) => Math.max(g.list.length * 26 - HANG_GAP, g.cost === null ? 0 : 64))
    const hangWidths = measured?.hangs.length === groups.length ? measured.hangs : estimated
    const lefts = placeHangs(pointX, hangWidths, width)
    const eliteNames = [
      gt.pgettext('arknights base skill', '精零'),
      gt.pgettext('arknights base skill', '精一'),
      gt.pgettext('arknights base skill', '精二'),
    ]

    return (
      <div className="cpp-bskill-rail" ref={ref}>
        {maxLevels.map((_, i) => (
          <span key={i} className="cpp-bskill-rail-label" style={{ left: i * (segment + SEGMENT_GAP) }}>
            {eliteNames[i]}
          </span>
        ))}
        {maxLevels.map((_, i) => (
          <i
            key={i}
            className="cpp-bskill-rail-segment"
            style={{ left: i * (segment + SEGMENT_GAP), width: segment }}
          />
        ))}
        {owned ? fill(0, currentX + 0.01, 'cpp-bskill-rail-have') : null}
        {goalX > currentX ? fill(currentX, goalX, 'cpp-bskill-rail-plan') : null}
        {owned ? <i className="cpp-bskill-rail-current" style={{ left: currentX - 1.5 }} /> : null}
        {goal && goalX > currentX ? <i className="cpp-bskill-rail-goal" style={{ left: goalX - 7 }} /> : null}
        {groups.map((g, i) => (
          <React.Fragment key={`${g.at.elite}.${g.at.level}`}>
            <i className={'cpp-bskill-rail-stalk' + (g.planned ? ' is-plan' : '')} style={{ left: pointX[i] - 0.5 }} />
            <span className="cpp-bskill-hang" style={{ left: lefts[i] }}>
              <span className="cpp-bskill-hang-icons">
                {g.list.map((p) => (
                  <SkillIcon key={p.skill.buff.id + p.skill.slot} placed={p} size={22} />
                ))}
              </span>
              {g.cost === null ? null : <ValueTag value={g.cost} minimal />}
            </span>
          </React.Fragment>
        ))}
      </div>
    )
  },
)

/** 原文：下载中是骨架条，下载失败或者没有这条时说一声 */
function textOf(loaded: LoadedDetails, buffId: string): { text: React.ReactNode; details: Details | null } {
  if (!loaded) {
    return {
      text: (
        <span className="cpp-bskill-skeleton">
          <span className={Classes.SKELETON} />
          <span className={Classes.SKELETON} />
        </span>
      ),
      details: null,
    }
  }
  if ('error' in loaded) {
    return {
      text: <span className="cpp-bskill-missing">{gt.pgettext('arknights base skill', '原文没有加载出来')}</span>,
      details: null,
    }
  }
  const detail = getBuildingBuffDetail(loaded.details, buffId)
  if (!detail) {
    return {
      text: <span className="cpp-bskill-missing">{gt.pgettext('arknights base skill', '没有这条技能的原文')}</span>,
      details: loaded.details,
    }
  }
  return { text: <RichText segments={parseRichText(detail.text)} details={loaded.details} />, details: loaded.details }
}

const SkillCard = memo(({ placed, roomName, loaded }: { placed: Placed; roomName: string; loaded: LoadedDetails }) => {
  const { skill, state, owned } = placed
  const have = isHave(state)
  const { text, details } = textOf(loaded, skill.buff.id)
  const detail = details ? getBuildingBuffDetail(details, skill.buff.id) : null
  return (
    <div className={'cpp-bskill-card' + (have ? '' : ' is-locked') + (state === 'replaced' ? ' is-replaced' : '')}>
      <div className="cpp-bskill-card-head">
        <SkillIcon placed={placed} size={36} />
        <div className="cpp-bskill-card-title">
          <div className="cpp-bskill-card-name">{skill.buff.name}</div>
          <div className="cpp-bskill-card-room">{roomName}</div>
        </div>
      </div>
      {detail ? <BaseSkillEffect buff={skill.buff} detail={detail} variant="card" /> : null}
      <p className="cpp-bskill-desc">{text}</p>
      <div className="cpp-bskill-card-foot">
        {state === 'replaced' ? (
          <span className="cpp-bskill-lock is-have">{gt.pgettext('arknights base skill', '已升级')}</span>
        ) : have ? (
          <span className="cpp-bskill-lock is-have">{gt.pgettext('arknights base skill', '已解锁')}</span>
        ) : unlockSentence(skill) ? (
          <span className={'cpp-bskill-lock' + (state === 'planned' ? ' is-plan' : '')}>{unlockSentence(skill)}</span>
        ) : null}
        {owned ? null : (
          <span className="cpp-bskill-lock is-have">{gt.pgettext('arknights base skill', '未持有')}</span>
        )}
      </div>
    </div>
  )
})

const BaseSkillSectionBody = memo(({ character }: { character: ICharacter }) => {
  const ga = useGameAdapter<Arknights>() as ArknightsAdapter
  const c = character as Character
  const atoms = useAtoms<Arknights>()
  const current = useAtomValue(atoms.currentCharacter(c.key))
  // goalCharacter() 没有计划时给的是现在的练度，分不出有没有计划
  const goal = useAtomValue(atoms.goalCharacters)[c.key]
  const [loaded, retry] = useDetails(ga.getDataManager())
  const raw = ga.getDataManager().raw
  const rooms = { ...raw.exBuilding.rooms, ...raw.local?.exBuilding.rooms }

  const placed: Placed[][] = c.baseSkills.map((slot) =>
    slot.map((skill) => ({ skill, ...baseSkillState(ga, c, current, goal, skill.slot, skill.index) })),
  )

  return (
    <div className="cpp-bskill-dossier">
      <UnlockRail ga={ga} character={c} current={current} goal={goal} placed={placed} />
      <div className="cpp-bskill-slots">
        {placed.map((slot, i) => (
          <div key={i} className="cpp-bskill-slot">
            {slot.map((p, j) => (
              <React.Fragment key={p.skill.buff.id}>
                {j > 0 ? (
                  <div className={'cpp-bskill-upgrade' + (p.state === 'planned' ? ' is-plan' : '')}>
                    {gt
                      .pgettext('arknights base skill', '%s$cond后升级为') /* I10N: %s$cond: 精一, 精二 or 30 级 */
                      .replaceAll('%s$cond', unlockShort(p.skill))}
                  </div>
                ) : null}
                <SkillCard
                  placed={p}
                  roomName={baseRoomName(p.skill.buff.roomType, rooms[p.skill.buff.roomType]?.name).full}
                  loaded={loaded}
                />
              </React.Fragment>
            ))}
          </div>
        ))}
      </div>
      {loaded && 'error' in loaded ? (
        <div className="cpp-bskill-retry">
          <Button size="small" variant="outlined" onClick={retry}>
            {gt.pgettext('arknights base skill', '重试')}
          </Button>
        </div>
      ) : null}
    </div>
  )
})

export const baseSkillsSection: DossierSection = {
  id: 'baseSkills',
  title: lpstr(() => gt.pgettext('dossier section', '基建技能')),
  Body: BaseSkillSectionBody,
  isAvailable: (ga, c) => (ga as ArknightsAdapter).hasBaseSkills() && (c as Character).baseSkills.length > 0,
}
