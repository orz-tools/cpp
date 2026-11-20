import { Level } from '../Cpp'

export interface ItemCounterSlot {
  level: Level
  shown: boolean
}

export function itemCounterSlots(view: Level | undefined): [ItemCounterSlot, ItemCounterSlot] {
  const upper = view === Level.Star ? Level.Star : Level.Goal
  return [
    { level: upper, shown: view == null || view === upper },
    { level: Level.Finished, shown: view == null || view === Level.Finished },
  ]
}

export interface ItemCounterCell {
  value: number
  strong: boolean
}

export interface ItemCounterCells {
  afterSynthesis: ItemCounterCell
  synthesizable: ItemCounterCell
  remaining: ItemCounterCell
  direct: ItemCounterCell
  indirect: ItemCounterCell
}

export type ItemCounterKind = keyof ItemCounterCells

const allCounterKinds: readonly ItemCounterKind[] = [
  'afterSynthesis',
  'synthesizable',
  'remaining',
  'direct',
  'indirect',
]

/** 手机上计数表的列：分类里没有能合成的道具，就不要「合成后」「可合成」两列，钱和经验的九位数才放得下 */
export function counterKinds(withSynthesis: boolean): readonly ItemCounterKind[] {
  return withSynthesis ? allCounterKinds : allCounterKinds.slice(2)
}

/** 列按分类定而不按条目，同一分类里有配方和没配方的挨着也上下对齐 */
export function categoriesWithSynthesis(
  groups: readonly (readonly [string, readonly { key: string }[]])[],
  formulaItemIds: ReadonlySet<string>,
): Set<string> {
  return new Set(
    groups.filter(([, items]) => items.some((i) => formulaItemIds.has(i.key))).map(([category]) => category),
  )
}

// `synthesizable` counts a forbidden recipe too, so 可合成 still shows what the stock could make, only faded;
// 合成后 counts on the recipes the user allows, so it takes `canSynthesize` into account.
export function itemCounterCells(
  direct: number,
  indirect: number,
  quantity: number,
  synthesizable: number,
  canSynthesize: boolean,
): ItemCounterCells {
  const need = direct + indirect
  const usable = canSynthesize ? synthesizable : 0
  const afterSynthesis = need - quantity - Math.min(usable, need)
  const synthesizableValue = Math.min(synthesizable, need)
  const remaining = need - quantity
  return {
    afterSynthesis: { value: afterSynthesis, strong: afterSynthesis > 0 },
    synthesizable: { value: synthesizableValue, strong: canSynthesize && synthesizableValue > 0 },
    remaining: { value: remaining, strong: remaining > 0 },
    direct: { value: direct, strong: direct > 0 && direct - quantity > 0 },
    indirect: { value: indirect, strong: indirect > 0 && remaining > 0 },
  }
}
