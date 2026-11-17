import { Button, Classes, Icon, Tooltip } from '@blueprintjs/core'
import React, { memo } from 'react'
import {
  Details,
  getEquipDetail,
  getSkillDetail,
  getTermDetail,
  pickCandidate,
  skillLevelIndex,
} from '../../../pkg/cpp-arknights/details'
import type {
  EquipPartDetail,
  SkillDetail as SkillData,
  SkillLevelDetail as SkillLevel,
} from '../../../pkg/cpp-arknights/details'
import {
  RichSegment,
  formatValue,
  mergeLevelTexts,
  parseRichText,
  resolvePlaceholders,
} from '../../../pkg/cpp-arknights/richText'
import { gt } from '../../../pkg/gt'
import { useDetails } from '../useDetails'
import { useEditor } from './context'
import { skillLevelText } from './text'

/** The (i) after a skill or module name: opens its panel under the row, closing any other one. */
export const DetailToggle = memo(({ id, panelId, name }: { id: string; panelId: string; name: string }) => {
  const { openDetail, toggleDetail } = useEditor()
  const open = openDetail === id
  return (
    <button
      type="button"
      className={'cpp-charstat-info' + (open ? ' cpp-charstat-info-open' : '')}
      aria-expanded={open}
      aria-controls={open ? panelId : undefined}
      aria-label={gt
        .pgettext('arknights status editor', '%s 的说明') /* I10N: %s: skill or module name */
        .replaceAll('%s', name)}
      onClick={() => toggleDetail(id)}
    >
      <Icon icon="info-sign" size={14} />
    </button>
  )
})

/** Loading, failed, or missing the entry: the panel says so; otherwise it renders what it is given. */
const DetailPanel = memo(
  ({
    id,
    missing,
    children,
  }: {
    id: string
    missing: string
    children: (details: Details) => React.ReactNode | null
  }) => {
    const [loaded, retry] = useDetails(useEditor().dm)
    let body: React.ReactNode
    if (!loaded) {
      body = (
        <>
          <div className={'cpp-charstat-det-skeleton ' + Classes.SKELETON} />
          <div className={'cpp-charstat-det-skeleton ' + Classes.SKELETON} />
        </>
      )
    } else if ('error' in loaded) {
      body = (
        <div className="cpp-charstat-det-error">
          {gt.pgettext('arknights status editor', '说明载入失败')}
          <Button size="small" variant="outlined" onClick={retry}>
            {gt.pgettext('arknights status editor', '重试')}
          </Button>
        </div>
      )
    } else {
      body = children(loaded.details) ?? <div className="cpp-charstat-det-missing">{missing}</div>
    }
    return (
      <div className="cpp-charstat-det" id={id} aria-busy={!loaded}>
        {body}
      </div>
    )
  },
)

const TermTip = memo(({ name, desc }: { name: string; desc: string }) => (
  <div className="cpp-charstat-term-tip">
    <b>{name}</b>
    <div>
      <RichText segments={parseRichText(desc)} details={null} />
    </div>
  </div>
))

/** A description with its markup: blue for raised values and keywords, red for lowered ones, gray for remarks. */
export const RichText = memo(({ segments, details }: { segments: RichSegment[]; details: Details | null }) => (
  <>
    {segments.map((s, i) => {
      if (s.br) return <br key={i} />
      let node: React.ReactNode =
        s.to === undefined ? (
          s.text
        ) : (
          <>
            <span className="cpp-charstat-rt-from">{s.text} →</span> <b className="cpp-charstat-rt-to">{s.to}</b>
          </>
        )
      if (s.style) node = <span className={`cpp-charstat-rt-${s.style}`}>{node}</span>
      const term = s.term && details ? getTermDetail(details, s.term) : null
      if (term) {
        node = (
          <Tooltip
            content={<TermTip name={term.name} desc={term.desc} />}
            placement="top"
            hoverOpenDelay={150}
            className="cpp-charstat-term-wrap"
          >
            <span className="cpp-charstat-term" tabIndex={0}>
              {node}
            </span>
          </Tooltip>
        )
      }
      return <React.Fragment key={i}>{node}</React.Fragment>
    })}
  </>
))

const spTypes: Record<string, () => string> = {
  INCREASE_WITH_TIME: () => gt.pgettext('arknights skill sp', '自动回复'),
  INCREASE_WHEN_ATTACK: () => gt.pgettext('arknights skill sp', '攻击回复'),
  INCREASE_WHEN_TAKEN_DAMAGE: () => gt.pgettext('arknights skill sp', '受击回复'),
}

const skillTypes: Record<string, () => string> = {
  MANUAL: () => gt.pgettext('arknights skill trigger', '手动触发'),
  AUTO: () => gt.pgettext('arknights skill trigger', '自动触发'),
  PASSIVE: () => gt.pgettext('arknights skill trigger', '被动'),
}

interface SkillAt {
  skillLevel: number
  mastery: number
}

function skillLevelOf(skill: SkillData, at: SkillAt) {
  // A skill without masteries stops at level 7.
  const level = skill.levels[Math.min(skillLevelIndex(at.skillLevel, at.mastery), skill.levels.length - 1)]
  return { level, template: skill.texts[level.text] ?? '' }
}

function durationText(d: number) {
  if (d < 0) return gt.pgettext('arknights status editor', '无限')
  return gt
    .pgettext('arknights status editor', '%s 秒') /* I10N: %s: seconds */
    .replaceAll('%s', formatValue(d, undefined))
}

/** Skill: SP and trigger, the numbers that change, then the description, at the current level and, in a goal, the target. */
export const SkillDetail = memo(({ panelId, skillId }: { panelId: string; skillId: string }) => {
  const { status, current } = useEditor()
  const base = current ?? status
  const from: SkillAt = { skillLevel: base.skillLevel, mastery: base.skillMaster[skillId] || 0 }
  const to: SkillAt | null = current
    ? { skillLevel: status.skillLevel, mastery: status.skillMaster[skillId] || 0 }
    : null
  const changed = !!to && (to.skillLevel !== from.skillLevel || to.mastery !== from.mastery)

  return (
    <DetailPanel id={panelId} missing={gt.pgettext('arknights status editor', '这个技能还没有说明数据')}>
      {(details) => {
        const skill = getSkillDetail(details, skillId)
        if (!skill || !skill.levels.length) return null
        const a = skillLevelOf(skill, from)
        const b = changed ? skillLevelOf(skill, to!) : null
        const meta = [spTypes[skill.spType]?.(), skillTypes[skill.skillType]?.()].filter(Boolean)
        // A passive skill has no SP, and many skills no duration: rows that are 0 throughout are left out.
        const rows = [
          {
            label: gt.pgettext('arknights status editor', '技力消耗'),
            pick: (x: SkillLevel) => x.spCost,
            text: String,
          },
          {
            label: gt.pgettext('arknights status editor', '初始技力'),
            pick: (x: SkillLevel) => x.initSp,
            text: String,
          },
          {
            label: gt.pgettext('arknights status editor', '持续时间'),
            pick: (x: SkillLevel) => x.duration,
            text: durationText,
          },
        ]
          .filter((r) => r.pick(a.level) !== 0 || (b && r.pick(b.level) !== 0))
          .map((r) => ({ label: r.label, a: r.text(r.pick(a.level)), b: b ? r.text(r.pick(b.level)) : null }))
        return (
          <>
            {meta.length ? <div className="cpp-charstat-det-meta">{meta.join(' · ')}</div> : null}
            {rows.length ? (
              <table className="cpp-charstat-det-table">
                <thead>
                  <tr>
                    <th />
                    <th>
                      {b
                        ? gt
                            .pgettext('arknights status editor', '当前 %s') /* I10N: %s: skill level, e.g. 7 级 */
                            .replaceAll('%s', skillLevelText(from.skillLevel, from.mastery))
                        : skillLevelText(from.skillLevel, from.mastery)}
                    </th>
                    {b ? (
                      <>
                        <th />
                        <th className="cpp-charstat-det-to">
                          {gt
                            .pgettext('arknights status editor', '目标 %s') /* I10N: %s: skill level, e.g. 专精 3 */
                            .replaceAll('%s', skillLevelText(to!.skillLevel, to!.mastery))}
                        </th>
                      </>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.label}>
                      <th>{r.label}</th>
                      <td>{r.a}</td>
                      {r.b !== null ? (
                        <>
                          <td className="cpp-charstat-det-arrow">{r.a === r.b ? '' : '→'}</td>
                          <td className={r.a === r.b ? '' : 'cpp-charstat-det-to'}>{r.b}</td>
                        </>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
            {!b || a.template === b.template ? (
              <p>
                <RichText segments={parseRichText(a.template, a.level.bb, b?.level.bb)} details={details} />
              </p>
            ) : (
              <>
                <p>
                  <span className="cpp-charstat-det-tag">{gt.pgettext('arknights status editor', '当前')}</span>
                  <RichText segments={parseRichText(a.template, a.level.bb)} details={details} />
                </p>
                <p>
                  <span className="cpp-charstat-det-tag cpp-charstat-det-to">
                    {gt.pgettext('arknights status editor', '目标')}
                  </span>
                  <RichText segments={parseRichText(b.template, b.level.bb)} details={details} />
                </p>
              </>
            )}
          </>
        )
      }}
    </DetailPanel>
  )
})

const attributeNames: Record<string, () => string> = {
  max_hp: () => gt.pgettext('arknights attribute', '生命'),
  atk: () => gt.pgettext('arknights attribute', '攻击'),
  def: () => gt.pgettext('arknights attribute', '防御'),
  magic_resistance: () => gt.pgettext('arknights attribute', '法术抗性'),
  attack_speed: () => gt.pgettext('arknights attribute', '攻击速度'),
  cost: () => gt.pgettext('arknights attribute', '部署费用'),
  respawn_time: () => gt.pgettext('arknights attribute', '再部署时间'),
  block_cnt: () => gt.pgettext('arknights attribute', '阻挡数'),
  base_attack_time: () => gt.pgettext('arknights attribute', '攻击间隔'),
}

type PartKind = 'trait' | 'talent'

function partKind(part: EquipPartDetail): PartKind | null {
  if (part.target.startsWith('TRAIT') || part.target === 'DISPLAY') return 'trait'
  if (part.target.startsWith('TALENT')) return 'talent'
  return null
}

function partText(part: EquipPartDetail, kind: PartKind, potentialRank: number | undefined) {
  if (kind === 'trait') {
    const c = pickCandidate(part.trait, potentialRank)
    const text = c?.over || c?.add
    return c && text ? resolvePlaceholders(text, c.bb) : null
  }
  const c = pickCandidate(part.talent, potentialRank)
  const text = c?.upgrade || c?.desc
  return c && text ? resolvePlaceholders(text, c.bb) : null
}

interface PartGroup {
  kind: PartKind
  isToken: boolean
  entries: { level: number; text: string }[]
}

/** Each trait or talent across the module's levels; one with the same texts as another is a duplicate. */
function partGroups(phases: { parts: EquipPartDetail[] }[], potentialRank: number | undefined) {
  const groups = new Map<string, PartGroup>()
  phases.forEach((phase, i) => {
    const ordinals = new Map<string, number>()
    for (const part of phase.parts) {
      const kind = partKind(part)
      if (!kind) continue
      const base = `${kind}:${part.isToken}`
      const n = ordinals.get(base) ?? 0
      ordinals.set(base, n + 1)
      const text = partText(part, kind, potentialRank)
      if (!text) continue
      const key = `${base}:${n}`
      if (!groups.has(key)) groups.set(key, { kind, isToken: part.isToken, entries: [] })
      groups.get(key)!.entries.push({ level: i + 1, text })
    }
  })
  const seen = new Set<string>()
  return [...groups.values()].filter((g) => {
    const sig = JSON.stringify([g.kind, g.isToken, g.entries])
    if (seen.has(sig)) return false
    seen.add(sig)
    return true
  })
}

function levelText(level: number) {
  return gt
    .pgettext('arknights status editor', '%d 级') /* I10N: %d: skill or module level */
    .replaceAll('%d', `${level}`)
}

/** e.g. 70%（3 级 60%） */
function levelChangesText(first: string, changes: string[]) {
  // I10N: %1: the value at the first level; %2: later levels where it changes, e.g. 3 级 60%
  const text = gt.pgettext('arknights status editor', '%1（%2）')
  return text.replaceAll('%1', first).replaceAll('%2', changes.join(gt.pgettext('arknights status editor', '，')))
}

/** Module: the attribute bonuses of levels 1–3, then its trait and talent, from the level each starts at. */
export const ModDetail = memo(({ panelId, equipId }: { panelId: string; equipId: string }) => {
  const { status, current } = useEditor()
  const base = current ?? status
  const from = base.modLevel[equipId] || 0
  const to = current ? status.modLevel[equipId] || 0 : from
  const potentialRank = base.potentialRank

  return (
    <DetailPanel id={panelId} missing={gt.pgettext('arknights status editor', '这个模组还没有说明数据')}>
      {(details) => {
        const equip = getEquipDetail(details, equipId)
        if (!equip || !equip.phases.length) return null
        const keys: string[] = []
        for (const phase of equip.phases) for (const [k] of phase.attr) if (!keys.includes(k)) keys.push(k)
        const column = (level: number) =>
          current && level > from && level <= to ? 'cpp-charstat-det-to' : level > to ? 'cpp-charstat-det-dim' : ''
        const groups = partGroups(equip.phases, potentialRank)
        return (
          <>
            {keys.length ? (
              <table className="cpp-charstat-det-table cpp-charstat-det-attr">
                <thead>
                  <tr>
                    <th />
                    {equip.phases.map((_, i) => (
                      <th key={i} className={column(i + 1)}>
                        {levelText(i + 1)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {keys.map((k) => (
                    <tr key={k}>
                      <th>{attributeNames[k]?.() ?? k}</th>
                      {equip.phases.map((phase, i) => {
                        const v = phase.attr.find(([key]) => key === k)?.[1]
                        return (
                          <td key={i} className={column(i + 1)}>
                            {v === undefined ? '' : (v > 0 ? '+' : '') + formatValue(v, undefined)}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
            {groups.map((g, gi) => {
              const tag = [
                g.kind === 'trait'
                  ? gt.pgettext('arknights status editor', '特性')
                  : gt.pgettext('arknights status editor', '天赋'),
                g.isToken ? gt.pgettext('arknights status editor', '召唤物') : null,
                g.entries[0].level > 1
                  ? gt
                      .pgettext('arknights status editor', '%d 级起') /* I10N: %d: module level */
                      .replaceAll('%d', `${g.entries[0].level}`)
                  : null,
              ]
                .filter(Boolean)
                .join(' · ')
              const merged = mergeLevelTexts(
                g.entries,
                (level, value) => `${levelText(level)} ${value}`,
                levelChangesText,
              )
              return (
                <div key={gi} className="cpp-charstat-det-part">
                  <span className="cpp-charstat-det-tag">{tag}</span>
                  {merged.merged ? (
                    <p>
                      <RichText segments={parseRichText(merged.text)} details={details} />
                    </p>
                  ) : (
                    merged.texts.map((x) => (
                      <p key={x.level}>
                        <span className="cpp-charstat-det-level">{levelText(x.level)}</span>
                        <RichText segments={parseRichText(x.text)} details={details} />
                      </p>
                    ))
                  )}
                </div>
              )
            })}
          </>
        )
      }}
    </DetailPanel>
  )
})
