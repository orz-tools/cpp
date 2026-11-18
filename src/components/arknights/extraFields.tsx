import { Classes } from '@blueprintjs/core'
import { useAtomValue } from 'jotai'
import React, { memo } from 'react'
import { useAtoms, useGameAdapter } from '../../Cpp'
import { Arknights, ArknightsAdapter, ArknightsCharacterStatus, Character } from '../../pkg/cpp-arknights'
import { BaseSkillState, baseSkillState, reached, unlockCost, unlockFrom } from '../../pkg/cpp-arknights/baseSkills'
import { getBuildingBuffDetail } from '../../pkg/cpp-arknights/details'
import { parseRichText } from '../../pkg/cpp-arknights/richText'
import { TrainingCost } from '../../pkg/cpp-arknights/trainingCost'
import { FieldContext, Querier } from '../../pkg/cpp-basic'
import { gt } from '../../pkg/gt'
import { CharacterListColumn, createSimpleExtraField, percentageColumnWidth } from '../CharacterList'
import { CachedImg } from '../Icons'
import { ValueTag } from '../Value'
import { IGameComponent } from '../types'
import { BaseSkillEffect } from './BaseSkillEffect'
import { unlockShort } from './baseSkillText'
import { RichText } from './statusEditor/Detail'
import { useDetails } from './useDetails'

const percentageFormatter = (value: number) => {
  return Number.isFinite(value) ? `${(value * 100).toFixed(2)}%` : '???'
}

const percentageStyle: React.CSSProperties = {
  fontFamily: 'monospace',
  textAlign: 'right',
}

/** 一种成本在这名干员现在的练度上的值；null 表示没有可省的（已经到了那一级，或者 1–3 星） */
type CostReader = (
  tc: TrainingCost,
  character: Character,
  current: ArknightsCharacterStatus,
  args: readonly any[],
) => number | null

// 每次查询只算一遍；条的比例按查询那一刻的值定，之后改了练度、值变大了，条到头为止
const queryMax = new WeakMap<Querier<any, any>, Map<string, number>>()

function fieldMax(query: Querier<any, any>, field: string) {
  let byField = queryMax.get(query)
  if (!byField) queryMax.set(query, (byField = new Map()))
  const cached = byField.get(field)
  if (cached !== undefined) return cached
  let max = 0
  for (const item of query.result) {
    const v = query.getFieldValue(field, item)
    if (Number.isFinite(v) && v > max) max = v
  }
  byField.set(field, max)
  return max
}

function createCostField(field: string, read: CostReader) {
  return {
    width: 170,
    // 读 store 里现在的练度，而不是查询那一刻的：在行尾改了练度，格子马上跟着变
    C: memo(
      ({
        context,
        query,
        width,
      }: {
        query: Querier<Arknights, Character>
        context: FieldContext<Arknights, Character, any[]>
        width: number
      }) => {
        const ga = useGameAdapter<Arknights>() as ArknightsAdapter
        const current = useAtomValue(useAtoms<Arknights>().currentCharacter(context.character.key))
        const value = read(ga.getTrainingCost(), context.character, current, context.args)
        const max = fieldMax(query, field)
        const ratio = value !== null && Number.isFinite(value) && max > 0 ? Math.min(1, value / max) : 0
        return (
          <CharacterListColumn width={width} className="cpp-cost-cell">
            {value === null ? (
              <span className="cpp-cost-none">—</span>
            ) : (
              <>
                <span className="cpp-cost-bar">
                  <span style={{ width: `${(ratio * 100).toFixed(2)}%` }} />
                </span>
                <ValueTag value={value} minimal />
              </>
            )}
          </CharacterListColumn>
        )
      },
    ),
  }
}

type BaseSkillContext = FieldContext<Arknights, Character, [number, number]>

/**
 * The row's skill, read with the store's current level and plan rather than the query's: a goal changed at the end of
 * the row changes the cells at once. The plan comes from goalCharacters, since goalCharacter(key) falls back to the
 * current level when there is none.
 */
function useBaseSkillRow(context: BaseSkillContext) {
  const ga = useGameAdapter<Arknights>() as ArknightsAdapter
  const atoms = useAtoms<Arknights>()
  const key = context.character.key
  const current = useAtomValue(atoms.currentCharacter(key))
  const goal = useAtomValue(atoms.goalCharacters)[key]
  const [slot, index] = context.args
  const skill = context.character.baseSkills[slot]?.[index]
  const { state, owned } = baseSkillState(ga, context.character, current, goal, slot, index)
  return { ga, current, skill, state, owned }
}

const isHave = (state: BaseSkillState) => state === 'unlocked' || state === 'replaced'

/** Two gray bars where the text and the summary go, so the row keeps its height while the details download */
const Skeleton = () => (
  <span className="cpp-bskill-skeleton">
    <span className={Classes.SKELETON} />
    <span className={Classes.SKELETON} />
  </span>
)

const BaseSkillCell = memo(({ context, width }: { context: BaseSkillContext; width: number }) => {
  const { ga, skill, state, owned } = useBaseSkillRow(context)
  const [loaded] = useDetails(ga.getDataManager())
  if (!skill) return <CharacterListColumn width={width} />
  const { buff } = skill

  let text: React.ReactNode
  let title = buff.name
  if (!loaded) {
    text = <Skeleton />
  } else if ('error' in loaded) {
    text = <span className="cpp-bskill-missing">{gt.pgettext('arknights base skill', '原文没有加载出来')}</span>
  } else {
    const detail = getBuildingBuffDetail(loaded.details, buff.id)
    if (!detail) {
      text = <span className="cpp-bskill-missing">{gt.pgettext('arknights base skill', '没有这条技能的原文')}</span>
    } else {
      const segments = parseRichText(detail.text)
      text = <RichText segments={segments} details={loaded.details} />
      title = gt
        .pgettext('arknights base skill', '%s$name：%s$text') /* I10N: hover text of a base skill: its name and text */
        .replaceAll('%s$name', buff.name)
        .replaceAll('%s$text', segments.map((x) => (x.br ? '\n' : x.text)).join(''))
    }
  }

  return (
    <CharacterListColumn width={width} className="cpp-bskill-cell">
      <CachedImg src={buff.icon} width={28} height={28} className="cpp-bskill-icon" alt="" />
      <div className="cpp-bskill-text" title={title}>
        <span className="cpp-bskill-name">{buff.name}</span>
        {text}
      </div>
      <span className="cpp-bskill-state">
        <span className={'cpp-bskill-chip' + (isHave(state) ? ' is-have' : state === 'planned' ? ' is-plan' : '')}>
          {unlockShort(skill)}
        </span>
        {owned ? null : <span className="cpp-bskill-note">{gt.pgettext('arknights base skill', '未持有')}</span>}
      </span>
    </CharacterListColumn>
  )
})

const BaseSkillEffectCell = memo(({ context, width }: { context: BaseSkillContext; width: number }) => {
  const { ga, skill } = useBaseSkillRow(context)
  const [loaded] = useDetails(ga.getDataManager())
  const detail = loaded && 'details' in loaded && skill ? getBuildingBuffDetail(loaded.details, skill.buff.id) : null
  return (
    <CharacterListColumn width={width} className="cpp-bskill-effect-cell">
      {!skill ? null : !loaded ? (
        <Skeleton />
      ) : detail ? (
        <BaseSkillEffect buff={skill.buff} detail={detail} variant="cell" />
      ) : null}
    </CharacterListColumn>
  )
})

const UnlockCostCell = memo(({ context, width }: { context: BaseSkillContext; width: number }) => {
  const { ga, current, skill, state } = useBaseSkillRow(context)
  // Nothing to pay for a skill unlocked, or one an operator not owned has from elite 0 level 1
  const free = !skill || isHave(state) || reached(unlockFrom(ga, context.character, current), skill)
  return (
    <CharacterListColumn width={width} className="cpp-bskill-cost-cell">
      {free ? null : <ValueTag value={unlockCost(ga, context.character, current, skill)} minimal />}
    </CharacterListColumn>
  )
})

export const extraFields: IGameComponent['extraFields'] = {
  building: { width: 380, C: BaseSkillCell },
  'building.efficiency': { width: 170, C: BaseSkillEffectCell },
  'building.unlockCost': { width: 76, C: UnlockCostCell },
  skill: {
    width: 150,
    C: memo(({ context, width }: { context: FieldContext<Arknights, Character, [number]>; width: number }) => {
      const skillId = context.args[0]
      const charSkill = context.character.skills[skillId]
      const skillName = charSkill.skill.name
      const skillIndex = [
        gt.pgettext('arknights skill ref', '一技能'),
        gt.pgettext('arknights skill ref', '二技能'),
        gt.pgettext('arknights skill ref', '三技能'),
      ][charSkill.charSkillIndex]

      return (
        <CharacterListColumn width={width}>
          <span className="bp6-menu-item-icon">
            <CachedImg src={charSkill.skill.icon} width={'100%'} height={'100%'} alt={skillName} title={skillName} />
          </span>
          <div className="bp6-fill" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div className="bp6-text-overflow-ellipsis" title={skillName}>
              {skillName}
            </div>
            <div className="bp6-text-overflow-ellipsis" style={{ fontWeight: 'normal', opacity: 0.25 }}>
              {skillIndex}
            </div>
          </div>
        </CharacterListColumn>
      )
    }),
  },
  mod: {
    width: 150,
    C: memo(({ context, width }: { context: FieldContext<Arknights, Character, [number]>; width: number }) => {
      const { equip } = context.character.uniEquips[context.args[0]]
      return (
        <CharacterListColumn width={width}>
          <span className="bp6-menu-item-icon cpp-mod-icon">
            <CachedImg src={equip.icon} width={28} height={28} alt="" />
          </span>
          <div className="bp6-fill" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div className="bp6-text-overflow-ellipsis" title={equip.name}>
              {equip.name}
            </div>
            <div className="bp6-text-overflow-ellipsis" style={{ fontWeight: 'normal', opacity: 0.25 }}>
              {`${equip.raw.typeName1}-${equip.raw.typeName2}`}
            </div>
          </div>
        </CharacterListColumn>
      )
    }),
  },
  'skill.mastery3rate.yituliu': createSimpleExtraField(
    'skill.mastery3rate.yituliu',
    percentageColumnWidth,
    percentageFormatter,
    percentageStyle,
  ),
  'skill.mastery3rate.heybox': createSimpleExtraField(
    'skill.mastery3rate.heybox',
    percentageColumnWidth,
    percentageFormatter,
    percentageStyle,
  ),
  'elite2rate.yituliu': createSimpleExtraField(
    'elite2rate.yituliu',
    percentageColumnWidth,
    percentageFormatter,
    percentageStyle,
  ),
  'elite2rate.heybox': createSimpleExtraField(
    'elite2rate.heybox',
    percentageColumnWidth,
    percentageFormatter,
    percentageStyle,
  ),
  'elite2level90rate.heybox': createSimpleExtraField(
    'elite2level90rate.heybox',
    percentageColumnWidth,
    percentageFormatter,
    percentageStyle,
  ),
  'cost.elite2': createCostField('cost.elite2', (tc, c, current) => {
    const saving = tc.elite2Saving(c, current)
    if (!saving) return null
    return saving.items.size === 0 ? 0 : saving.value
  }),
  'cost.invested': createCostField('cost.invested', (tc, c, current) => tc.invested(c, current)?.value ?? null),
  'skill.cost.mastery3': createCostField('skill.cost.mastery3', (tc, c, current, [index]) => {
    const saving = tc.mastery3Saving(c, current, index)
    if (!saving) return null
    return saving.items.size === 0 ? 0 : saving.value
  }),
}
