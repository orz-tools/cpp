import { IGame } from '../cpp-basic/types'

export interface Arknights extends IGame {
  characterStatus: ArknightsCharacterStatus
  characterTaskType: ArknightsCharacterTaskType
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
  [ArknightsFormulaTag.WorkshopRarity2]: '不从绿材料合成蓝材料',
} satisfies Record<ArknightsFormulaTag, string>
