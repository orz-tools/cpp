import { Button, Checkbox, Classes, Tag } from '@blueprintjs/core'
import { useAtomValue } from 'jotai'
import { memo, useId } from 'react'
import { useAtoms, useGameAdapter } from '../../Cpp'
import { Arknights, ArknightsAdapter, Character } from '../../pkg/cpp-arknights'
import { hasMasteries, maxSkillLevel } from '../../pkg/cpp-arknights/statusEdit'
import { gt } from '../../pkg/gt'
import { CachedImg } from '../Icons'
import { PeekItemRow } from '../ItemPeek'
import { PeekHead } from '../Peek'
import { PeekKind, PeekRef } from '../peek'
import { useShowStageInPanel } from './StagePanel'
import { EfficiencyText } from './StageRows'
import { modCompare, skillCompare, stageDropRows } from './peekCompare'
import { formatCount, useStageModel, useStageToggle } from './stagePanelModel'
import { ModDetailContent, SkillDetailContent } from './statusEditor/Detail'

// 技能、模组的 id 带干员：通用技能几名干员共用一个 id，卡片又按这名干员的练度对比
export const skillPeek = (charId: string, skillId: string): PeekRef => ({ kind: 'skill', id: `${charId}/${skillId}` })
export const modulePeek = (charId: string, equipId: string): PeekRef => ({ kind: 'module', id: `${charId}/${equipId}` })
export const stagePeek = (stageId: string): PeekRef => ({ kind: 'stage', id: stageId })

function splitId(id: string) {
  const i = id.indexOf('/')
  return [id.slice(0, i), id.slice(i + 1)] as const
}

/** 一技能、二技能、三技能 */
export function skillRefName(charSkillIndex: number) {
  return [
    gt.pgettext('arknights skill ref', '一技能'),
    gt.pgettext('arknights skill ref', '二技能'),
    gt.pgettext('arknights skill ref', '三技能'),
  ][charSkillIndex]
}

function useArknights() {
  return useGameAdapter<Arknights>() as ArknightsAdapter
}

function skillOf(ga: ArknightsAdapter, id: string) {
  const [charId, skillId] = splitId(id)
  const character = ga.getCharacter(charId) as Character | undefined
  return { charId, skillId, character, charSkill: character?.skills.find((s) => s.skillId === skillId) }
}

function moduleOf(ga: ArknightsAdapter, id: string) {
  const [charId, equipId] = splitId(id)
  const character = ga.getCharacter(charId) as Character | undefined
  return { charId, equipId, character, uniEquip: character?.uniEquips.find((u) => u.equipId === equipId) }
}

/** 练度读 store 里现在的，计划读 goalCharacters：goalCharacter() 没有计划时给的是现在的练度 */
function useStatuses(charId: string) {
  const atoms = useAtoms<Arknights>()
  const current = useAtomValue(atoms.currentCharacter(charId))
  const goal = useAtomValue(atoms.goalCharacters)[charId]
  return { current, goal }
}

export const skillPeekKind: PeekKind = {
  Head: memo(({ id }: { id: string }) => {
    const { character, charSkill } = skillOf(useArknights(), id)
    const { skill, charSkillIndex } = charSkill!
    return (
      <PeekHead
        icon={<CachedImg src={skill.icon} width={28} height={28} alt="" />}
        title={skill.name}
        sub={`${character!.name} · ${skillRefName(charSkillIndex)}`}
      />
    )
  }),
  Body: memo(({ id }: { id: string }) => {
    const ga = useArknights()
    const { charId, skillId, character } = skillOf(ga, id)
    const { current, goal } = useStatuses(charId)
    const panelId = useId()
    const { from, to, target } = skillCompare(
      current,
      goal,
      skillId,
      hasMasteries(character!),
      maxSkillLevel(character!),
    )
    return (
      <SkillDetailContent
        dm={ga.getDataManager()}
        panelId={panelId}
        skillId={skillId}
        from={from}
        to={to}
        target={target}
      />
    )
  }),
  exists: (ga, id) => !!skillOf(ga as ArknightsAdapter, id).charSkill,
}

export const modulePeekKind: PeekKind = {
  Head: memo(({ id }: { id: string }) => {
    const { character, uniEquip } = moduleOf(useArknights(), id)
    const { equip } = uniEquip!
    return (
      <PeekHead
        icon={
          <span className="cpp-peek-mod-icon">
            <CachedImg src={equip.icon} width={22} height={22} alt="" />
          </span>
        }
        title={equip.name}
        sub={`${character!.name} · ${equip.raw.typeName1}-${equip.raw.typeName2}`}
      />
    )
  }),
  Body: memo(({ id }: { id: string }) => {
    const ga = useArknights()
    const { charId, equipId } = moduleOf(ga, id)
    const { current, goal } = useStatuses(charId)
    const panelId = useId()
    const { from, to, planned } = modCompare(current, goal, equipId)
    return (
      <ModDetailContent
        dm={ga.getDataManager()}
        panelId={panelId}
        equipId={equipId}
        potentialRank={current.potentialRank}
        from={from}
        to={to}
        planned={planned}
        dimAbove={planned}
      />
    )
  }),
  exists: (ga, id) => !!moduleOf(ga as ArknightsAdapter, id).uniEquip,
}

export const stagePeekKind: PeekKind = {
  Head: memo(({ id }: { id: string }) => {
    const stage = useArknights().getStageInfos()[id]
    return (
      <PeekHead
        icon={
          <Tag>
            <code style={{ fontSize: '110%' }}>{stage.code}</code>
          </Tag>
        }
        title={stage.name}
        sub={gt.pgettext('stage panel', '理智 %d').replaceAll('%d', String(stage.ap))}
      />
    )
  }),
  Body: memo(({ id, navigate }: { id: string; navigate: (ref: PeekRef) => void }) => {
    const ga = useArknights()
    const model = useStageModel()
    const { isChecked, onSetChecked } = useStageToggle()
    const show = useShowStageInPanel()
    const e = model.efficiencies.get(id)
    const checked = isChecked(id)
    return (
      <>
        <div className="cpp-peek-row">
          <Checkbox
            className="cpp-peek-check"
            checked={checked}
            label={gt.pgettext('peek card', '启用这一关')}
            onChange={() => onSetChecked([id], !checked)}
          />
          <span className="cpp-peek-label cpp-peek-push">{gt.pgettext('stage panel', '效率')}</span>
          <EfficiencyText value={model.valuesOk ? e?.efficiency : undefined} lowSample={e?.lowSample} />
        </div>
        <div className="cpp-peek-list">
          <div className="cpp-peek-list-head">
            <span>{gt.pgettext('peek card', '掉落')}</span>
            <span>{gt.pgettext('peek card', '每次')}</span>
          </div>
          {stageDropRows(model.stages[id], e, model.valuesOk).map((row) => {
            const item = ga.getItem(row.itemId)
            return item ? (
              <PeekItemRow key={row.itemId} item={item} navigate={navigate}>
                {row.fixed
                  ? gt.pgettext('peek card', '固定 %s').replaceAll('%s', String(row.quantity))
                  : row.quantity.toFixed(3)}
              </PeekItemRow>
            ) : null
          })}
        </div>
        {e?.samples !== undefined ? (
          <div className="cpp-peek-note">
            {gt
              .pgettext('peek card', '样本 %s 次') /* I10N: %s: number of runs the drop rates come from */
              .replaceAll('%s', formatCount(e.samples))}
          </div>
        ) : null}
        <div className="cpp-peek-foot">
          <Button
            variant="minimal"
            size="small"
            // 弹出的卡片跟着关上；钉住的卡片不在 Popover 里，这个类不起作用
            className={Classes.POPOVER_DISMISS}
            endIcon="arrow-right"
            text={gt.pgettext('peek card', '在「关卡」面板里看')}
            onClick={() => show(id)}
          />
        </div>
      </>
    )
  }),
  exists: (ga, id) => !!ga.getStageInfos()[id],
}
