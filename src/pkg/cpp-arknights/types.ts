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
