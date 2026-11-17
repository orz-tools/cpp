import { DeployableProfession, ProfessionNames } from '../../pkg/cpp-arknights'
import { LineItem, UnlockAt, baseRoomName, effectLines, mainMetric } from '../../pkg/cpp-arknights/baseSkills'
import type { BaseSkillEffect, Cond, Leaf, Noun } from '../../pkg/cpp-arknights/details'
import { gt } from '../../pkg/gt'

// The data names its nouns and kinds; the sentences around them are written here, in the UI language. A kind the data
// has but this file does not know comes out as null, and the skill falls back to its text.

const percentMetrics = new Set(['prod', 'order', 'charge', 'clue', 'contact', 'train', 'byprod', 'recycle'])

const metricNames: Record<string, () => string> = {
  prod: () => gt.pgettext('arknights base skill metric', '生产力'),
  order: () => gt.pgettext('arknights base skill metric', '订单效率'),
  charge: () => gt.pgettext('arknights base skill metric', '充能'),
  clue: () => gt.pgettext('arknights base skill metric', '线索速度'),
  contact: () => gt.pgettext('arknights base skill metric', '联络速度'),
  train: () => gt.pgettext('arknights base skill metric', '训练速度'),
  byprod: () => gt.pgettext('arknights base skill metric', '副产品'),
  recycle: () => gt.pgettext('arknights base skill metric', '转化效率'),
  cap: () => gt.pgettext('arknights base skill metric', '容量'),
  olimit: () => gt.pgettext('arknights base skill metric', '订单上限'),
  cost: () => gt.pgettext('arknights base skill metric', '心情消耗'),
  recover: () => gt.pgettext('arknights base skill metric', '心情恢复'),
}

const words: Record<string, () => string> = {
  exp: () => gt.pgettext('arknights base skill word', '记录'),
  gold: () => gt.pgettext('arknights base skill word', '赤金'),
  originium: () => gt.pgettext('arknights base skill word', '源石'),
  chip: () => gt.pgettext('arknights base skill word', '芯片'),
  eliteMaterial: () => gt.pgettext('arknights base skill word', '精英材料'),
  skillSummary: () => gt.pgettext('arknights base skill word', '技巧概要'),
  buildingMaterial: () => gt.pgettext('arknights base skill word', '基建材料'),
  anyMaterial: () => gt.pgettext('arknights base skill word', '任意材料'),
  sameRoomOthers: () => gt.pgettext('arknights base skill word', '同站他人'),
  emptyOrder: () => gt.pgettext('arknights base skill word', '空订单位'),
  hireSlot: () => gt.pgettext('arknights base skill word', '招募位'),
  droneCap: () => gt.pgettext('arknights base skill word', '无人机上限'),
  'clue.penguin': () => gt.pgettext('arknights base skill word', '企鹅物流'),
  'clue.karlan': () => gt.pgettext('arknights base skill word', '喀兰贸易'),
  'clue.rhodes': () => gt.pgettext('arknights base skill word', '罗德岛制药'),
}

const targets: Record<string, () => string> = {
  self: () => gt.pgettext('arknights base skill word', '自身'),
  room: () => gt.pgettext('arknights base skill word', '全员'),
  one: () => gt.pgettext('arknights base skill word', '单人'),
  allDorms: () => gt.pgettext('arknights base skill word', '各宿舍'),
  elsewhere: () => gt.pgettext('arknights base skill word', '他处'),
}

const notes: Record<string, (what: string, v: string) => string> = {
  missingClue: () => gt.pgettext('arknights base skill effect', '易得缺的线索'),
  missingClueExchange: () => gt.pgettext('arknights base skill effect', '交流时易得缺的线索'),
  ownedClue: () => gt.pgettext('arknights base skill effect', '易得已有线索'),
  clueOf: (what) =>
    gt
      .pgettext('arknights base skill effect', '易得%s$what线索') /* I10N: %s$what: clue faction */
      .replaceAll('%s$what', what),
  goldOrderUp: () => gt.pgettext('arknights base skill effect', '高品质赤金单↑'),
  fixedOrder: (what) =>
    gt
      .pgettext('arknights base skill effect', '必得%s$what') /* I10N: %s$what: kind of order */
      .replaceAll('%s$what', what),
  goldPerOrder: (_, v) =>
    gt
      .pgettext('arknights base skill effect', '赤金单必交 %s$v 个') /* I10N: %s$v: gold per order */
      .replaceAll('%s$v', v),
  noMoodCost: () => gt.pgettext('arknights base skill effect', '自身不掉心情'),
  noMoodCostFor: (what) =>
    gt
      .pgettext('arknights base skill effect', '站内%s$what不掉心情') /* I10N: %s$what: faction, or nothing */
      .replaceAll('%s$what', what),
  byproductIs: (what) =>
    gt
      .pgettext('arknights base skill effect', '副产品必为%s$what') /* I10N: %s$what: material */
      .replaceAll('%s$what', what),
  lessGold: () => gt.pgettext('arknights base skill effect', '减龙门币消耗'),
}

/** At most two decimals, no trailing zeros */
function plain(v: number) {
  return String(Number(Math.abs(v).toFixed(2)))
}

/** + or − (U+2212) in front; % behind for the rooms' main numbers */
function signed(v: number, percent: boolean) {
  return (v < 0 ? '−' : '+') + plain(v) + (percent ? '%' : '')
}

export function nounText(noun: Noun): string | null {
  if ('ref' in noun) return noun.text
  if ('room' in noun) return baseRoomName(noun.room).full
  if ('word' in noun) {
    if (noun.word.startsWith('prof.')) {
      const profession = noun.word.slice('prof.'.length)
      return Object.hasOwn(ProfessionNames, profession)
        ? String(ProfessionNames[profession as DeployableProfession])
        : null
    }
    return Object.hasOwn(words, noun.word) ? words[noun.word]() : null
  }
  return null
}

function nounsText(nouns: readonly Noun[]): string | null {
  const texts = nouns.map(nounText)
  return texts.some((x) => x === null) ? null : texts.join(gt.pgettext('list separator', '、'))
}

type Target = NonNullable<Extract<Leaf, { k: 'flat' }>['to']>

function targetText(to: Target): string | null {
  if (typeof to === 'string') return Object.hasOwn(targets, to) ? targets[to]() : null
  if ('all' in to) {
    return gt
      .pgettext('arknights base skill word', '所有%s$room') /* I10N: %s$room: room, e.g. 所有制造站 */
      .replaceAll('%s$room', baseRoomName(to.all).full)
  }
  if ('at' in to) return baseRoomName(to.at).full
  return null
}

/** The metric's name, or '' for the main number of the room the effect applies to */
function metricText(m: string, room: string): string | null {
  if (mainMetric[room] === m) return ''
  return Object.hasOwn(metricNames, m) ? metricNames[m]() : null
}

function joined(parts: (string | null)[]): string | null {
  if (parts.some((x) => x === null)) return null
  return parts.filter(Boolean).join(' ')
}

function subjectValue(subject: string, value: string) {
  if (!subject) return value
  return gt
    .pgettext(
      'arknights base skill effect',
      '%s$subject %s$value',
    ) /* I10N: %s$subject: e.g. 记录 or 容量; %s$value: e.g. +35% */
    .replaceAll('%s$subject', subject)
    .replaceAll('%s$value', value)
}

type Each = Extract<Leaf, { k: 'per' }>['each']

/** 「S.E.E.S.每人 +5%」「每个发电站 +15%」…: value is everything after the count */
function eachText(each: Each, value: string): string | null {
  const what = nounsText(each.what)
  if (what === null) return null
  const n = String(each.n)
  let template: string
  switch (each.unit) {
    case 'op':
      template = gt.pgettext(
        'arknights base skill effect',
        '%s$what每人 %s$value',
      ) /* I10N: %s$what: faction or room; %s$value: e.g. +5% */
      break
    case 'room':
      template = gt.pgettext(
        'arknights base skill effect',
        '每个%s$what %s$value',
      ) /* I10N: %s$what: room; %s$value: e.g. +15% */
      break
    case 'level':
      template = gt.pgettext(
        'arknights base skill effect',
        '%s$what每级 %s$value',
      ) /* I10N: %s$what: room; %s$value: e.g. +5% */
      break
    case 'point':
      template =
        each.n === 1
          ? gt.pgettext(
              'arknights base skill effect',
              '每点%s$what %s$value',
            ) /* I10N: %s$what: resource; %s$value: e.g. +1% */
          : gt.pgettext(
              'arknights base skill effect',
              '每 %d$n 点%s$what %s$value',
            ) /* I10N: %d$n: points; %s$what: resource; %s$value: e.g. +1% */
      break
    case 'line':
      template =
        each.n === 1
          ? gt.pgettext(
              'arknights base skill effect',
              '每条%s$what %s$value',
            ) /* I10N: %s$what: e.g. 赤金生产线; %s$value: e.g. +5% */
          : gt.pgettext(
              'arknights base skill effect',
              '每 %d$n 条%s$what %s$value',
            ) /* I10N: %d$n: lines; %s$what: e.g. 赤金生产线; %s$value: e.g. +15% */
      break
    case 'slot':
      template = gt.pgettext(
        'arknights base skill effect',
        '%s$what每个 %s$value',
      ) /* I10N: %s$what: e.g. 空订单位; %s$value: e.g. +4% */
      break
    default:
      return null
  }
  return template.replaceAll('%d$n', n).replaceAll('%s$what', what).replaceAll('%s$value', value)
}

function capText(text: string, max: string) {
  return gt
    .pgettext(
      'arknights base skill effect',
      '%s$text（≤%s$max）',
    ) /* I10N: %s$text: an effect; %s$max: its cap, e.g. 4 or 40% */
    .replaceAll('%s$text', text)
    .replaceAll('%s$max', max)
}

export function leafText(leaf: Leaf, roomType: string): string | null {
  switch (leaf.k) {
    case 'flat': {
      // A number for other rooms leaves out their main metric too: 「所有制造站 +2%」「各宿舍 +0.05」
      const room =
        leaf.to === 'allDorms'
          ? 'DORMITORY'
          : leaf.to && typeof leaf.to === 'object'
            ? 'all' in leaf.to
              ? leaf.to.all
              : leaf.to.at
            : roomType
      const subject = joined([
        leaf.to ? targetText(leaf.to) : '',
        leaf.of ? nounsText(leaf.of) : '',
        metricText(leaf.m, room),
      ])
      return subject === null ? null : subjectValue(subject, signed(leaf.v, percentMetrics.has(leaf.m)))
    }
    case 'ramp': {
      const pct = percentMetrics.has(leaf.m)
      const from = leaf.v0 === 0 ? '0' : signed(leaf.v0, pct)
      // 「+20%→25%」, but 「0→+20%」
      const to = leaf.v0 === 0 ? signed(leaf.v1, pct) : plain(leaf.v1) + (pct ? '%' : '')
      const value = gt
        .pgettext(
          'arknights base skill effect',
          '%s$from→%s$to',
        ) /* I10N: a number that grows with time, e.g. +20%→25% */
        .replaceAll('%s$from', from)
        .replaceAll('%s$to', to)
      const subject = metricText(leaf.m, roomType)
      return subject === null ? null : subjectValue(subject, value)
    }
    case 'per': {
      const value = joined([
        leaf.of ? nounsText(leaf.of) : '',
        metricText(leaf.m, roomType),
        signed(leaf.v, percentMetrics.has(leaf.m)),
      ])
      const text = value === null ? null : eachText(leaf.each, value)
      if (text === null) return null
      if (leaf.maxCount != null) return capText(text, String(leaf.maxCount))
      if (leaf.maxValue != null) return capText(text, plain(leaf.maxValue) + (percentMetrics.has(leaf.m) ? '%' : ''))
      return text
    }
    case 'zero':
      return gt.pgettext('arknights base skill effect', '他人归零')
    case 'res': {
      const what = nounText(leaf.what)
      if (what === null) return null
      const value = signed(leaf.v, false)
      if (!leaf.each) {
        return gt
          .pgettext('arknights base skill effect', '%s$what %s$value') /* I10N: %s$what: resource; %s$value: e.g. +15 */
          .replaceAll('%s$what', what)
          .replaceAll('%s$value', value)
      }
      return eachText(
        leaf.each,
        gt
          .pgettext(
            'arknights base skill effect',
            '%s$value %s$what',
          ) /* I10N: after a count, e.g. 宿舍每人 +1 感知信息; %s$value: e.g. +1; %s$what: resource */
          .replaceAll('%s$value', value)
          .replaceAll('%s$what', what),
      )
    }
    case 'conv': {
      const from = nounText(leaf.from)
      const to = nounText(leaf.to)
      if (from === null || to === null) return null
      return gt
        .pgettext('arknights base skill effect', '%d$fromN %s$from→%d$toN %s$to') /* I10N: e.g. 5 人间烟火→1 巫术结晶 */
        .replaceAll('%d$fromN', plain(leaf.fromN))
        .replaceAll('%s$from', from)
        .replaceAll('%d$toN', plain(leaf.toN))
        .replaceAll('%s$to', to)
    }
    case 'note': {
      if (!Object.hasOwn(notes, leaf.note)) return null
      const what = leaf.what ? nounsText(leaf.what) : ''
      return what === null ? null : notes[leaf.note](what, leaf.v == null ? '' : plain(leaf.v))
    }
  }
  return null
}

export function condText(cond: Cond): string | null {
  switch (cond.c) {
    case 'with': {
      const who = nounsText(cond.who)
      if (who === null) return null
      return (
        cond.group
          ? gt.pgettext(
              'arknights base skill effect',
              '与%s$who同组',
            ) /* I10N: working together in the control center or the reception room */
          : gt.pgettext('arknights base skill effect', '与%s$who同站')
      ) /* I10N: in the same factory or trading post */
        .replaceAll('%s$who', who)
    }
    case 'at': {
      let who = nounsText(cond.who)
      if (who === null) return null
      if (cond.min != null) {
        who = gt
          .pgettext(
            'arknights base skill effect',
            '至少 %d$n 名%s$who',
          ) /* I10N: %d$n: a count; %s$who: e.g. 作业平台 */
          .replaceAll('%d$n', String(cond.min))
          .replaceAll('%s$who', who)
      }
      if (cond.where === 'base') {
        return gt.pgettext('arknights base skill effect', '%s$who在基建').replaceAll('%s$who', who)
      }
      if (cond.where === 'work') {
        return gt.pgettext('arknights base skill effect', '%s$who在工作场所').replaceAll('%s$who', who)
      }
      if (cond.where === 'here') {
        return gt.pgettext('arknights base skill effect', '同站有%s$who').replaceAll('%s$who', who)
      }
      const room = typeof cond.where === 'object' ? nounText(cond.where) : null
      if (room === null) return null
      return gt
        .pgettext('arknights base skill effect', '%s$who在%s$room') /* I10N: %s$who: operator; %s$room: room */
        .replaceAll('%s$who', who)
        .replaceAll('%s$room', room)
    }
    case 'mastery':
      return gt
        .pgettext('arknights base skill effect', '专精至 %d$level 级') /* I10N: training a skill to this mastery */
        .replaceAll('%d$level', String(cond.level))
    case 'trainee': {
      const who = nounsText(cond.who)
      if (who === null) return null
      return gt
        .pgettext('arknights base skill effect', '对%s$who') /* I10N: the trainee, or the one recovering, is … */
        .replaceAll('%s$who', who)
    }
    case 'alone':
      return gt.pgettext('arknights base skill effect', '独自工作')
    case 'mood':
      return (
        cond.op === '>'
          ? gt.pgettext('arknights base skill effect', '心情>%s$v')
          : gt.pgettext('arknights base skill effect', '心情<%s$v')
      ).replaceAll('%s$v', plain(cond.v))
    case 'moodGap':
      return gt.pgettext('arknights base skill effect', '心情落差>%s$v').replaceAll('%s$v', plain(cond.v))
    case 'hours':
      return gt
        .pgettext('arknights base skill effect', '连续 %d$hours 小时') /* I10N: working this long in one go */
        .replaceAll('%d$hours', String(cond.v))
    case 'dormOthers':
      return gt.pgettext('arknights base skill effect', '宿舍有他人')
    case 'recipeMood':
      return (
        cond.orMore
          ? gt.pgettext(
              'arknights base skill effect',
              '配方心情消耗 ≥%s$v',
            ) /* I10N: workshop recipes that cost this much mood or more */
          : gt.pgettext('arknights base skill effect', '配方心情消耗为 %s$v')
      ) /* I10N: workshop recipes that cost this much mood */
        .replaceAll('%s$v', plain(cond.v))
  }
  return null
}

function lineItemText(item: LineItem, roomType: string): string | null {
  if ('leaf' in item) return leafText(item.leaf, roomType)
  if ('ramp' in item) return gt.pgettext('arknights base skill effect', '随工作时长增加')
  if ('when' in item) return joined([condText(item.when), ...item.leaves.map((x) => leafText(x, roomType))])
  const cond = condText(item.cond)
  if (cond === null) return null
  return gt
    .pgettext('arknights base skill effect', '需%s$cond') /* I10N: the first line holds only when this holds */
    .replaceAll('%s$cond', cond)
}

/** The two lines of the summary, or null when a kind in the data has no words here yet */
export function effectTexts(
  effects: BaseSkillEffect[],
  roomType: string,
): { head: string; conditional: boolean; rest: string } | null {
  const lines = effectLines(effects, roomType)
  const head = lines.head.map((x) => leafText(x, roomType))
  const rest = lines.rest.map((x) => lineItemText(x, roomType))
  if (head.some((x) => x === null) || rest.some((x) => x === null)) return null
  return { head: head.join(' '), conditional: lines.conditional, rest: rest.join(' · ') }
}

/** The unlock condition in a few characters: 精零, 精一, 精二, or 「30 级」 for a level within elite 0 */
export function unlockShort(at: UnlockAt): string {
  if (at.elite === 0 && at.level > 1) {
    return gt
      .pgettext('arknights base skill', '%d$level 级') /* I10N: unlocks at this level, within elite 0 */
      .replaceAll('%d$level', String(at.level))
  }
  return [
    gt.pgettext('arknights base skill', '精零'),
    gt.pgettext('arknights base skill', '精一'),
    gt.pgettext('arknights base skill', '精二'),
  ][at.elite]
}

/** The game's own words for the unlock: 「精英阶段2解锁」「等级30解锁」 */
export function unlockSentence(at: UnlockAt): string {
  if (at.elite === 0) {
    return gt
      .pgettext('arknights base skill', '等级%d$level解锁') /* I10N: as the game says it */
      .replaceAll('%d$level', String(at.level))
  }
  if (at.level > 1) {
    return gt
      .pgettext('arknights base skill', '精英阶段%d$elite等级%d$level解锁') /* I10N: as the game says it */
      .replaceAll('%d$elite', String(at.elite))
      .replaceAll('%d$level', String(at.level))
  }
  return gt
    .pgettext('arknights base skill', '精英阶段%d$elite解锁') /* I10N: as the game says it */
    .replaceAll('%d$elite', String(at.elite))
}

/** For a skill without a summary: the game's own number when it gives one, and a pointer to the text */
export function fallbackTexts(efficiency: number): { head: string; rest: string } {
  if (efficiency > 0) {
    return { head: signed(efficiency, true), rest: gt.pgettext('arknights base skill effect', '其余看原文') }
  }
  return { head: '', rest: gt.pgettext('arknights base skill effect', '看原文') }
}
