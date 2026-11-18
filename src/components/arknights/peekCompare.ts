import type { ArknightsCharacterStatus } from '../../pkg/cpp-arknights/types'
import type { IStageInfo } from '../../pkg/cpp-basic'
import type { StageEfficiency } from '../../pkg/cpp-arknights/stageEfficiency'
import type { SkillAt } from './statusEditor/Detail'

/**
 * 技能卡对比哪两级：这名干员的目标改了这个技能时是「当前 → 目标」；没改时是「当前 → 满级」，满级不在计划内，所以是 'max'。
 * 当前已经是满级时只有一列（to 为 null）
 */
export function skillCompare(
  current: ArknightsCharacterStatus,
  /** goalCharacters[charId]：没有计划时是 undefined */
  goal: ArknightsCharacterStatus | undefined,
  skillId: string,
  /** hasMasteries(character) */
  masteries: boolean,
  /** maxSkillLevel(character)：一直是精零的干员到 4 级为止 */
  maxLevel: number,
): { from: SkillAt; to: SkillAt | null; target: 'goal' | 'max' } {
  const from: SkillAt = { skillLevel: current.skillLevel, mastery: current.skillMaster[skillId] || 0 }
  if (goal) {
    const to: SkillAt = { skillLevel: goal.skillLevel, mastery: goal.skillMaster[skillId] || 0 }
    if (to.skillLevel !== from.skillLevel || to.mastery !== from.mastery) return { from, to, target: 'goal' }
  }
  const top: SkillAt = { skillLevel: maxLevel, mastery: masteries ? 3 : 0 }
  const atTop = from.skillLevel >= top.skillLevel && from.mastery >= top.mastery
  return { from, to: atTop ? null : top, target: 'max' }
}

/** 模组卡：目标提高了这个模组时，from 到 to 之间的几级是计划内 */
export function modCompare(
  current: ArknightsCharacterStatus,
  goal: ArknightsCharacterStatus | undefined,
  equipId: string,
): { from: number; to: number; planned: boolean } {
  const from = current.modLevel[equipId] || 0
  const to = goal?.modLevel[equipId] ?? from
  return { from, to, planned: to > from }
}

/**
 * 关卡卡的掉落表，一行一个 dropInfo 的物品。每次的数量是 drops ÷ samples；样本数不是有限数的是手写掉落，数量就是
 * drops，标成固定、排最后。物品价值算出来时按每次的价值从高到低排，和关卡面板一样；没算出来时按数量排
 */
export function stageDropRows(
  stage: Pick<IStageInfo, 'dropInfo'>,
  efficiency: Pick<StageEfficiency, 'drops'> | undefined,
  valuesOk: boolean,
): { itemId: string; quantity: number; fixed: boolean }[] {
  const values = valuesOk && efficiency ? new Map(efficiency.drops.map((x) => [x.itemId, x.value])) : null
  const rows = Object.entries(stage.dropInfo).map(([itemId, [drops, samples]]) => {
    const fixed = !Number.isFinite(samples)
    return { itemId, quantity: fixed ? drops : drops / samples, fixed }
  })
  const rank = (row: (typeof rows)[number]) => (values ? (values.get(row.itemId) ?? 0) : row.quantity)
  return rows.sort((a, b) => Number(a.fixed) - Number(b.fixed) || rank(b) - rank(a))
}
