import { memo } from 'react'
import { IItem } from '../pkg/cpp-basic'
import { CachedImg } from './Icons'
import { PeekTrigger } from './Peek'

/**
 * 一样东西画成 40px 的格子，数叠在右下角，点开物品卡；一排格子放在 `.cpp-item-tiles` 里。
 * `item` 为空时（数据里对不上的物品）只画数。
 */
export const ItemTile = memo(
  ({ id, item, label, title }: { id: string; item: IItem | undefined; label: string; title: string }) => (
    <PeekTrigger
      peek={{ kind: 'item', id }}
      renderTarget={(peek) => (
        <span
          role={peek ? 'button' : undefined}
          {...peek}
          className={'cpp-item-tile' + (peek ? ' ' + peek.className : '')}
          title={title}
        >
          {/* 不用 ItemIcon：它的图片自带 title，会盖掉格子的 title */}
          {item ? <CachedImg src={item.icon} width={34} height={34} alt={item.name} /> : null}
          <span className="cpp-item-tile-quantity">{label}</span>
        </span>
      )}
    />
  ),
)
