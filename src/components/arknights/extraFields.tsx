import { Classes } from '@blueprintjs/core'
import { useAtomValue } from 'jotai'
import React, { memo } from 'react'
import useEvent from 'react-use-event-hook'
import { useAtoms, useGameAdapter } from '../../Cpp'
import { Arknights, ArknightsAdapter, ArknightsCharacterStatus, Character } from '../../pkg/cpp-arknights'
import { BaseSkillState, baseSkillState, reached, unlockCost, unlockFrom } from '../../pkg/cpp-arknights/baseSkills'
import { getBuildingBuffDetail } from '../../pkg/cpp-arknights/details'
import { parseRichText } from '../../pkg/cpp-arknights/richText'
import { RankKind, TrainingCost, efficiencyPercent, showsMost } from '../../pkg/cpp-arknights/trainingCost'
import { FieldContext, Querier } from '../../pkg/cpp-basic'
import { gt } from '../../pkg/gt'
import { CharacterListColumn, createSimpleExtraField, percentageColumnWidth } from '../CharacterList'
import { networkAdvice } from '../Err'
import { CachedImg } from '../Icons'
import { useShowCharacterDossier } from '../dossierHooks'
import { useRequestFrame } from '../focusFrame'
import { PeekTrigger } from '../Peek'
import { ValueTag } from '../Value'
import { IGameComponent } from '../types'
import { BaseSkillEffect } from './BaseSkillEffect'
import { unlockShort } from './baseSkillText'
import { modulePeek, skillPeek, skillRefName } from './peekKinds'
import { RichText } from './statusEditor/Detail'
import { useDetails } from './useDetails'
import { MostText, RarityMaxList, fillNodes } from './voucherText'

const percentageFormatter = (value: number) => {
  return Number.isFinite(value) ? `${(value * 100).toFixed(2)}%` : '???'
}

const percentageStyle: React.CSSProperties = {
  fontFamily: 'monospace',
  textAlign: 'right',
}

/** 「已投入」在这名干员现在的练度上的值；null 表示没持有 */
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

const pct = (ratio: number) => `${(Math.min(1, Math.max(0, ratio)) * 100).toFixed(2)}%`

// 条按这一行星级的同星级最多画，不按整列最大的：道具分星级，不同星级的条本来就不放在一起比
function createVoucherField(kind: RankKind, Tip: React.ComponentType) {
  return {
    width: 170,
    Tip,
    // 同 createCostField，读 store 里现在的练度
    C: memo(({ context, width }: { context: FieldContext<Arknights, Character, any[]>; width: number }) => {
      const ga = useGameAdapter<Arknights>() as ArknightsAdapter
      const current = useAtomValue(useAtoms<Arknights>().currentCharacter(context.character.key))
      const v = ga.getTrainingCost().voucher(kind, context.character, current, context.args[0])
      if (!v) {
        return (
          <CharacterListColumn width={width} className="cpp-cost-cell">
            <span className="cpp-cost-none">—</span>
          </CharacterListColumn>
        )
      }
      // 特殊干员、专精不花材料的技能：省下的是 0，而不是算不出来
      const value = v.now.items.size === 0 ? 0 : v.now.value
      const detail = Number.isFinite(v.efficiency)
      const most = detail && showsMost(v)
      return (
        <CharacterListColumn width={width} className="cpp-cost-cell">
          <div className="cpp-voucher-cell">
            <div className="cpp-voucher-line">
              <span className="cpp-cost-bar cpp-voucher-bar">
                {detail ? <span style={{ width: pct(v.now.value / v.rarityMax) }} /> : null}
                {most ? (
                  <span
                    className="cpp-voucher-used"
                    style={{ width: pct((v.most.value - v.now.value) / v.rarityMax) }}
                  />
                ) : null}
              </span>
              <ValueTag value={value} minimal />
            </div>
            {detail ? (
              // 效率放在最右，有没有「最多」都在同一个位置，一列往下读不跳
              <div className="cpp-voucher-caption">
                {most ? (
                  <>
                    <span className="cpp-voucher-most">
                      <MostText value={v.most.value} />
                    </span>
                    <span>·</span>
                  </>
                ) : null}
                <span className="cpp-voucher-efficiency">
                  {fillNodes(gt.pgettext('training cost', '效率 %s') /* I10N: %s: a percentage like 54% */, {
                    '%s': <b>{efficiencyPercent(v.efficiency)}%</b>,
                  })}
                </span>
              </div>
            ) : null}
          </div>
        </CharacterListColumn>
      )
    }),
  }
}

const Elite2Tip = memo(() => (
  <>
    <div>
      {gt.pgettext(
        'training cost',
        '现在用特训邀请函能省多少：从现在的练度到精二 1 级的材料价值。已经练过的那一段省不回来，所以练得越多，数越小。',
      )}
    </div>
    <div>{gt.pgettext('training cost', '最多：从精零 1 级用时能省的；条上浅蓝的那段是已经练掉的。')}</div>
    <div>
      {fillNodes(
        gt.pgettext(
          'training cost',
          '效率：现在能省的，占同星级最多能省的几成；条的全长就是同星级最多（%s）。',
        ) /* I10N: %s: a list like 4★ 2022, 5★ 3765, 6★ 5735 */,
        { '%s': <RarityMaxList kind="elite2" /> },
      )}
    </div>
  </>
))

const Mastery3Tip = memo(() => (
  <>
    <div>
      {gt.pgettext(
        'training cost',
        '现在用技巧集能省多少：这个技能从现在的专精到专三的材料价值。已经专精过的那几级省不回来。',
      )}
    </div>
    <div>{gt.pgettext('training cost', '最多：从专零用时能省的；条上浅蓝的那段是已经练掉的。')}</div>
    <div>
      {fillNodes(
        gt.pgettext(
          'training cost',
          '效率：现在能省的，占同星级所有技能里最多能省的几成；条的全长就是同星级最多（%s）。',
        ) /* I10N: %s: a list like 4★ 1472, 5★ 2909, 6★ 4272 */,
        { '%s': <RarityMaxList kind="mastery3" /> },
      )}
    </div>
  </>
))

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
  const showDossier = useShowCharacterDossier()
  const frame = useRequestFrame()
  // 档案「基建技能」页按技能位排着每一条，比卡片能放的多：打开到那一页，框出这一条
  const onClick = useEvent(() => {
    if (!skill) return
    showDossier(context.character.key, { section: 'baseSkills' })
    frame(`baseSkill:${context.character.key}:${skill.buff.id}`)
  })
  if (!skill) return <CharacterListColumn width={width} />
  const { buff } = skill

  let text: React.ReactNode
  let title = buff.name
  if (!loaded) {
    text = <Skeleton />
  } else if ('error' in loaded) {
    const missing = gt.pgettext('arknights base skill', '原文没有加载出来')
    text = <span className="cpp-bskill-missing">{missing}</span>
    // No room in the cell; a click opens the 基建技能 page, which says it with a 重试.
    title = [buff.name, missing, networkAdvice()].join('\n')
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
    <CharacterListColumn
      width={width}
      className="cpp-bskill-cell"
      onClick={onClick}
      aria-label={gt
        .pgettext('arknights base skill', '在档案里看 %s') /* I10N: %s: base skill name */
        .replaceAll('%s', buff.name)}
    >
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
  'building.unlockCost': { width: 76, C: UnlockCostCell, align: 'right' },
  skill: {
    width: 150,
    C: memo(({ context, width }: { context: FieldContext<Arknights, Character, [number]>; width: number }) => {
      const charSkill = context.character.skills[context.args[0]]
      const skillName = charSkill.skill.name

      return (
        <PeekTrigger
          peek={skillPeek(context.character.key, charSkill.skillId)}
          renderTarget={(peek) => (
            <CharacterListColumn width={width} {...peek}>
              <span className="bp6-menu-item-icon">
                <CachedImg
                  src={charSkill.skill.icon}
                  width={'100%'}
                  height={'100%'}
                  alt={skillName}
                  title={skillName}
                />
              </span>
              <div className="bp6-fill" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div className="bp6-text-overflow-ellipsis" title={skillName}>
                  {skillName}
                </div>
                <div className="bp6-text-overflow-ellipsis" style={{ fontWeight: 'normal', opacity: 0.25 }}>
                  {skillRefName(charSkill.charSkillIndex)}
                </div>
              </div>
            </CharacterListColumn>
          )}
        />
      )
    }),
  },
  mod: {
    width: 150,
    C: memo(({ context, width }: { context: FieldContext<Arknights, Character, [number]>; width: number }) => {
      const { equip, equipId } = context.character.uniEquips[context.args[0]]
      return (
        <PeekTrigger
          peek={modulePeek(context.character.key, equipId)}
          renderTarget={(peek) => (
            <CharacterListColumn width={width} {...peek}>
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
          )}
        />
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
  'cost.elite2': createVoucherField('elite2', Elite2Tip),
  'cost.invested': createCostField('cost.invested', (tc, c, current) => tc.invested(c, current)?.value ?? null),
  'skill.cost.mastery3': createVoucherField('mastery3', Mastery3Tip),
}
