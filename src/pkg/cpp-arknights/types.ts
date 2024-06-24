import { IGame } from '../cpp-basic/types'
import { CppData_ArknightsKengxxiaoEnUs } from '../cpp-data-schemas/arknights-kengxxiao-en_US'
import { CppData_ArknightsKengxxiaoZhCn } from '../cpp-data-schemas/arknights-kengxxiao-zh_CN'
import { PSTR, gt, lpstr } from '../gt'

export const enum PreferenceKeys {
  SurveySource = 'surveySource',
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
  }
}

export interface ArknightsCharacterStatus {
  elite: number
  level: number
  skillLevel: number
  skillMaster: Record<string, number>
  modLevel: Record<string, number>
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
  CASTER = 'CASTER',
  MEDIC = 'MEDIC',
  PIONEER = 'PIONEER',
  SNIPER = 'SNIPER',
  SPECIAL = 'SPECIAL',
  SUPPORT = 'SUPPORT',
  TANK = 'TANK',
  WARRIOR = 'WARRIOR',
}
