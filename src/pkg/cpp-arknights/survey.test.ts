import { describe, expect, it, vi } from 'vitest'
import type { ArknightsDataManager, Character, Skill, UniEquip } from './DataManager'
import { HeyboxSurveySource, YituliuSurveySource, toTierShares } from './survey'

vi.mock('localforage', () => ({
  default: {
    dropInstance: () => Promise.resolve(),
    createInstance: () => ({ removeItem: () => Promise.resolve() }),
  },
}))

// 夏栎 in both surveys, as published on 2026-11-17
const yituliuRow = {
  charId: 'char_492_quercu',
  elite: { count: 0.2176, rank0: 0.78235, rank1: 0.07347, rank2: 0.14417657180151494, rank3: 0 },
  modX: {
    count: 0.06751972786424856,
    rank0: 0.9325,
    rank1: 0.029982398196309556,
    rank2: 0.006061744754069181,
    rank3: 0.03147558491386983,
  },
  own: 0.7401665861549046,
  sampleSize: 136626,
  skill1: {
    count: 0.07474833376184166,
    rank0: 0.9253,
    rank1: 0.004766331111682455,
    rank2: 0.003589581314399858,
    rank3: 0.06639242133575934,
  },
  skill2: {
    count: 0.013824337954630856,
    rank0: 0.9862,
    rank1: 0.002007396713011491,
    rank2: 0.0008306469157288927,
    rank3: 0.010986294325890473,
  },
}

const heyboxRow = {
  i: 'char_492_quercu',
  o: 0.702,
  e: [0.883, 0.049, 0.068],
  e2l: [0.752, 0.248, 0],
  e2m1: [0.461, 0.108, 0.432],
  e2s1: [0.558, 0.044, 0.036, 0.362],
  e2s2: [0.909, 0.018, 0.009, 0.064],
}

const dm = {
  data: { yituliuSurvey: { char_492_quercu: yituliuRow }, heyboxSurvey: { char_492_quercu: heyboxRow } },
  raw: { yituliuSurvey: { userCount: 136626 } },
} as unknown as ArknightsDataManager

const quercus = { key: 'char_492_quercu' } as Character
const skill = {} as Skill
const modX = { key: 'uniequip_002_quercu', raw: { typeName2: 'X' } } as UniEquip

const sum = (xs: (number | null)[]) => xs.reduce<number>((a, b) => a + (b ?? 0), 0)

describe('toTierShares', () => {
  it('rebases Yituliu masteries on E2 owners', () => {
    const t = toTierShares(new YituliuSurveySource(dm).skill(quercus, skill, quercus.key, 0))!
    expect(t.base).toBe('elite2')
    const expected = [0.4816, 0.0331, 0.0249, 0.4605]
    t.shares.forEach((x, i) => expect(x).toBeCloseTo(expected[i], 4))
    expect(sum(t.shares)).toBeCloseTo(1, 10)
    expect(t.samples).toBeCloseTo(136626 * 0.7401665861549046 * 0.14417657180151494, 6)
  })

  it('tells a rarely mastered skill from a common one', () => {
    const t = toTierShares(new YituliuSurveySource(dm).skill(quercus, skill, quercus.key, 1))!
    expect(t.shares[3]).toBeCloseTo(0.0762, 4)
  })

  it('rebases Yituliu modules too', () => {
    const t = toTierShares(new YituliuSurveySource(dm).mod(quercus, modX, quercus.key))!
    expect(t.base).toBe('elite2')
    const expected = [0.5317, 0.208, 0.042, 0.2183]
    t.shares.forEach((x, i) => expect(x).toBeCloseTo(expected[i], 3))
    expect(sum(t.shares)).toBeCloseTo(1, 10)
  })

  it('reads Heybox masteries as they come, already shares of E2 owners', () => {
    const t = toTierShares(new HeyboxSurveySource(dm).skill(quercus, skill, quercus.key, 0))!
    expect(t.base).toBe('elite2')
    heyboxRow.e2s1.forEach((x, i) => expect(t.shares[i]).toBeCloseTo(x, 10))
    expect(t.samples).toBeNaN()
  })

  it('keeps Heybox modules on those who unlocked them', () => {
    const t = toTierShares(new HeyboxSurveySource(dm).mod(quercus, modX, quercus.key))!
    expect(t.base).toBe('unlocked')
    expect(t.shares).toEqual([null, 0.461, 0.108, 0.432])
  })

  it('gives every tier but 0 nothing when nobody has any', () => {
    const none = { percent: 0, samples: 100, desc: '' }
    const nan = { percent: NaN, samples: 0, desc: '' }
    expect(toTierShares([none, nan, nan, nan])!.shares).toEqual([1, 0, 0, 0])
  })

  it('returns null without data', () => {
    expect(toTierShares(null)).toBeNull()
    expect(toTierShares(undefined)).toBeNull()
    expect(toTierShares(new YituliuSurveySource(dm).skill(quercus, skill, 'char_nobody', 0))).toBeNull()
    expect(toTierShares(new YituliuSurveySource(dm).skill(quercus, skill, quercus.key, 2))).toBeNull()
  })
})
