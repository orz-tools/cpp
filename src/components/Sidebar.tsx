import { Alignment, Button, Classes, Navbar } from '@blueprintjs/core'
import { useAtom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import { memo, useRef } from 'react'
import useEvent from 'react-use-event-hook'
import { useGameAdapter } from '../Cpp'
import { useComponents } from '../hooks/useComponents'
import { gt } from '../pkg/gt'
import { aboutPanel } from './AboutList'
import { useOpenSidebarPanel } from './SidebarPanelDialog'
import { activePanelId, clickRailItem, readSidebarState } from './sidebarState'
import { SidebarPanel } from './types'

const sidebarStateAtom = atomWithStorage<unknown>('cpp_sidebar', null, undefined, { getOnInit: true })

const noBadge = () => false

const SidebarRailItem = memo(
  ({ panel, active, onClick }: { panel: SidebarPanel; active: boolean; onClick: (id: string) => void }) => {
    // A panel keeps its hook for as long as its button is mounted, so the hook order never changes
    const useBadge = panel.useBadge ?? noBadge
    const badge = useBadge()
    const label = panel.label.toString()
    const dot = badge && !active
    return (
      <Button
        variant="minimal"
        className="cpp-sidebar-rail-item"
        icon={panel.icon}
        text={label}
        active={active}
        intent={active ? 'primary' : undefined}
        aria-pressed={active}
        aria-label={
          dot
            ? gt
                .gettext('%s（有新内容）') /* I10N: %s: sidebar panel label */
                .replaceAll('%s', label)
            : undefined
        }
        title={panel.title.toString()}
        data-sidebar-panel={panel.id}
        onClick={() => onClick(panel.id)}
      >
        {dot ? <span className="cpp-sidebar-dot" /> : null}
      </Button>
    )
  },
)

const SidebarPanelView = memo(({ panel, onCollapse }: { panel: SidebarPanel; onCollapse: () => void }) => {
  const open = useOpenSidebarPanel()
  const { Body, Toolbar, Wide } = panel
  return (
    <div className="cpp-sidebar-panel">
      <Navbar style={{ paddingLeft: '0.5em', paddingRight: '0.5em' }}>
        <Navbar.Group align={Alignment.RIGHT}>
          {Toolbar ? <Toolbar /> : null}
          {Wide ? (
            <Button
              variant="minimal"
              icon="fullscreen"
              title={gt.gettext('弹出成大窗口')}
              onClick={() => open(panel)}
            />
          ) : null}
          <Button variant="minimal" icon="double-chevron-left" title={gt.gettext('收起')} onClick={onCollapse} />
        </Navbar.Group>
        <Navbar.Group align={Alignment.LEFT}>{panel.title.toString()}</Navbar.Group>
      </Navbar>
      <Body key={panel.id} />
    </div>
  )
})

export const Sidebar = memo(() => {
  const ga = useGameAdapter()
  const extraPanels = useComponents().sidebarPanels
  const panels = [aboutPanel, ...(extraPanels ?? [])].filter((p) => !p.isAvailable || p.isAvailable(ga))
  const [stored, setStored] = useAtom(sidebarStateAtom)
  const state = readSidebarState(stored)
  // Falls back only while rendering: the remembered panel comes back once its data is published
  const activeId = activePanelId(
    state,
    panels.map((p) => p.id),
  )
  const activePanel = state.open ? panels.find((p) => p.id === activeId) : undefined
  const railRef = useRef<HTMLElement>(null)

  const onRailClick = useEvent((id: string) => setStored(clickRailItem(state, activeId, id)))
  const onCollapse = useEvent(() => {
    setStored({ ...state, open: false })
    // The collapse button leaves with the panel; without this, focus would drop to the page
    requestAnimationFrame(() =>
      railRef.current?.querySelector<HTMLElement>(`[data-sidebar-panel="${CSS.escape(activeId)}"]`)?.focus(),
    )
  })

  return (
    <section className={Classes.ELEVATION_1 + ' cpp-sidebar'} style={{ width: activePanel ? 348 : 48 }}>
      <nav className="cpp-sidebar-rail" aria-label={gt.gettext('侧栏')} ref={railRef}>
        {panels.map((p) => (
          <SidebarRailItem key={p.id} panel={p} active={p === activePanel} onClick={onRailClick} />
        ))}
      </nav>
      {activePanel ? <SidebarPanelView panel={activePanel} onCollapse={onCollapse} /> : null}
    </section>
  )
})
