import { IGame } from '../cpp-basic/types'
import { CppData_Reverse1999EnigmaticnebulaEn } from '../cpp-data-schemas/reverse1999-enigmaticnebula-en'
import { CppData_Reverse1999EnigmaticnebulaJp } from '../cpp-data-schemas/reverse1999-enigmaticnebula-jp'
import { CppData_Reverse1999EnigmaticnebulaKr } from '../cpp-data-schemas/reverse1999-enigmaticnebula-kr'
import { CppData_Reverse1999EnigmaticnebulaTw } from '../cpp-data-schemas/reverse1999-enigmaticnebula-tw'
import { CppData_Reverse1999EnigmaticnebulaZh } from '../cpp-data-schemas/reverse1999-enigmaticnebula-zh'
import { CppData_Reverse1999Yuanyan3060ZhCn } from '../cpp-data-schemas/reverse1999-yuanyan3060-zh_CN'

export interface Re1999 extends IGame {
  characterStatus: Re1999CharacterStatus
  characterTaskType: Re1999CharacterTaskType
}

export interface Re1999CharacterStatus {
  insight: number
  level: number
  resonate: number
  styles?: number[]
}

export type Re1999CharacterTaskType =
  | { _: 'join' }
  | { _: 'insight'; insight: number }
  | { _: 'level'; insight: number; from: number; to: number }
  | { _: 'resonate'; to: number }
  | { _: 'style'; styleId: number }

export const enum ExEpisodeType {
  Story = 4,
  Equip = 7,
  TeachNote = 10,
  Sp = 6,
  Season = 11,
  Explore = 14,
  Decrypt = 5,
  WeekWalk = 9,
  Dog = 102,
  SpecialEquip = 8,
  Adventure = 3,
  Boss = 2,
  Meilanni = 101,
  Normal = 1,
}

export const enum ExChapterType {
  Equip = 6,
  Normal = 1,
  Season123Retail = 24,
  RoleActivityFight = 27,
  Exp = 5,
  WeekWalk = 9,
  Break = 7,
  Activity1_2DungeonNormal1 = 121,
  Season = 15,
  SpecialEquip = 8,
  Activity1_2DungeonHard = 122,
  Cachot = 22,
  Gold = 4,
  YaXian = 126,
  BossRushNormal = 141,
  Act1_8Dungeon = 181,
  BossRushInfinite = 142,
  Season123Trial = 25,
  ToughBattle = 191,
  Sp = 10,
  Explore = 14,
  DreamTailNormal = 128,
  RoleActivityStory = 26,
  Activity1_2DungeonNormal2 = 123,
  Buildings = 13,
  Activity1_2DungeonNormal3 = 124,
  Hard = 2,
  Simple = 28,
  TeachNote = 11,
  SeasonSpecial = 17,
  Newbie = 3,
  Season123 = 23,
  RoleStoryChallenge = 21,
  Simulate = 99,
  DreamTailHard = 129,
  LeiMiTeBeiNew = 111,
  Dog = 116,
  PermanentActivity = 30,
  Act1_6Dungeon = 161,
  Meilanni = 115,
  SeasonRetail = 16,
  RoleStory = 19,
  Rouge = 29,
}

export const RE_ITEM_GOLD = '2#3'
export const RE_ITEM_EXP = '2#5'

export enum Re1999FormulaTag {}

export const formulaTagNames = {} satisfies Record<Re1999FormulaTag, string>

export const enum Re1999Region {
  China = 'china',
  GlobalEN = 'global-en',
  GlobalJP = 'global-jp',
  GlobalKR = 'global-kr',
  GlobalTW = 'global-tw',
  GlobalZH = 'global-zh',
}

export type Reverse1999EnigmaticNebula =
  | CppData_Reverse1999EnigmaticnebulaEn
  | CppData_Reverse1999EnigmaticnebulaJp
  | CppData_Reverse1999EnigmaticnebulaKr
  | CppData_Reverse1999EnigmaticnebulaTw
  | CppData_Reverse1999EnigmaticnebulaZh
export type Reverse1999Yuanyan3060 = CppData_Reverse1999Yuanyan3060ZhCn
