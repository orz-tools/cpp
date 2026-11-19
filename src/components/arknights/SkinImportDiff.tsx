import { memo } from 'react'
import { useGameAdapter, useGameDataMemo } from '../../Cpp'
import { Arknights, ArknightsAdapter, Character } from '../../pkg/cpp-arknights'
import { SkinChange, skinChanges } from '../../pkg/cpp-arknights/skins'
import type { UserData } from '../../pkg/cpp-core/UserData'
import { gt } from '../../pkg/gt'
import type { ImportDiffTab } from '../types'
import { SkinPicture, acquiredText, skinSubtitle } from './SkinImages'

function useArknights() {
  return useGameAdapter<Arknights>() as ArknightsAdapter
}

const SkinChangeRow = memo(({ change, removed }: { change: SkinChange; removed: boolean }) => {
  const ga = useArknights()
  const { id, skin } = change
  // 图鉴里没有的：id 的 @ 前面是干员
  const character = ga.getCharacter(skin?.charId ?? id.split('@')[0]) as Character | undefined
  const name = skin?.name ?? id
  return (
    <div className={'cpp-skins-row cpp-skins-import-row' + (removed ? ' is-removed' : '')}>
      <span className="cpp-skins-row-pic">
        <SkinPicture id={id} kind="avatar" name={name} />
      </span>
      <span className="cpp-skins-row-text">
        <span className="cpp-skins-row-name" title={name}>
          {name}
        </span>
        <span className="cpp-skins-row-sub">{skin ? skinSubtitle({ skin }, character) : (character?.name ?? '')}</span>
      </span>
      {!removed && change.acquiredAt > 0 ? (
        <span className="cpp-skins-row-right cpp-skins-muted">{acquiredText(change.acquiredAt)}</span>
      ) : null}
    </div>
  )
})

const SkinChangeList = memo(({ added, removed }: { added: SkinChange[]; removed: SkinChange[] }) => (
  <div className="cpp-skins-import">
    {added.length > 0 ? (
      <>
        <div className="cpp-skins-import-head">
          {gt
            .ngettext('多了 %d 件', '多了 %d 件', added.length) /* I10N: %d: number of skins */
            .replaceAll('%d', String(added.length))}
        </div>
        {added.map((x) => (
          <SkinChangeRow key={x.id} change={x} removed={false} />
        ))}
      </>
    ) : null}
    {removed.length > 0 ? (
      <>
        <div className="cpp-skins-import-head">
          {gt
            .ngettext('少了 %d 件', '少了 %d 件', removed.length) /* I10N: %d: number of skins */
            .replaceAll('%d', String(removed.length))}
        </div>
        {removed.map((x) => (
          <SkinChangeRow key={x.id} change={x} removed={true} />
        ))}
      </>
    ) : null}
  </div>
))

/** 「时装」页：已有的时装多了哪些、少了哪些 */
export function useSkinImportDiffTabs(before: UserData<Arknights>, after: UserData<Arknights>): ImportDiffTab[] {
  const ga = useArknights()
  const changes = useGameDataMemo(
    () => skinChanges(ga.hasSkins() ? ga.getSkinCatalog() : null, before.skins ?? {}, after.skins ?? {}),
    [ga, before, after],
  )
  const count = changes.added.length + changes.removed.length
  // 数据 worker 还没发布时装的区服，没导入过时装就不出这一页
  if (count === 0 && !ga.hasSkins()) return []
  return [
    {
      id: 'skins',
      title: gt.pgettext('import result', '时装'),
      count,
      panel: <SkinChangeList added={changes.added} removed={changes.removed} />,
    },
  ]
}
