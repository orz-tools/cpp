/* oxlint-disable unicorn/no-thenable -- the data's if-effects carry a list called then */
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BaseSkillEffect, Cond, Leaf, Noun } from '../../pkg/cpp-arknights/details'
import { gt } from '../../pkg/gt'
import { condText, effectTexts, fallbackTexts, leafText, unlockSentence, unlockShort } from './baseSkillText'

// cpp-arknights 导入时会初始化 localforage，测试环境里没有存储后端
vi.mock('localforage', () => {
  const noop = new Proxy({}, { get: () => () => Promise.resolve(null) })
  return { default: { createInstance: () => noop, dropInstance: () => Promise.resolve() } }
})

const term = (id: string, text: string): Noun => ({ ref: `term:${id}`, text })
const char = (id: string, text: string): Noun => ({ ref: `char:${id}`, text })
const SEES = term('cc.tag.sees', 'S.E.E.S.')

const texts = (effects: BaseSkillEffect[], room: string) => effectTexts(effects, room)

describe('effectTexts in Chinese', () => {
  it('writes the room metric as a bare number, and names the others', () => {
    expect(
      texts(
        [
          { k: 'flat', m: 'prod', v: 25 },
          { k: 'flat', m: 'cap', v: -12 },
          { k: 'flat', m: 'cost', v: 0.25 },
        ],
        'MANUFACTURE',
      ),
    ).toEqual({ head: '+25%', conditional: false, rest: '容量 −12 · 心情消耗 +0.25' })
    expect(texts([{ k: 'flat', m: 'cap', v: 16 }], 'MANUFACTURE')!.head).toBe('容量 +16')
    expect(texts([{ k: 'flat', m: 'olimit', v: 3 }], 'TRADING')!.head).toBe('订单上限 +3')
    expect(texts([{ k: 'flat', m: 'cost', v: -0.25 }], 'POWER')!.head).toBe('心情消耗 −0.25')
  })

  it('puts the class a number is for in front', () => {
    type Flat = Extract<Leaf, { k: 'flat' }>
    const of = (word: string, m: Flat['m'], room: string) =>
      texts([{ k: 'flat', m, v: 35, of: [{ word: word as 'exp' }] }], room)!.head
    expect(of('exp', 'prod', 'MANUFACTURE')).toBe('记录 +35%')
    expect(of('originium', 'prod', 'MANUFACTURE')).toBe('源石 +35%')
    expect(of('eliteMaterial', 'byprod', 'WORKSHOP')).toBe('精英材料 +35%')
    expect(of('prof.WARRIOR', 'train', 'TRAINING')).toBe('近卫 +35%')
  })

  it('says who a dormitory number goes to, and which rooms the control center helps', () => {
    expect(
      texts(
        [
          { k: 'flat', m: 'recover', v: 0.55, to: 'self' },
          { k: 'flat', m: 'recover', v: 0.15, to: 'room' },
        ],
        'DORMITORY',
      )!.head,
    ).toBe('自身 +0.55 全员 +0.15')
    expect(texts([{ k: 'flat', m: 'recover', v: 0.7, to: 'one' }], 'DORMITORY')!.head).toBe('单人 +0.7')
    expect(texts([{ k: 'flat', m: 'prod', v: 2, to: { all: 'MANUFACTURE' } }], 'CONTROL')!.head).toBe('所有制造站 +2%')
    expect(texts([{ k: 'flat', m: 'clue', v: 25, to: { at: 'MEETING' } }], 'CONTROL')!.head).toBe('会客室 +25%')
    expect(texts([{ k: 'flat', m: 'recover', v: 0.05, to: 'allDorms' }], 'CONTROL')!.head).toBe('各宿舍 +0.05')
    expect(texts([{ k: 'flat', m: 'recover', v: 0.1, to: 'elsewhere' }], 'CONTROL')!.head).toBe('他处 心情恢复 +0.1')
  })

  it('writes a ramp both ways, and says it grows with time', () => {
    expect(texts([{ k: 'ramp', m: 'prod', v0: 20, v1: 25 }], 'MANUFACTURE')).toEqual({
      head: '+20%→25%',
      conditional: false,
      rest: '随工作时长增加',
    })
    expect(texts([{ k: 'ramp', m: 'prod', v0: 0, v1: 20 }], 'MANUFACTURE')!.head).toBe('0→+20%')
  })

  it('writes every count', () => {
    type Per = Extract<Leaf, { k: 'per' }>
    const per = (unit: Per['each']['unit'], n: number, what: Noun[], v = 15): Per => ({
      k: 'per',
      m: 'prod',
      v,
      each: { n, unit, what },
    })
    const one = (leaf: Leaf, room = 'MANUFACTURE') => leafText(leaf, room)
    expect(one(per('room', 1, [{ room: 'POWER' }]))).toBe('每个发电站 +15%')
    expect(one(per('point', 1, [term('cc.bd_A', '思维链环')], 1))).toBe('每点思维链环 +1%')
    expect(one(per('point', 2, [term('cc.bd_A', '思维链环')], 1))).toBe('每 2 点思维链环 +1%')
    expect(one({ ...per('op', 1, [SEES], 5), maxCount: 4 })).toBe('S.E.E.S.每人 +5%（≤4）')
    expect(one({ ...per('level', 1, [{ room: 'MEETING' }], 5), m: 'order', maxValue: 40 }, 'TRADING')).toBe(
      '会客室每级 +5%（≤40%）',
    )
    const line = term('cc.t.flow_gold', '赤金生产线')
    expect(one({ ...per('line', 2, [line]), m: 'order' }, 'TRADING')).toBe('每 2 条赤金生产线 +15%')
    expect(one({ ...per('line', 1, [line], 5), m: 'order' }, 'TRADING')).toBe('每条赤金生产线 +5%')
    expect(one({ ...per('slot', 1, [{ word: 'emptyOrder' }], 4), m: 'order' }, 'TRADING')).toBe('空订单位每个 +4%')
    expect(one({ ...per('room', 1, [{ room: 'TRADING' }], 20), of: [{ word: 'gold' }] })).toBe('每个贸易站 赤金 +20%')
  })

  it('takes the number under a condition, in regular weight, and writes the condition first on the second line', () => {
    const lappland: BaseSkillEffect = {
      k: 'if',
      when: { c: 'with', who: [char('char_140_whitew', '拉普兰德')], group: false },
      then: [
        { k: 'flat', m: 'cost', v: 0.3 },
        { k: 'flat', m: 'order', v: 65 },
      ],
    }
    expect(texts([lappland], 'TRADING')).toEqual({
      head: '+65%',
      conditional: true,
      rest: '需与拉普兰德同站 · 心情消耗 +0.3',
    })
  })

  it('writes a condition beside its numbers on the second line', () => {
    const exusiai: BaseSkillEffect = {
      k: 'if',
      when: { c: 'with', who: [term('cc.angel', '能天使')], group: false },
      then: [{ k: 'flat', m: 'order', v: 25 }],
    }
    expect(texts([{ k: 'flat', m: 'order', v: 20 }, exusiai], 'TRADING')!.rest).toBe('与能天使同站 +25%')
  })

  it('puts the zeroing first', () => {
    expect(
      texts(
        [
          { k: 'zero', m: 'prod' },
          { k: 'per', m: 'prod', v: 5, each: { n: 1, unit: 'room', what: [{ room: 'POWER' }] } },
          { k: 'flat', m: 'cap', v: 5 },
        ],
        'MANUFACTURE',
      ),
    ).toEqual({ head: '每个发电站 +5%', conditional: false, rest: '他人归零 · 容量 +5' })
  })

  it('writes resources, conversions and notes', () => {
    const info = term('cc.bd_a1', '感知信息')
    expect(
      leafText(
        { k: 'res', what: info, v: 1, each: { n: 1, unit: 'op', what: [{ room: 'DORMITORY' }] } },
        'MANUFACTURE',
      ),
    ).toBe('宿舍每人 +1 感知信息')
    expect(leafText({ k: 'res', what: term('cc.bd_b1', '人间烟火'), v: 15 }, 'CONTROL')).toBe('人间烟火 +15')
    expect(
      leafText(
        { k: 'conv', from: term('cc.bd_b1', '人间烟火'), fromN: 5, to: term('cc.bd_C', '巫术结晶'), toN: 1 },
        'MANUFACTURE',
      ),
    ).toBe('5 人间烟火→1 巫术结晶')
    expect(leafText({ k: 'note', note: 'goldOrderUp' }, 'TRADING')).toBe('高品质赤金单↑')
    expect(leafText({ k: 'note', note: 'missingClue' }, 'MEETING')).toBe('易得缺的线索')
    expect(
      leafText({ k: 'note', note: 'fixedOrder', what: [term('cc.tra.closure', '可露希尔特别订单')] }, 'TRADING'),
    ).toBe('必得可露希尔特别订单')
    expect(leafText({ k: 'note', note: 'clueOf', what: [{ word: 'clue.rhodes' }] }, 'MEETING')).toBe(
      '易得罗德岛制药线索',
    )
    expect(leafText({ k: 'note', note: 'goldPerOrder', v: 2 }, 'TRADING')).toBe('赤金单必交 2 个')
  })

  it('writes every condition', () => {
    const ulpianus = [char('char_4145_ulpia', '乌尔比安')]
    const cases: [Cond, string][] = [
      [{ c: 'with', who: [char('char_x', '提丰')], group: true }, '与提丰同组'],
      [{ c: 'at', who: ulpianus, where: 'base' }, '乌尔比安在基建'],
      [{ c: 'at', who: ulpianus, where: 'work' }, '乌尔比安在工作场所'],
      [{ c: 'at', who: [term('cc.g.glasgow', '格拉斯哥帮')], where: 'here' }, '同站有格拉斯哥帮'],
      [{ c: 'at', who: ulpianus, where: { room: 'CONTROL' } }, '乌尔比安在控制中枢'],
      [
        { c: 'at', who: [term('cc.tag.op', '作业平台')], where: { room: 'POWER' }, min: 2 },
        '至少 2 名作业平台在发电站',
      ],
      [{ c: 'mastery', level: 3 }, '专精至 3 级'],
      [{ c: 'trainee', who: [{ ref: 'branch:artsprotector', text: '驭法铁卫' }] }, '对驭法铁卫'],
      [{ c: 'alone' }, '独自工作'],
      [{ c: 'mood', op: '>', v: 12 }, '心情>12'],
      [{ c: 'mood', op: '<', v: 12 }, '心情<12'],
      [{ c: 'moodGap', v: 12 }, '心情落差>12'],
      [{ c: 'hours', v: 12 }, '连续 12 小时'],
      [{ c: 'dormOthers' }, '宿舍有他人'],
      [{ c: 'recipeMood', v: 4 }, '配方心情消耗为 4'],
      [{ c: 'recipeMood', v: 4, orMore: true }, '配方心情消耗 ≥4'],
    ]
    for (const [cond, text] of cases) expect(condText(cond)).toBe(text)
  })

  it('gives up on a kind or a word it does not know', () => {
    expect(texts([{ k: 'mystery' } as unknown as BaseSkillEffect], 'MANUFACTURE')).toBeNull()
    expect(texts([{ k: 'flat', m: 'prod', v: 5, of: [{ word: 'nope' as 'exp' }] }], 'MANUFACTURE')).toBeNull()
    const when = { c: 'moonPhase' } as unknown as Cond
    expect(texts([{ k: 'if', when, then: [{ k: 'flat', m: 'prod', v: 5 }] }], 'MANUFACTURE')).toBeNull()
  })
})

describe('fallbackTexts', () => {
  it("writes the game's number with a pointer to the rest", () => {
    expect(fallbackTexts(25)).toEqual({ head: '+25%', rest: '其余看原文' })
  })

  it('only points to the text when the game gives no number', () => {
    expect(fallbackTexts(0)).toEqual({ head: '', rest: '看原文' })
  })
})

describe('unlock conditions', () => {
  it('reads short in the list and as the game says in the cards', () => {
    expect(unlockShort({ elite: 2, level: 1 })).toBe('精二')
    expect(unlockShort({ elite: 0, level: 1 })).toBe('精零')
    expect(unlockShort({ elite: 0, level: 30 })).toBe('30 级')
    expect(unlockSentence({ elite: 2, level: 1 })).toBe('精英阶段2解锁')
    expect(unlockSentence({ elite: 0, level: 30 })).toBe('等级30解锁')
    expect(unlockSentence({ elite: 1, level: 30 })).toBe('精英阶段1等级30解锁')
  })
})

describe('effectTexts in English', () => {
  const previous = gt.locale
  afterEach(() => gt.setLocale(previous))

  const entry = (msgctxt: string, msgid: string, msgstr: string) => ({ [msgid]: { msgctxt, msgid, msgstr: [msgstr] } })

  it('follows the translated sentence order, with the names the data brings', () => {
    gt.addTranslations('en_US', 'messages', {
      charset: 'utf-8',
      headers: { 'Plural-Forms': 'nplurals=2; plural=(n != 1);' },
      translations: {
        'arknights base skill effect': {
          ...entry('arknights base skill effect', '%s$what每人 %s$value', '%s$value per %s$what'),
          ...entry('arknights base skill effect', '与%s$who同站', 'with %s$who in the station'),
          ...entry('arknights base skill effect', '需%s$cond', 'needs %s$cond'),
          ...entry('arknights base skill effect', '%s$text（≤%s$max）', '%s$text (max %s$max)'),
        },
        'arknights base skill metric': {
          ...entry('arknights base skill metric', '心情消耗', 'Morale cost'),
        },
      },
    })
    gt.setLocale('en_US')
    const per: Leaf = { k: 'per', m: 'prod', v: 5, each: { n: 1, unit: 'op', what: [SEES] }, maxCount: 4 }
    expect(leafText(per, 'MANUFACTURE')).toBe('+5% per S.E.E.S. (max 4)')
    const lappland: BaseSkillEffect = {
      k: 'if',
      when: { c: 'with', who: [char('char_140_whitew', 'Lappland')], group: false },
      then: [
        { k: 'flat', m: 'cost', v: 0.3 },
        { k: 'flat', m: 'order', v: 65 },
      ],
    }
    expect(texts([lappland], 'TRADING')).toEqual({
      head: '+65%',
      conditional: true,
      rest: 'needs with Lappland in the station · Morale cost +0.3',
    })
  })
})
