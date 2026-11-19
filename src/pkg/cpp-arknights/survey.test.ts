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

// 电弧 has no X, Y or D module, only A and B; yituliu, 2026-11-17
const radianRow = {
  charId: 'char_4195_radian',
  elite: { count: 0.9738, rank0: 0.0262, rank1: 0.1188, rank2: 0.855, rank3: 0 },
  modX: { count: 0, rank0: 1, rank1: 0, rank2: 0, rank3: 0 },
  modA: { count: 0.5427, rank0: 0.4573, rank1: 0.194, rank2: 0.0174, rank3: 0.3313 },
  modB: { count: 0.265, rank0: 0.735, rank1: 0.0067, rank2: 0.0051, rank3: 0.2532 },
  own: 0.9187,
  sampleSize: 120916,
}

const radianHeyboxRow = {
  i: 'char_4195_radian',
  e2m1: [0.55, 0.035, 0.415],
  e2m2: [0.068, 0.049, 0.883],
  e2m3: [null, null, null],
}

const dm = {
  data: {
    yituliuSurvey: { char_492_quercu: yituliuRow, char_4195_radian: radianRow },
    heyboxSurvey: { char_492_quercu: heyboxRow, char_4195_radian: radianHeyboxRow },
  },
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

  it('reads Yituliu A and B modules as well', () => {
    const radian = { key: 'char_4195_radian' } as Character
    const mod = (typeName2: string) => ({ key: 'uniequip_002_radian', raw: { typeName2 } }) as UniEquip
    const a = toTierShares(new YituliuSurveySource(dm).mod(radian, mod('A'), radian.key))!
    expect(1 - a.shares[0]!).toBeCloseTo(0.5427 / 0.855, 10)
    expect(a.shares[3]).toBeCloseTo(0.3313 / 0.855, 10)
    const b = toTierShares(new YituliuSurveySource(dm).mod(radian, mod('B'), radian.key))!
    expect(b.shares[3]).toBeCloseTo(0.2532 / 0.855, 10)
    expect(new YituliuSurveySource(dm).mod(radian, mod('Y'), radian.key)).toBeNull()
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

  it('finds Heybox modules by the number in their ids', () => {
    const radian = { key: 'char_4195_radian' } as Character
    const mod = (key: string) => ({ key, raw: {} }) as UniEquip
    const level3 = (key: string) =>
      toTierShares(new HeyboxSurveySource(dm).mod(radian, mod(key), radian.key))!.shares[3]
    expect(level3('uniequip_002_radian')).toBe(0.415)
    expect(level3('uniequip_003_radian')).toBe(0.883)
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

const yituliuDm = {
  data: {
    yituliuSurvey: {
      char_1: {
        own: 0.5,
        elite: { rank0: 0.2, rank1: 0.3, rank2: 0.5 },
        skill1: { count: 100, rank1: 0.1, rank2: 0.2, rank3: 0.3 },
        modX: { count: 50, rank1: 0.1, rank2: 0.2, rank3: 0.3 },
      },
    },
  },
  raw: { yituliuSurvey: { userCount: 1000 } },
} as any

const heyboxDm = {
  data: {
    heyboxSurvey: {
      char_1: {
        o: 0.8,
        e: [0.1, 0.2, 0.7],
        e2s1: [0.4, 0.2, 0.3, 0.1],
        e2m1: [0.5, 0.3, 0.2],
        e2m2: [0.6, 0.3, 0.1],
        e2l: [0.1, 0.2, 0.7],
      },
      char_2: { o: null, e: [0, 0, 0], e2s1: [0, 0, 0, 0], e2m1: [0, 0, 0], e2l: [0, 0, 0] },
    },
  },
  raw: {},
} as any

const character = { key: 'char_1' } as any
const yituliuEquip = { raw: { typeName2: 'X' } } as any

describe('YituliuSurveySource', () => {
  const source = new YituliuSurveySource(yituliuDm)

  it('returns ownership stats', () => {
    expect(source.own(character)).toEqual({ percent: 0.5, samples: 1000, desc: expect.any(String) })
    expect(source.own({ key: 'nope' } as any)).toBeNull()
  })

  it('returns elite stats based on holders', () => {
    expect(source.elite0(character)?.percent).toBe(0.2)
    expect(source.elite1(character)?.percent).toBe(0.3)
    expect(source.elite2(character)?.percent).toBe(0.5)
    expect(source.elite0(character)?.samples).toBe(500)
  })

  it('returns skill mastery stats', () => {
    const result = source.skill(character, skill, 'char_1', 0)!
    expect(result).toHaveLength(4)
    expect(result[0].percent).toBe(200)
    expect(result[1].percent).toBe(0.1 / 100)
    expect(source.skill(character, skill, 'char_1', 1)).toBeNull()
    expect(source.skill(character, skill, 'nope', 0)).toBeNull()
  })

  it('returns module stats', () => {
    const result = source.mod(character, yituliuEquip, 'char_1')!
    expect(result[0].percent).toBe(100)
    expect(source.mod(character, { raw: { typeName2: 'Y' } } as any, 'char_1')).toBeNull()
  })

  it('has no level distribution', () => {
    expect(source.e2level()).toBeUndefined()
  })
})

describe('HeyboxSurveySource', () => {
  const source = new HeyboxSurveySource(heyboxDm)

  it('returns ownership stats and null for missing data', () => {
    expect(source.own(character)?.percent).toBe(0.8)
    expect(source.own({ key: 'char_2' } as any)).toBeNull()
    expect(source.own({ key: 'nope' } as any)).toBeNull()
  })

  it('returns elite stats', () => {
    expect(source.elite0(character)?.percent).toBe(0.1)
    expect(source.elite1(character)?.percent).toBe(0.2)
    expect(source.elite2(character)?.percent).toBe(0.7)
  })

  it('returns skill mastery stats', () => {
    const result = source.skill(character, skill, 'char_1', 0)!
    expect(result[0]!.percent).toBe(0.6)
    expect(result[1]!.percent).toBeCloseTo(0.2 / 0.6)
    expect(source.skill(character, skill, 'char_1', 2)).toBeNull()
  })

  it('returns module stats from the uniequip index', () => {
    const result = source.mod(character, { key: 'uniequip_2_x' } as any, 'char_1')!
    expect(result.map((x) => x?.percent)).toEqual([undefined, 0.5, 0.3, 0.2])
    expect(source.mod(character, { key: 'uniequip_3_x' } as any, 'char_1')![1]?.percent).toBe(0.6)
    expect(source.mod(character, { key: 'uniequip_1_x' } as any, 'char_1')).toBeNull()
    expect(source.mod(character, { key: 'other' } as any, 'char_1')).toBeNull()
  })

  it('returns level distribution ranges', () => {
    expect(source.e2level(character, 1)?.percent).toBe(0.1)
    expect(source.e2level(character, 70)?.percent).toBe(0.2)
    expect(source.e2level(character, 90)?.percent).toBe(0.7)
  })

  it('returns undefined when the distribution is not finite', () => {
    const badDm = {
      data: {
        heyboxSurvey: { char_1: { o: 1, e: [0, 0, 1], e2s1: [0, 0, 0, 0], e2m1: [0, 0, 0], e2l: [NaN, 0.2, 0.7] } },
      },
      raw: {},
    } as any
    expect(new HeyboxSurveySource(badDm).e2level(character, 90)).toBeUndefined()
  })

  it('returns undefined for missing characters', () => {
    expect(source.e2level({ key: 'nope' } as any, 90)).toBeUndefined()
  })
})
