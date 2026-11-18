import { useAtomValue } from 'jotai'
import { memo, useId } from 'react'
import { useAtoms, useGameAdapter } from '../../Cpp'
import { Arknights, ArknightsAdapter, Character } from '../../pkg/cpp-arknights'
import { hasMasteries, maxSkillLevel } from '../../pkg/cpp-arknights/statusEdit'
import { gt } from '../../pkg/gt'
import { CachedImg } from '../Icons'
import { PeekHead } from '../Peek'
import { PeekKind, PeekRef } from '../peek'
import { modCompare, skillCompare } from './peekCompare'
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
