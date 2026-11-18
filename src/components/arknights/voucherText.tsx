import React, { memo } from 'react'
import { useGameAdapter } from '../../Cpp'
import { Arknights, ArknightsAdapter } from '../../pkg/cpp-arknights'
import { VoucherKind } from '../../pkg/cpp-arknights/trainingCost'
import { gt } from '../../pkg/gt'
import { ValueText } from '../Value'

/** 把翻译文案里的占位符换成 React 节点；长的占位符先匹配，所以 %s 和 %s$elite2 可以同时用 */
export function fillNodes(template: string, slots: Record<string, React.ReactNode>): React.ReactNode[] {
  const keys = Object.keys(slots).sort((a, b) => b.length - a.length)
  const pattern = new RegExp(`(${keys.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`)
  return template
    .split(pattern)
    .map((part, i) =>
      Object.prototype.hasOwnProperty.call(slots, part) ? <React.Fragment key={i}>{slots[part]}</React.Fragment> : part,
    )
}

/** 「最多 5571」，数按用户选的价值单位 */
export const MostText = memo(({ value }: { value: number }) => (
  <>
    {fillNodes(gt.pgettext('training cost', '最多 %s') /* I10N: %s: a value like 5571 */, {
      '%s': <ValueText value={value} />,
    })}
  </>
))

/** 「4 星 2022、5 星 3765、6 星 5735」：一种道具在 4–6 星的同星级最多 */
export const RarityMaxList = memo(({ kind }: { kind: VoucherKind }) => {
  const tc = (useGameAdapter<Arknights>() as ArknightsAdapter).getTrainingCost()
  const separator = gt.pgettext('list separator', '、')
  return (
    <>
      {[3, 4, 5].map((rarity, i) => (
        <React.Fragment key={rarity}>
          {i > 0 ? separator : null}
          {fillNodes(gt.pgettext('training cost', '%d 星 %s') /* I10N: %d: 4, 5 or 6; %s: a value */, {
            '%d': rarity + 1,
            '%s': <ValueText value={tc.rarityMax(kind, rarity)} />,
          })}
        </React.Fragment>
      ))}
    </>
  )
})
