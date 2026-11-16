import { IGame } from '../cpp-basic/types'
import { CppData_ArknightsKengxxiaoEnUs } from '../cpp-data-schemas/arknights-kengxxiao-en_US'
import { CppData_ArknightsKengxxiaoZhCn } from '../cpp-data-schemas/arknights-kengxxiao-zh_CN'
import { PSTR, gt, lpstr } from '../gt'
import type { ItemValueConfig } from './itemValue'

export const enum PreferenceKeys {
  SurveySource = 'surveySource',
  ItemValue = 'arknightsItemValue',
  ShowPotential = 'showPotential',
}

export const enum SurveySourceKey {
  None = 'none',
  Yituliu = 'yituliu',
  Heybox = 'heybox',
}

export const SurveySourceKeys = [SurveySourceKey.None, SurveySourceKey.Yituliu, SurveySourceKey.Heybox]

export interface Arknights extends IGame {
  characterStatus: ArknightsCharacterStatus
  characterTaskType: ArknightsCharacterTaskType
  preferences: {
    [PreferenceKeys.SurveySource]: SurveySourceKey
    [PreferenceKeys.ItemValue]: ItemValueConfig
    [PreferenceKeys.ShowPotential]: boolean
  }
}

export interface ArknightsCharacterStatus {
  elite: number
  level: number
  skillLevel: number
  skillMaster: Record<string, number>
  modLevel: Record<string, number>
  // 0-5, as the game's potentialRank; the UI shows it as 1-6. Data saved before it existed lacks the key.
  potentialRank?: number
}

export type ArknightsCharacterTaskType =
  | { _: 'join' }
  | { _: 'elite'; elite: number }
  | { _: 'level'; elite: number; from: number; to: number }
  | { _: 'skill'; to: number }
  | { _: 'skillMaster'; skillId: string; to: number }
  | { _: 'mod'; modId: string; to: number }

export const AK_ITEM_GOLD = '4001'
export const AK_ITEM_VIRTUAL_EXP = '##EXP'
export const AK_ITEM_UNKNOWN_SHIT = '#__UNKNOWN_SHIT'

// 产出固定、不看掉落统计的关卡，龙门币与采购凭证按游戏内的数值写死；apGold 表示另有理智 × 12 的龙门币
export const AK_FIXED_DROP_STAGES: readonly { stageId: string; drops: Record<string, number>; apGold?: boolean }[] = [
  { stageId: 'wk_melee_6', drops: { [AK_ITEM_GOLD]: 10000 } },
  { stageId: 'wk_melee_5', drops: { [AK_ITEM_GOLD]: 7500 } },
  { stageId: 'wk_melee_4', drops: { [AK_ITEM_GOLD]: 5700 } },
  { stageId: 'wk_melee_3', drops: { [AK_ITEM_GOLD]: 4100 } },
  { stageId: 'wk_melee_2', drops: { [AK_ITEM_GOLD]: 2800 } },
  { stageId: 'wk_melee_1', drops: { [AK_ITEM_GOLD]: 1700 } },
  { stageId: 'wk_toxic_5', drops: { '4006': 21 }, apGold: true },
]

export enum ArknightsFormulaTag {
  WorkshopRarity2 = 'workshop_rarity_2',
}

export const formulaTagNames = {
  [ArknightsFormulaTag.WorkshopRarity2]: lpstr(() => gt.pgettext('arknights option', '不从绿材料合成蓝材料')),
} satisfies Record<ArknightsFormulaTag, PSTR>

export const enum ArknightsRegion {
  zh_CN = 'zh_CN',
  en_US = 'en_US',
  ja_JP = 'ja_JP',
  ko_KR = 'ko_KR',
}

export type ArknightsKengxxiao = CppData_ArknightsKengxxiaoZhCn | CppData_ArknightsKengxxiaoEnUs

export const enum Profession {
  TOKEN = 'TOKEN',
  TRAP = 'TRAP',
  CASTER = 'CASTER',
  MEDIC = 'MEDIC',
  PIONEER = 'PIONEER',
  SNIPER = 'SNIPER',
  SPECIAL = 'SPECIAL',
  SUPPORT = 'SUPPORT',
  TANK = 'TANK',
  WARRIOR = 'WARRIOR',
}

export type DeployableProfession = Exclude<Profession, Profession.TOKEN | Profession.TRAP>

export const ProfessionNames: Record<DeployableProfession, PSTR> = {
  [Profession.PIONEER]: lpstr(() => gt.pgettext('arknights profession', '先锋')),
  [Profession.WARRIOR]: lpstr(() => gt.pgettext('arknights profession', '近卫')),
  [Profession.TANK]: lpstr(() => gt.pgettext('arknights profession', '重装')),
  [Profession.SNIPER]: lpstr(() => gt.pgettext('arknights profession', '狙击')),
  [Profession.CASTER]: lpstr(() => gt.pgettext('arknights profession', '术师')),
  [Profession.MEDIC]: lpstr(() => gt.pgettext('arknights profession', '医疗')),
  [Profession.SUPPORT]: lpstr(() => gt.pgettext('arknights profession', '辅助')),
  [Profession.SPECIAL]: lpstr(() => gt.pgettext('arknights profession', '特种')),
}
