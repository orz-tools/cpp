import { Dialog, DialogBody } from '@blueprintjs/core'
import { createContext, memo, useState } from 'react'
import useEvent from 'react-use-event-hook'
import { useChamber } from './Chamber'
import { PopOutWindowContext, nextWindowEpoch } from './dossierHooks'
import { SidebarPanel } from './types'

/** Closes the pop-out window a wide view sits in, for a link that leads somewhere the window would cover */
export const CloseSidebarPanelDialogContext = createContext<(() => void) | undefined>(undefined)

export const SidebarPanelDialog = memo(({ panel, onClose }: { panel: SidebarPanel; onClose?: () => void }) => {
  const Wide = panel.Wide!
  // A dossier opened before this window sits under it; the dossier compares epochs to find out
  const [epoch] = useState(nextWindowEpoch)
  return (
    <Dialog isOpen={true} title={panel.title.toString()} icon={panel.icon} onClose={onClose}>
      {/* The wide view scrolls its own columns; the default 70vh scroll container would add a second scrollbar */}
      <DialogBody useOverflowScrollContainer={false}>
        <PopOutWindowContext.Provider value={epoch}>
          <CloseSidebarPanelDialogContext.Provider value={onClose}>
            <Wide />
          </CloseSidebarPanelDialogContext.Provider>
        </PopOutWindowContext.Provider>
      </DialogBody>
    </Dialog>
  )
})

export function useOpenSidebarPanel() {
  const { add } = useChamber()
  // One key per panel, so the pop-out button and any in-panel link share a single window
  return useEvent((panel: SidebarPanel) => add(SidebarPanelDialog, { panel }, 'sidebar:' + panel.id))
}
