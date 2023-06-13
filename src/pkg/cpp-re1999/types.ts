import { IGame } from '../cpp-basic/types'

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

export interface ExCharacter {
  id: number
  name: string
  initials: string
  skinId: number
  career: number
  rare: number
  dmgType: number
  gender: number
  battleTag: string
  rank: number
  uniqueSkill_point: number
  ai: number
  firstItem: string
  duplicateItem: string
  duplicateItem2: string
  skill: string
  exSkill: number
  school: number
  characterTag: string
  nameEng: string
  signature: string
  photoFrameBg: number
  isOnline: string
  heroType: number
  actor: string
  roleBirthday: string
  trust: number
  birthdayBonus: string
  desc: string
  useDesc: string
  desc2: string
}

export interface ExItem {
  id: number
  name: string
  useDesc: string
  desc: string
  subType: number
  icon: string
  rare: number
  highQuality: number
  isStackable: number
  isShow: number
  isTimeShow: number
  effect: string
  cd: number
  expireTime: string
  price: string
  sources: string
  boxOpen: string
}

export interface ExCurrency {
  id: number
  name: string
  rare: number
  highQuality: number
  icon: string
  smallIcon: string
  useDesc: string
  desc: string
  recoverTime: number
  recoverNum: number
  recoverLimit: number
  dayRecoverNum: number
  maxLimit: number
  sources: string
}

export interface ExCharacterConsume {
  level: number
  rare: number
  cosume: string
}

export interface ExCharacterRank {
  heroId: number
  rank: number
  consume: string
  requirement: string
  effect: string
}

export interface ExCharacterTalent {
  heroId: number
  talentId: number
  talentMould: number
  exclusive: string
  requirement: number
  consume: string
}

export interface ExFormula {
  id: number
  type: number
  showType: number
  name: string
  costMaterial: string
  costScore: string
  costTime: number
  produce: string
  costReserve: number
  order: number
  needRoomLevel: number
  needProductionLevel: number
  needEpisodeId: number
  icon: string
  rare: number
  useDesc: string
  desc: string
}

export interface ExChapter {
  id: number
  name: string
  chapterIndex: string
  name_En: string
  year: string
  chapterpic: string
  type: number
  canReturn: number
  openDay: string
  openLevel: number
  rewardPoint: number
  preChapter: number
  elementList: string
  canPlayOpenMv: number
  canUseDouble: number
  canMakeTeam: number
  enterAfterFreeLimit: number
  challengeCountLimit: string
  saveHeroGroup: boolean
  navigationIcon: string
  rewindChapterBg: number
  ambientMusic: number
  isHeroRecommend: number
  actId: number
}

export interface ExEpisode {
  id: number
  chapterId: number
  type: number
  name: string
  name_En: string
  desc: string
  battleDesc: string
  beforeStory: number
  story: string
  afterStory: number
  autoSkipStory: number
  decryptId: number
  mapId: number
  pic: string
  icon: string
  preEpisode: number
  unlockEpisode: number
  elementList: string
  cost: string
  failCost: string
  recommendLevel: number
  firstBattleId: number
  battleId: number
  dayChangeBonus: string
  firstBonus: number
  bonus: number
  advancedBonus: number
  rewardDisplayList: string
  bgmevent: number
  navigationpic: number
  year: number
  canUseRecord: number
  time: string
  freeBonus: number
  freeDisplayList: string
  dayNum: number
  saveDayNum: number
}

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
