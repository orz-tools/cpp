import React, { memo, useId } from 'react'
import { Character } from '../../../pkg/cpp-arknights'
import {
  hasMasteries,
  raisesPrerequisite,
  sectionCollapsed,
  setMastery,
  setSkillLevel,
  skillChanges,
  skillLevelSteps,
} from '../../../pkg/cpp-arknights/statusEdit'
import { toTierShares } from '../../../pkg/cpp-arknights/survey'
import { gt } from '../../../pkg/gt'
import { CachedImg } from '../../Icons'
import { ProfessionIcon } from '../Icons'
import { DetailToggle, SkillDetail } from './Detail'
import { MasteryGlyph } from './MasteryGlyph'
import { Delta, Section } from './SectionHeader'
import { StepGroup } from './StepGroup'
import { SurveyStat, statTooltip } from './SurveyStat'
import { useEditor } from './context'
import { changesText, prerequisiteText, skillLevelText, skillNumberText } from './text'

const MASTERIES = [0, 1, 2, 3]

function masteryName(mastery: number) {
  return mastery === 0 ? gt.pgettext('arknights status editor', '未专精') : skillLevelText(7, mastery)
}

function levelSummary(level: number) {
  return gt
    .pgettext('arknights status editor', '等级 %d') /* I10N: %d: skill level */
    .replaceAll('%d', `${level}`)
}

/** 技能: skill level 1–7 (1, 4, 7 for a special operator) first, then each skill's masteries with their statistics, and its (i). */
export const SkillSection = memo(() => {
  const { character, status, current, setStatus, survey } = useEditor()
  const titleId = useId()
  const levelId = useId()
  if (!character.skills.length) return null

  const masteries = hasMasteries(character)
  let summary: React.ReactNode = levelSummary(status.skillLevel)
  if (current) {
    const changes = skillChanges(character, current, status)
    if (changes.length > 1) {
      summary = changesText(changes.length)
    } else if (changes.length === 1) {
      const c = changes[0]
      if (c.kind === 'skillLevel') {
        summary = <Delta from={levelSummary(c.from)} to={`${c.to}`} />
      } else {
        const skill = character.skills.find((x) => x.skillId === c.skillId)!
        summary = <Delta from={`${skillNumberText(skill.charSkillIndex)} ${c.from}`} to={`${c.to}`} />
      }
    }
  }
  const levels = skillLevelSteps(character)

  return (
    <Section
      id={titleId}
      title={gt.pgettext('arknights status group', '技能')}
      summary={summary}
      collapsed={current ? sectionCollapsed('skill', character, current) : false}
    >
      {survey && masteries ? (
        <div className="cpp-charstat-legend">
          {gt.pgettext('arknights status editor', '精二干员中练到这一档的占比')}
        </div>
      ) : null}
      <div className="cpp-charstat-row">
        <div className="cpp-charstat-lbl cpp-charstat-lbl-muted" id={levelId}>
          {gt.pgettext('arknights status editor', '技能等级')}
        </div>
        <StepGroup
          slim={levels.length > 4}
          labelledBy={levelId}
          values={levels}
          value={status.skillLevel}
          current={current?.skillLevel}
          label={(v) => levelSummary(v)}
          prerequisite={(v) => {
            const p = raisesPrerequisite(status, character, { kind: 'skillLevel', level: v })
            return p ? { p, text: prerequisiteText(p, false) } : null
          }}
          onPick={(v) => setStatus((x) => setSkillLevel(x, v))}
        />
      </div>
      {masteries ? character.skills.map((s) => <SkillRow key={s.skillId} charSkill={s} />) : null}
    </Section>
  )
})

const SkillRow = memo(({ charSkill }: { charSkill: Character['skills'][number] }) => {
  const { character, status, current, setStatus, survey, surveyName, openDetail } = useEditor()
  const nameId = useId()
  const panelId = useId()
  const { skillId, skill } = charSkill
  const detailKey = `skill:${skillId}`
  const value = status.skillMaster[skillId] || 0
  const currentValue = current ? current.skillMaster[skillId] || 0 : undefined
  const tiers = survey
    ? toTierShares(survey.skill(character, skill, charSkill.rawCharId, charSkill.charSkillIndex))
    : null

  return (
    <>
      <div className="cpp-charstat-row">
        <div className="cpp-charstat-lbl">
          {character.hasPatches ? (
            <ProfessionIcon profession={character.getPatchProfession(charSkill.rawCharId)} />
          ) : null}
          <CachedImg className="cpp-charstat-icon" src={skill.icon} width={20} height={20} alt="" />
          <span className="cpp-charstat-name" id={nameId} title={skill.name}>
            {skill.name}
          </span>
          <DetailToggle id={detailKey} panelId={panelId} name={skill.name} />
        </div>
        <div>
          <StepGroup
            labelledBy={nameId}
            values={MASTERIES}
            value={value}
            current={currentValue}
            render={(v) => <MasteryGlyph mastery={v} />}
            label={masteryName}
            prerequisite={(v) => {
              const p = raisesPrerequisite(status, character, { kind: 'mastery', skillId, mastery: v })
              return p ? { p, text: prerequisiteText(p, false) } : null
            }}
            onPick={(v) => setStatus((x) => setMastery(x, skillId, v))}
          />
          {tiers ? (
            <div className="cpp-charstat-stats">
              {MASTERIES.map((v) => (
                <SurveyStat
                  key={v}
                  share={tiers.shares[v]}
                  samples={tiers.samples}
                  target={currentValue !== undefined && value > currentValue && v === value}
                  tooltip={statTooltip(
                    `${skill.name} · ${masteryName(v)}`,
                    tiers.shares[v] ?? NaN,
                    tiers.samples,
                    tiers.base,
                    surveyName,
                  )}
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>
      {openDetail === detailKey ? <SkillDetail panelId={panelId} skillId={skillId} /> : null}
    </>
  )
})
