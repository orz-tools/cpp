import { useAtomValue } from 'jotai'
import { memo } from 'react'
import { useAtoms, useGameAdapter } from '../../Cpp'
import { Arknights, ArknightsAdapter, ArknightsCharacterStatus, Character } from '../../pkg/cpp-arknights'
import { TrainingCost } from '../../pkg/cpp-arknights/trainingCost'
import { FieldContext, Querier } from '../../pkg/cpp-basic'
import { gt } from '../../pkg/gt'
import { CharacterListColumn, createSimpleExtraField, percentageColumnWidth } from '../CharacterList'
import { CachedImg } from '../Icons'
import { ValueTag } from '../Value'
import { IGameComponent } from '../types'

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

export const extraFields: IGameComponent['extraFields'] = {
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
  'cost.elite2': createCostField('cost.elite2', (tc, c, current) => tc.elite2Saving(c, current)?.value ?? null),
  'cost.invested': createCostField('cost.invested', (tc, c, current) => tc.invested(c, current)?.value ?? null),
  'skill.cost.mastery3': createCostField('skill.cost.mastery3', (tc, c, current, [index]) => {
    const saving = tc.mastery3Saving(c, current, index)
    if (!saving) return null
    return saving.items.size === 0 ? 0 : saving.value
  }),
}
