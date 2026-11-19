import { describe, expect, it } from 'vitest'
import type { Formula } from '../cpp-basic/types'
import { foldMaterials } from './foldMaterials'
import { AK_ITEM_GOLD, AK_ITEM_VIRTUAL_EXP } from './types'

const formula = (itemId: string, costs: Record<string, number>, quantity = 1): Formula => ({
  id: `workshop-${itemId}`,
  itemId,
  quantity,
  costs: Object.entries(costs).map(([id, n]) => ({ itemId: id, quantity: n })),
  tags: [],
})

// 国服的配方：D32钢 = 三水锰矿 + 五水研磨石 + RMA70-24，这三种紫材料各由蓝材料合成
const formulas = [
  formula('30135', { 30084: 1, 30094: 1, 30104: 1, [AK_ITEM_GOLD]: 400 }),
  formula('30084', { 30033: 1, 30073: 1, 30083: 2, [AK_ITEM_GOLD]: 300 }),
  formula('30094', { 30043: 1, 30063: 1, 30093: 1, [AK_ITEM_GOLD]: 300 }),
  formula('30104', { 30013: 2, 30053: 1, 30103: 1, [AK_ITEM_GOLD]: 300 }),
  // 双芯片
  formula('3213', { 3212: 2, 32001: 1 }),
  // 蓝材料由绿材料合成；不该用到
  formula('30013', { 30012: 5, [AK_ITEM_GOLD]: 200 }),
]
const goldAndPurple = new Set(['30135', '30084', '30094', '30104'])
const shouldFold = (id: string) => goldAndPurple.has(id)

describe('foldMaterials', () => {
  it('breaks gold into purple and purple into blue, adding the fee to the LMD', () => {
    const r = foldMaterials(new Map([['30135', 2]]), formulas, shouldFold)
    expect(Object.fromEntries(r.items)).toEqual({
      30033: 2,
      30073: 2,
      30083: 4,
      30043: 2,
      30063: 2,
      30093: 2,
      30013: 4,
      30053: 2,
      30103: 2,
      [AK_ITEM_GOLD]: 2 * 400 + 3 * 2 * 300,
    })
    expect(r.fee).toBe(2600)
    expect(Object.fromEntries(r.unfolded)).toEqual({ 30135: 2 })
  })

  it('keeps what the operator needs directly apart from what folding adds', () => {
    const r = foldMaterials(
      new Map([
        [AK_ITEM_GOLD, 10000],
        ['30084', 1],
        ['30083', 3],
      ]),
      formulas,
      shouldFold,
    )
    expect(r.items.get('30083')).toBe(5)
    expect(r.folded.get('30083')).toBe(2)
    expect(r.items.get(AK_ITEM_GOLD)).toBe(10300)
    expect(r.folded.get(AK_ITEM_GOLD)).toBe(300)
    expect(r.folded.has('30033')).toBe(true)
    expect(Object.fromEntries(r.unfolded)).toEqual({ 30084: 1 })
  })

  it('leaves alone what it should not fold or has no formula for', () => {
    const items = new Map([
      [AK_ITEM_VIRTUAL_EXP, 1000],
      ['3213', 4],
      ['30013', 3],
      ['30145', 1],
    ])
    const r = foldMaterials(items, formulas, (id) => id === '30145' || shouldFold(id))
    expect(r.items).toEqual(items)
    expect(r.folded.size).toBe(0)
    expect(r.unfolded.size).toBe(0)
    expect(r.fee).toBe(0)
  })

  it('crafts whole batches when a formula makes more than one', () => {
    const r = foldMaterials(new Map([['x', 5]]), [formula('x', { y: 1 }, 2)], () => true)
    expect(Object.fromEntries(r.items)).toEqual({ y: 3 })
  })

  it('stops at a formula that leads back to itself', () => {
    const r = foldMaterials(new Map([['a', 1]]), [formula('a', { b: 1 }), formula('b', { a: 2 })], () => true)
    expect(Object.fromEntries(r.items)).toEqual({ a: 2 })
    expect(Object.fromEntries(r.folded)).toEqual({ a: 2 })
  })
})
