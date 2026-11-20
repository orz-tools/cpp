import { Button, MenuItem } from '@blueprintjs/core'
import { memo } from 'react'
import { useComponents } from '../../hooks/useComponents'
import { gt } from '../../pkg/gt'
import { useChamber } from '../Chamber'
import { RosterImageDialog, RosterImageSource } from './RosterImageDialog'

/** 游戏给了画法才有练度图；只看有没有这个字段，不调用它 */
export function useHasRosterImage(): boolean {
  return !!useComponents().useRosterImagePainter
}

function useOpenRosterImage() {
  const { add } = useChamber()
  return (source: RosterImageSource) => add(RosterImageDialog, { source })
}

/** 「导入/导出」菜单「导出」组的第一项：画干员列表现在列出的干员 */
export const RosterImageMenuItem = memo(() => {
  const has = useHasRosterImage()
  const open = useOpenRosterImage()
  if (!has) return null
  return <MenuItem icon="media" text={gt.gettext('练度图…')} onClick={() => open('list')} />
})

/** 列表选择栏里的按钮，和「拉满计划」「清空计划」一样作用在选中的干员上 */
export const RosterImageSelectionButton = memo(({ compact }: { compact?: boolean }) => {
  const has = useHasRosterImage()
  const open = useOpenRosterImage()
  if (!has) return null
  const text = gt.gettext('练度图')
  return (
    <Button
      size="small"
      variant="minimal"
      icon="media"
      text={compact ? undefined : text}
      aria-label={compact ? text : undefined}
      title={compact ? text : undefined}
      onClick={() => open('selection')}
    />
  )
})
