import { Button, ButtonGroup, Icon } from '@blueprintjs/core'
import { useAtomValue, useSetAtom } from 'jotai'
import React, { memo, useState } from 'react'
import { useAtoms, useGameAdapter, useGameDataMemo } from '../Cpp'
import { IGame, IItem } from '../pkg/cpp-basic'
import { gt } from '../pkg/gt'
import { ItemIcon } from './Icons'
import { ItemQuantityEditor } from './ItemList'
import { PeekHead } from './Peek'
import { synthesisTimes } from './itemSynthesis'
import { PeekKind, PeekRef } from './peek'
import { ValueTag } from './Value'

/** 卡片里的一行物品：配方的材料、关卡的掉落；点了在同一张卡里换成这种物品 */
export const PeekItemRow = memo(
  ({
    item,
    navigate,
    className,
    children,
  }: {
    item: IItem
    navigate: (ref: PeekRef) => void
    className?: string
    /** 右边的数 */
    children: React.ReactNode
  }) => (
    <button
      type="button"
      className={'cpp-peek-target cpp-peek-list-row' + (className ? ' ' + className : '')}
      onClick={() => navigate({ kind: 'item', id: item.key })}
    >
      <ItemIcon item={item} size={18} />
      <span className="cpp-peek-list-name">{item.name}</span>
      <span className="cpp-peek-list-value">{children}</span>
    </button>
  ),
)

const buildIcon = <Icon icon="build" size={10} className="cpp-peek-build" />

/**
 * 悬停合成按钮时配方按那一档算，字的长短跟着变。弹出的物品卡按内容定宽，所以每一档的字都叠在同一格里、按最宽的占位：
 * 不然卡片随悬停变宽变窄，靠右的按钮从指针下挪开，移出、变回、又移进，来回闪
 */
const EachTimes = ({
  options,
  times,
  render,
}: {
  options: readonly number[]
  times: number
  render: (times: number) => React.ReactNode
}) => (
  <span className="cpp-peek-times">
    {options.map((t) => (
      <span key={t} className={t === times ? undefined : 'is-other'}>
        {render(t)}
      </span>
    ))}
  </span>
)

/** 物品栏「可合成」原来那个弹层搬过来的：上面一行合成按钮，下面是配方；一次合成一步撤销 */
export const ItemSynthesis = memo(
  <G extends IGame>({ item, navigate }: { item: IItem; navigate: (ref: PeekRef) => void }) => {
    const ga = useGameAdapter<G>()
    const atoms = useAtoms<G>()
    const quantities = useAtomValue(atoms.itemQuantities)
    const setData = useSetAtom(atoms.dataAtom)
    const formula = useGameDataMemo(() => ga.getFormulas().find((x) => x.itemId === item.key), [ga, item.key])
    // 悬停在哪个按钮上，配方就按做几次算
    const [times, setTimes] = useState(1)
    if (!formula) return null

    const maxTimes = Math.max(
      0,
      Math.min(...formula.costs.map((x) => Math.floor((quantities[x.itemId] || 0) / x.quantity))),
    )
    const options = synthesisTimes(maxTimes, formula.apCost)
    return (
      <>
        <div className="cpp-peek-synth">
          <span className="cpp-peek-label">{gt.pgettext('peek card', '合成')}</span>
          {formula.apCost ? (
            <span className="cpp-peek-sub">
              {gt.gettext('心情')} {formula.apCost}
            </span>
          ) : null}
          <ButtonGroup variant="minimal">
            {options.map((t) => (
              <Button
                key={t}
                size="small"
                disabled={t > maxTimes}
                icon={buildIcon}
                text={t}
                style={{ opacity: formula.apCost && t > 24 / formula.apCost ? 0.5 : 1 }}
                onMouseEnter={() => setTimes(t)}
                onMouseLeave={() => setTimes(1)}
                onClick={() =>
                  setData('modify', (d) => {
                    d.items[item.key] = (d.items[item.key] || 0) + t * formula.quantity
                    formula.costs.forEach((cost) => {
                      d.items[cost.itemId] = (d.items[cost.itemId] || 0) - t * cost.quantity
                    })
                  })
                }
              />
            ))}
          </ButtonGroup>
        </div>
        <div className="cpp-peek-list">
          <div className="cpp-peek-list-head">
            <EachTimes
              options={options}
              times={times}
              render={(t) =>
                gt
                  .ngettext(`制作 %d 次所需`, `制作 %d 次所需`, t) /* I10N: %d: number */
                  .replaceAll('%d', t.toString())
              }
            />
            <span>{gt.pgettext('peek card', '需要 / 库存')}</span>
          </div>
          {formula.costs.map((cost) => {
            const have = quantities[cost.itemId] || 0
            return (
              <PeekItemRow
                key={cost.itemId}
                item={ga.getItem(cost.itemId)}
                navigate={navigate}
                className={have < times * cost.quantity ? 'is-short' : undefined}
              >
                <EachTimes options={options} times={times} render={(t) => `${t * cost.quantity} / ${have}`} />
              </PeekItemRow>
            )
          })}
        </div>
      </>
    )
  },
)

export const itemPeekKind: PeekKind = {
  Head: memo(({ id }: { id: string }) => {
    const item = useGameAdapter().getItem(id)
    return (
      <PeekHead
        icon={<ItemIcon item={item} size={28} />}
        title={item.name}
        sub={<ValueTag value={item.valueAsAp} minimal single />}
        subEnd={
          <label className="cpp-peek-stock">
            <span className="cpp-peek-label">{gt.pgettext('peek card', '库存')}</span>
            <ItemQuantityEditor item={item} compact />
          </label>
        }
      />
    )
  }),
  // 没有配方时什么都不画，卡片只剩标题栏
  Body: memo(({ id, navigate }: { id: string; navigate: (ref: PeekRef) => void }) => (
    <ItemSynthesis item={useGameAdapter().getItem(id)} navigate={navigate} />
  )),
  exists: (ga, id) => !!ga.getItem(id),
}
