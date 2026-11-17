import { gt } from '../gt'
import type { Character } from './DataManager'
import type { ArknightsUserDataAdapter } from './UserDataAdapter'
import type { BaseSkillEffect, Cond, Leaf } from './details'
import type { TrainingCost } from './trainingCost'
import type { ArknightsCharacterStatus } from './types'

/** 适配器上用到的那两个方法 */
export interface BaseSkillsSource {
  getUserDataAdapter(): ArknightsUserDataAdapter
  getTrainingCost(): Pick<TrainingCost, 'costBetween'>
}

export interface UnlockAt {
  elite: number
  level: number
}

/** 精英化阶段比条件高，或者阶段相同、等级不低于条件 */
export function reached(status: UnlockAt, at: UnlockAt): boolean {
  return status.elite > at.elite || (status.elite === at.elite && status.level >= at.level)
}

export type BaseSkillState = 'unlocked' | 'replaced' | 'planned' | 'locked' | 'absent'

/**
 * 没持有的干员什么都没到；没有计划时目标那边当作没到。没持有、目标到了的是 planned，owned 为假。
 * 同一技能位的下一条现在也到了，这一条就是 replaced。
 */
export function baseSkillState(
  ga: BaseSkillsSource,
  character: Character,
  current: ArknightsCharacterStatus,
  goal: ArknightsCharacterStatus | undefined,
  slot: number,
  index: number,
): { state: BaseSkillState; owned: boolean } {
  const owned = !ga.getUserDataAdapter().isAbsentCharacter(character, current)
  const skills = character.baseSkills[slot] ?? []
  const now = (i: number) => owned && !!skills[i] && reached(current, skills[i])
  if (now(index)) return { state: now(index + 1) ? 'replaced' : 'unlocked', owned }
  if (goal && skills[index] && reached(goal, skills[index])) return { state: 'planned', owned }
  return { state: owned ? 'locked' : 'absent', owned }
}

/** 花费的起点：持有时是现在的练度，没持有时是精零 1 级，和「养成成本」的「全部」一样 */
export function unlockFrom(
  ga: BaseSkillsSource,
  character: Character,
  current: ArknightsCharacterStatus,
): ArknightsCharacterStatus {
  if (!ga.getUserDataAdapter().isAbsentCharacter(character, current)) return current
  return { elite: 0, level: 1, skillLevel: 1, skillMaster: {}, modLevel: {}, potentialRank: current.potentialRank }
}

/** 从起点练到解锁那一级的材料价值；起点已经到了是 NaN，物品价值算不出来时也是 NaN */
export function unlockCost(
  ga: BaseSkillsSource,
  character: Character,
  current: ArknightsCharacterStatus,
  at: UnlockAt,
): number {
  const from = unlockFrom(ga, character, current)
  if (reached(from, at)) return NaN
  return ga.getTrainingCost().costBetween(character.key, from, { ...from, elite: at.elite, level: at.level }).value
}

/** 快捷过滤的房间按钮和列表里房间的次序 */
export const BASE_ROOMS: readonly string[] = [
  'MANUFACTURE',
  'TRADING',
  'POWER',
  'CONTROL',
  'DORMITORY',
  'MEETING',
  'WORKSHOP',
  'TRAINING',
  'HIRE',
  'RECYCLE',
]

/** 不认识的房间排在最后 */
export function roomOrder(roomType: string): number {
  const i = BASE_ROOMS.indexOf(roomType)
  return i < 0 ? BASE_ROOMS.length : i
}

// 宿舍的短名和全名在中文里是同一个词，所以两者各用一个 msgctxt
const roomNames: Record<string, () => { short: string; full: string }> = {
  MANUFACTURE: () => ({
    short: gt.pgettext('arknights base room short', '制造'),
    full: gt.pgettext('arknights base room', '制造站'),
  }),
  TRADING: () => ({
    short: gt.pgettext('arknights base room short', '贸易'),
    full: gt.pgettext('arknights base room', '贸易站'),
  }),
  POWER: () => ({
    short: gt.pgettext('arknights base room short', '发电'),
    full: gt.pgettext('arknights base room', '发电站'),
  }),
  CONTROL: () => ({
    short: gt.pgettext('arknights base room short', '中枢'),
    full: gt.pgettext('arknights base room', '控制中枢'),
  }),
  DORMITORY: () => ({
    short: gt.pgettext('arknights base room short', '宿舍'),
    full: gt.pgettext('arknights base room', '宿舍'),
  }),
  MEETING: () => ({
    short: gt.pgettext('arknights base room short', '会客'),
    full: gt.pgettext('arknights base room', '会客室'),
  }),
  WORKSHOP: () => ({
    short: gt.pgettext('arknights base room short', '加工'),
    full: gt.pgettext('arknights base room', '加工站'),
  }),
  TRAINING: () => ({
    short: gt.pgettext('arknights base room short', '训练'),
    full: gt.pgettext('arknights base room', '训练室'),
  }),
  HIRE: () => ({
    short: gt.pgettext('arknights base room short', '办公'),
    full: gt.pgettext('arknights base room', '人力办公室'),
  }),
  RECYCLE: () => ({
    short: gt.pgettext('arknights base room short', '回收'),
    full: gt.pgettext('arknights base room', '回收站'),
  }),
}

/** 界面语言的房间名；数据里新出的房间用数据里的名字，再没有就用 roomType */
export function baseRoomName(roomType: string, dataName?: string): { short: string; full: string } {
  if (Object.hasOwn(roomNames, roomType)) return roomNames[roomType]()
  const name = dataName || roomType
  return { short: name, full: name }
}

/** 各房间的主数，第一行只写数、不写名字；控制中枢没有 */
export const mainMetric: Readonly<Record<string, string>> = {
  MANUFACTURE: 'prod',
  TRADING: 'order',
  POWER: 'charge',
  MEETING: 'clue',
  HIRE: 'contact',
  TRAINING: 'train',
  WORKSHOP: 'byprod',
  RECYCLE: 'recycle',
  DORMITORY: 'recover',
}

export type LineItem = { leaf: Leaf } | { cond: Cond } | { ramp: true } | { when: Cond; leaves: Leaf[] }

export interface EffectLines {
  /** 第一行：不靠条件就有的数，或者整条都靠条件时条件下的那个数 */
  head: Leaf[]
  /** head 要满足条件才有，第一行用常规字重，第二行以「需…」开头 */
  conditional: boolean
  /** 第二行 */
  rest: LineItem[]
}

/** 名次越小越该上第一行；归零从不上第一行 */
function rank(e: BaseSkillEffect, roomType: string): number {
  const main = mainMetric[roomType]
  switch (e.k) {
    case 'flat':
      if (e.m === main) return 0
      // 控制中枢没有主数，加给全基建或某一间的算主数
      if (!main && e.to != null && typeof e.to === 'object') return 0
      return e.m === 'cost' ? 4 : 2
    case 'per':
      if (e.m === main) return 0
      return e.m === 'cost' ? 4 : 2
    case 'ramp':
      return e.m === main ? 0 : 2
    case 'if':
      return 1
    case 'note':
    case 'res':
    case 'conv':
      return 3
    case 'zero':
      return Infinity
  }
}

/**
 * 两行概括怎么分。第一行依次找：房间主数上的数、条件下的数、别的数、定性效果和资源、心情消耗，取最先找到的一类，
 * 最多两项，已经有一项时不再收按数量算的。第二行先写条件和「他人归零」（它决定第一行的数怎么读），其余照原文次序。
 */
export function effectLines(effects: BaseSkillEffect[], roomType: string): EffectLines {
  const best = Math.min(...effects.map((e) => rank(e, roomType)))
  const head: Leaf[] = []
  const rest: LineItem[] = []
  let conditional = false
  let cond: Cond | undefined
  const others: BaseSkillEffect[] = []

  for (const e of effects) {
    if (best === 1 && e.k === 'if' && !conditional) {
      const order = e.then.map((x, i) => [rank(x, roomType), i] as const).sort((a, b) => a[0] - b[0] || a[1] - b[1])
      const first = order[0]?.[1]
      if (first === undefined) continue
      head.push(e.then[first])
      conditional = true
      cond = e.when
      others.push(...e.then.filter((_, i) => i !== first))
      continue
    }
    if (e.k !== 'if' && rank(e, roomType) === best && head.length < 2 && !(head.length > 0 && e.k === 'per')) {
      head.push(e)
      continue
    }
    others.push(e)
  }

  if (cond) rest.push({ cond })
  for (const e of others) if (e.k === 'zero') rest.push({ leaf: e })
  if (head.some((x) => x.k === 'ramp')) rest.push({ ramp: true })
  for (const e of others) {
    if (e.k === 'zero') continue
    rest.push(e.k === 'if' ? { when: e.when, leaves: e.then } : { leaf: e })
  }
  return { head, conditional, rest }
}
