import type { Formula } from '../cpp-basic/types'
import { AK_ITEM_GOLD } from './types'

export interface FoldedMaterials {
  /** 拆完以后的物品 → 数量 */
  items: ReadonlyMap<string, number>
  /** 每种物品里由拆分得来的数量；合成费记在 AK_ITEM_GOLD 下 */
  folded: ReadonlyMap<string, number>
  /** 拆掉的物品 → 原本要的数量 */
  unfolded: ReadonlyMap<string, number>
  /** 合成费，龙门币 */
  fee: number
}

/**
 * shouldFold 为真、又有配方的物品按配方拆开，拆出来的再按同样的规则拆，直到拆不动。
 * 不算副产物：一次合成按出 formula.quantity 个算。
 */
export function foldMaterials(
  items: ReadonlyMap<string, number>,
  formulas: readonly Formula[],
  shouldFold: (itemId: string) => boolean,
): FoldedMaterials {
  const formulaOf = new Map<string, Formula>()
  // 和 generateIndirects 一样，一种物品有几条配方时用第一条
  for (const f of formulas) if (!formulaOf.has(f.itemId)) formulaOf.set(f.itemId, f)

  const out = new Map<string, number>()
  const folded = new Map<string, number>()
  const unfolded = new Map<string, number>()
  let fee = 0
  const add = (map: Map<string, number>, id: string, n: number) => map.set(id, (map.get(id) ?? 0) + n)

  const expand = (id: string, n: number, fromFold: boolean, path: ReadonlySet<string>) => {
    const formula = shouldFold(id) ? formulaOf.get(id) : undefined
    // 配方绕回自己时就地停下，不然会一直拆下去
    if (!formula || path.has(id)) {
      add(out, id, n)
      if (fromFold) add(folded, id, n)
      return
    }
    if (!fromFold) add(unfolded, id, n)
    const times = Math.ceil(n / formula.quantity)
    const next = new Set(path).add(id)
    for (const cost of formula.costs) {
      const quantity = cost.quantity * times
      if (cost.itemId === AK_ITEM_GOLD) fee += quantity
      expand(cost.itemId, quantity, true, next)
    }
  }
  for (const [id, n] of items) expand(id, n, false, new Set())

  return { items: out, folded, unfolded, fee }
}
