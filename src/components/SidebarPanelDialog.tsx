import { Dialog, DialogBody } from '@blueprintjs/core'
import { memo } from 'react'
import useEvent from 'react-use-event-hook'
import { useChamber } from './Chamber'
import { SidebarPanel } from './types'

export const SidebarPanelDialog = memo(({ panel, onClose }: { panel: SidebarPanel; onClose?: () => void }) => {
  const Wide = panel.Wide!
  return (
    <Dialog isOpen={true} title={panel.title.toString()} icon={panel.icon} onClose={onClose}>
      {/* The wide view scrolls its own columns; the default 70vh scroll container would add a second scrollbar */}
      <DialogBody useOverflowScrollContainer={false}>
        <Wide />
      </DialogBody>
    </Dialog>
  )
})

export function useOpenSidebarPanel() {
  const { add } = useChamber()
  // One key per panel, so the pop-out button and any in-panel link share a single window
  return useEvent((panel: SidebarPanel) => add(SidebarPanelDialog, { panel }, 'sidebar:' + panel.id))
}
