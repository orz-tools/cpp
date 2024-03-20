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
}

export type Re1999CharacterTaskType =
  | { _: 'join' }
  | { _: 'insight'; insight: number }
  | { _: 'level'; insight: number; from: number; to: number }
  | { _: 'resonate'; to: number }

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
  Simulate = 99,
  Exp = 5,
  Equip = 6,
  TeachNote = 11,
  Season = 12,
  Break = 7,
  Newbie = 3,
  WeekWalk = 9,
  Dog = 116,
  SpecialEquip = 8,
  Gold = 4,
  Normal = 1,
  LeiMiTeBeiNew = 111,
  Sp = 10,
  Buildings = 13,
  Meilanni = 115,
  Hard = 2,
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
