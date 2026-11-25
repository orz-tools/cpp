import { describe, expect, it } from 'vitest'
import {
  RecruitData,
  recruitAssertion,
  recruitCombos,
  recruitTagGroups,
  recruitTagOrder,
  recruitTagsOf,
} from './recruit'

const tags = (...ids: number[]) => ids.map((tagId) => ({ tagId, tagName: `t${tagId}` }))
const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i)

describe('recruitTagGroups', () => {
  it('groups the tags as the recruitment screen does', () => {
    expect(recruitTagGroups(tags(...range(1, 29)))).toEqual([
      { group: 'qualification', tags: [11, 14, 17, 28] },
      { group: 'profession', tags: range(1, 8) },
      { group: 'position', tags: [9, 10] },
      { group: 'ability', tags: [12, 13, 15, 16, ...range(18, 27), 29] },
    ])
  })

  it('leaves out the ids the data lacks, and a group left empty', () => {
    expect(recruitTagGroups(tags(19, 1, 17, 11))).toEqual([
      { group: 'qualification', tags: [11, 17] },
      { group: 'profession', tags: [1] },
      { group: 'ability', tags: [19] },
    ])
  })

  it('puts a new tag among the abilities, by id', () => {
    expect(recruitTagGroups(tags(30, 12, 9))).toEqual([
      { group: 'position', tags: [9] },
      { group: 'ability', tags: [12, 30] },
    ])
    expect(recruitTagOrder(tags(30, 12, 9, 14))).toEqual([14, 9, 12, 30])
  })
})

// A small pool in the order the in-game rules list it: by rarity, then not by id
const rarities: Record<string, number> = {
  char_lancet: 1,
  char_rangers: 2,
  char_steward: 3,
  char_hibiscus: 3,
  char_earthspirit: 4,
  char_haze: 4,
  char_nightmare: 5,
  char_glaucus: 5,
  char_exusiai: 6,
}
const recruit: RecruitData = {
  tags: tags(2, 4, 5, 6, 10, 11, 12, 14, 15, 17, 19, 23, 24, 28),
  pool: [
    { charId: 'char_lancet', tags: [4, 10, 15, 28] },
    { charId: 'char_rangers', tags: [2, 10, 17] },
    { charId: 'char_steward', tags: [6, 10, 19] },
    { charId: 'char_hibiscus', tags: [4, 10, 15] },
    { charId: 'char_earthspirit', tags: [6, 10, 23] },
    { charId: 'char_haze', tags: [6, 10, 19, 24] },
    { charId: 'char_nightmare', tags: [6, 10, 14, 19, 23, 24] },
    { charId: 'char_glaucus', tags: [5, 10, 12, 14, 23] },
    { charId: 'char_exusiai', tags: [2, 10, 11, 19] },
  ],
}
const rarityOf = (charId: string) => rarities[charId]
const combos = (selected: number[], rarity: (charId: string) => number | undefined = rarityOf) =>
  recruitCombos(selected, recruit, rarity)

describe('recruitCombos', () => {
  // 资深干员、远程位、减速、术师干员、输出, picked in that order
  const five = combos([14, 10, 23, 6, 19])

  it('takes every combination of one to three of five tags', () => {
    expect(five).toHaveLength(25)
    expect(Math.max(...five.map((x) => x.tags.length))).toBe(3)
  })

  it('sorts by guarantee, then by fewer tags, then by where the tags sit on the recruitment screen', () => {
    expect(five.map((x) => [x.guarantee, x.tags])).toEqual([
      [5, [14]],
      [5, [14, 6]],
      [5, [14, 10]],
      [5, [14, 19]],
      [5, [14, 23]],
      [5, [19, 23]],
      [5, [14, 6, 10]],
      [5, [14, 6, 19]],
      [5, [14, 6, 23]],
      [5, [14, 10, 19]],
      [5, [14, 10, 23]],
      [5, [14, 19, 23]],
      [5, [6, 19, 23]],
      [5, [10, 19, 23]],
      [4, [23]],
      [4, [6, 23]],
      [4, [10, 23]],
      [4, [6, 10, 23]],
      [3, [6]],
      [3, [10]],
      [3, [19]],
      [3, [6, 10]],
      [3, [6, 19]],
      [3, [10, 19]],
      [3, [6, 10, 19]],
    ])
  })

  it('lists the operators by rarity, then in the order of the rules', () => {
    expect(five.find((x) => x.tags.join() === '10')!.charIds).toEqual([
      'char_nightmare',
      'char_glaucus',
      'char_earthspirit',
      'char_haze',
      'char_steward',
      'char_hibiscus',
      'char_rangers',
      'char_lancet',
    ])
    expect(five.find((x) => x.tags.join() === '19,23')!.charIds).toEqual(['char_nightmare'])
  })

  it('gives a 6★ only to a combination with 高级资深干员', () => {
    expect(combos([19, 11]).map((x) => [x.tags, x.charIds])).toEqual([
      [[11], ['char_exusiai']],
      [[11, 19], ['char_exusiai']],
      [[19], ['char_nightmare', 'char_haze', 'char_steward']],
    ])
  })

  it('guarantees the lowest rarity from 3★ up, or the lowest of 1★ and 2★ when there is none', () => {
    expect(five.find((x) => x.tags.join() === '10')!.guarantee).toBe(3)
    expect(combos([28, 17]).map((x) => [x.tags, x.guarantee])).toEqual([
      [[17], 2],
      [[28], 1],
    ])
  })

  it('leaves out a combination no operator carries', () => {
    expect(combos([28, 17]).map((x) => x.tags)).not.toContainEqual([17, 28])
    expect(combos([])).toEqual([])
  })

  it('skips an operator whose rarity it is not told', () => {
    const steward = combos([19], (charId) => (charId === 'char_nightmare' ? undefined : rarityOf(charId)))
    expect(steward).toEqual([{ tags: [19], guarantee: 3, charIds: ['char_haze', 'char_steward'] }])
  })
})

describe('recruitTagsOf', () => {
  it('names the tags of an operator in the pool, and none of one outside it', () => {
    expect(recruitTagsOf(recruit, 'char_glaucus')).toEqual([5, 10, 12, 14, 23])
    expect(recruitTagsOf(recruit, 'char_amiya')).toEqual([])
  })
})

describe('recruitAssertion', () => {
  const contains = (operand: string) => ({ _: 'field', field: 'recruit', op: 'contains', operand })
  const below6 = { _: 'field', field: 'rarity', op: '<', operand: 6 }

  it('adds nothing without a tag', () => {
    expect(recruitAssertion(undefined)).toBeUndefined()
    expect(recruitAssertion('19')).toBeUndefined()
    expect(recruitAssertion([])).toBeUndefined()
    expect(recruitAssertion([19, null])).toBeUndefined()
  })

  it('asks for every tag, and no 6★ without 高级资深干员', () => {
    expect(recruitAssertion(['19'])).toEqual({ _: '&&', operand: [contains('19'), below6] })
    expect(recruitAssertion(['14', '23'])).toEqual({ _: '&&', operand: [contains('14'), contains('23'), below6] })
  })

  it('lets a 6★ in with 高级资深干员', () => {
    expect(recruitAssertion(['11', '19'])).toEqual({ _: '&&', operand: [contains('11'), contains('19')] })
  })

  it('ignores what is not a string', () => {
    expect(recruitAssertion([19, '23', { id: 11 }])).toEqual({ _: '&&', operand: [contains('23'), below6] })
  })
})
