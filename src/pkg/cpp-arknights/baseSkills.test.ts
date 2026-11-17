import { describe, expect, it, vi } from 'vitest'
import type { BaseSkill, Character } from './DataManager'
import { ArknightsUserDataAdapter } from './UserDataAdapter'
import {
  BASE_ROOMS,
  BaseSkillsSource,
  baseSkillState,
  effectLines,
  reached,
  roomOrder,
  unlockCost,
  unlockFrom,
} from './baseSkills'
import type { BaseSkillEffect, Cond, Leaf } from './details'
import type { ArknightsCharacterStatus } from './types'

vi.mock('localforage', () => ({
  default: {
    dropInstance: () => Promise.resolve(),
    createInstance: () => ({ removeItem: () => Promise.resolve() }),
  },
}))

const st = (elite: number, level: number, potentialRank = 0): ArknightsCharacterStatus => ({
  elite,
  level,
  skillLevel: 1,
  skillMaster: {},
  modLevel: {},
  potentialRank,
})
const absent = st(0, 0)

function fakeAdapter() {
  const calls: [string, ArknightsCharacterStatus, ArknightsCharacterStatus][] = []
  const ga: BaseSkillsSource = {
    getUserDataAdapter: () => new ArknightsUserDataAdapter(null as any),
    getTrainingCost: () => ({
      costBetween: (charId, from, to) => {
        calls.push([charId, from, to])
        return { value: 42, items: new Map(), unvalued: [] }
      },
    }),
  }
  return { ga, calls }
}

const skill = (slot: number, index: number, elite: number, level: number): BaseSkill => ({
  buff: {
    id: `buff_${slot}_${index}`,
    name: '',
    roomType: 'MANUFACTURE',
    skillIcon: '',
    efficiency: 0,
    sortId: 0,
    icon: '',
  },
  slot,
  index,
  elite,
  level,
})

// 赫默那样：一个技能位，精零 1 级一条，精二升级
const silence = {
  key: 'char_108_silent',
  baseSkills: [[skill(0, 0, 0, 1), skill(0, 1, 2, 1)]],
} as unknown as Character

describe('reached', () => {
  it('passes a higher elite phase whatever the level', () => {
    expect(reached(st(2, 1), { elite: 1, level: 80 })).toBe(true)
  })

  it('compares the level within the same phase', () => {
    expect(reached(st(0, 30), { elite: 0, level: 30 })).toBe(true)
    expect(reached(st(0, 25), { elite: 0, level: 30 })).toBe(false)
  })
})

describe('baseSkillState', () => {
  const { ga } = fakeAdapter()
  const state = (current: ArknightsCharacterStatus, goal: ArknightsCharacterStatus | undefined, index: number) =>
    baseSkillState(ga, silence, current, goal, 0, index)

  it('tells the five states apart', () => {
    expect(state(st(1, 70), undefined, 0)).toEqual({ state: 'unlocked', owned: true })
    expect(state(st(2, 1), undefined, 0)).toEqual({ state: 'replaced', owned: true })
    expect(state(st(1, 70), st(2, 1), 1)).toEqual({ state: 'planned', owned: true })
    expect(state(st(1, 70), st(1, 80), 1)).toEqual({ state: 'locked', owned: true })
    expect(state(absent, undefined, 0)).toEqual({ state: 'absent', owned: false })
  })

  it('counts an operator not owned whose goal reaches the skill as planned', () => {
    expect(state(absent, st(2, 1), 1)).toEqual({ state: 'planned', owned: false })
  })

  it('has nothing planned without a goal', () => {
    expect(state(st(1, 70), undefined, 1)).toEqual({ state: 'locked', owned: true })
  })
})

describe('unlockCost', () => {
  it('goes from an owned operator’s level to the unlock point, the rest unchanged', () => {
    const { ga, calls } = fakeAdapter()
    const current = { ...st(1, 70), skillLevel: 7 }
    expect(unlockCost(ga, silence, current, { elite: 2, level: 1 })).toBe(42)
    expect(calls).toEqual([['char_108_silent', current, { ...current, elite: 2, level: 1 }]])
  })

  it('starts an operator not owned at elite 0 level 1', () => {
    const { ga, calls } = fakeAdapter()
    const from = unlockFrom(ga, silence, st(0, 0, 3))
    expect(from).toEqual({ ...st(0, 1, 3) })
    unlockCost(ga, silence, st(0, 0, 3), { elite: 2, level: 1 })
    expect(calls[0][1]).toEqual(from)
  })

  it('stays within a phase for a level unlock', () => {
    const { ga, calls } = fakeAdapter()
    unlockCost(ga, silence, st(0, 20), { elite: 0, level: 30 })
    expect(calls[0].slice(1)).toEqual([st(0, 20), st(0, 30)])
  })

  it('is NaN once unlocked, without asking for a cost', () => {
    const { ga, calls } = fakeAdapter()
    expect(unlockCost(ga, silence, st(2, 1), { elite: 2, level: 1 })).toBeNaN()
    expect(calls).toEqual([])
  })
})

describe('roomOrder', () => {
  it('follows the room buttons, with a room it does not know last', () => {
    expect(BASE_ROOMS.map(roomOrder)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
    expect(BASE_ROOMS.slice(0, 4)).toEqual(['MANUFACTURE', 'TRADING', 'POWER', 'CONTROL'])
    expect(roomOrder('GARDEN')).toBe(10)
  })
})

describe('effectLines', () => {
  const prod = (v: number): Leaf => ({ k: 'flat', m: 'prod', v })
  const cap: Leaf = { k: 'flat', m: 'cap', v: -12 }
  const cost: Leaf = { k: 'flat', m: 'cost', v: 0.25 }
  const note: Leaf = { k: 'note', note: 'goldOrderUp' }
  const per: Leaf = {
    k: 'per',
    m: 'prod',
    v: 5,
    each: { n: 1, unit: 'op', what: [{ ref: 'term:cc.tag.sees', text: 'S.E.E.S.' }] },
    maxCount: 4,
  }
  const withLappland: Cond = { c: 'with', who: [{ ref: 'char:char_140_whitew', text: '拉普兰德' }], group: false }
  const lapplandCost: Leaf = { k: 'flat', m: 'cost', v: 0.3 }
  const lapplandOrder: Leaf = { k: 'flat', m: 'order', v: 65 }
  // oxlint-disable-next-line unicorn/no-thenable -- the data's if-effects carry a list called then
  const lappland: BaseSkillEffect = { k: 'if', when: withLappland, then: [lapplandCost, lapplandOrder] }

  it('puts the room metric first', () => {
    expect(effectLines([cap, prod(25), cost], 'MANUFACTURE')).toEqual({
      head: [prod(25)],
      conditional: false,
      rest: [{ leaf: cap }, { leaf: cost }],
    })
  })

  it('counts a control center number for all rooms or one as its room metric', () => {
    const all: Leaf = { k: 'flat', m: 'prod', v: 2, to: { all: 'MANUFACTURE' } }
    const self: Leaf = { k: 'flat', m: 'cost', v: 0.5, to: 'self' }
    expect(effectLines([self, all], 'CONTROL').head).toEqual([all])
  })

  it('takes the number under a condition when nothing comes without one', () => {
    expect(effectLines([lappland], 'TRADING')).toEqual({
      head: [lapplandOrder],
      conditional: true,
      rest: [{ cond: withLappland }, { leaf: lapplandCost }],
    })
  })

  it('takes another number, then a note, then the mood cost', () => {
    expect(effectLines([cost, cap], 'MANUFACTURE').head).toEqual([cap])
    expect(effectLines([cost, note], 'TRADING').head).toEqual([note])
    expect(effectLines([cost], 'TRADING').head).toEqual([cost])
  })

  it('writes a condition that is not on the first line with its numbers', () => {
    const trading: Leaf = { k: 'flat', m: 'order', v: 20 }
    expect(effectLines([trading, lappland], 'TRADING')).toEqual({
      head: [trading],
      conditional: false,
      rest: [{ when: withLappland, leaves: [lapplandCost, lapplandOrder] }],
    })
  })

  it('puts the zeroing before the rest', () => {
    const zero: Leaf = { k: 'zero', m: 'prod' }
    const power: Leaf = { ...per, each: { n: 1, unit: 'room', what: [{ room: 'POWER' }] } }
    expect(effectLines([cap, zero, power], 'MANUFACTURE')).toEqual({
      head: [power],
      conditional: false,
      rest: [{ leaf: zero }, { leaf: cap }],
    })
  })

  it('says a ramp grows with time', () => {
    const ramp: Leaf = { k: 'ramp', m: 'prod', v0: 20, v1: 25 }
    expect(effectLines([ramp, cost], 'MANUFACTURE').rest).toEqual([{ ramp: true }, { leaf: cost }])
  })

  it('takes two numbers at most, and no per-count one beside another', () => {
    const self: Leaf = { k: 'flat', m: 'recover', v: 0.55, to: 'self' }
    const room: Leaf = { k: 'flat', m: 'recover', v: 0.1, to: 'room' }
    const one: Leaf = { k: 'flat', m: 'recover', v: 0.2, to: 'one' }
    expect(effectLines([self, room, one], 'DORMITORY').head).toEqual([self, room])
    expect(effectLines([prod(20), per], 'MANUFACTURE')).toEqual({
      head: [prod(20)],
      conditional: false,
      rest: [{ leaf: per }],
    })
  })
})
