import { Alignment, Button, Classes, Navbar } from '@blueprintjs/core'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import { memo, useRef } from 'react'
import useEvent from 'react-use-event-hook'
import { useGameAdapter } from '../Cpp'
import { useComponents } from '../hooks/useComponents'
import { gt } from '../pkg/gt'
import { aboutPanel } from './AboutList'
import { useCloseCharacterDossier } from './dossierHooks'
import { PhoneMore, PhonePageHead } from './PhoneMore'
import { phoneAreaAtom, phoneMorePageAtom, usePhoneLayout } from './phoneLayout'
import { useOpenSidebarPanel } from './SidebarPanelDialog'
import { SidebarState, activePanelId, clickRailItem, defaultSidebarState, readSidebarState } from './sidebarState'
import { SidebarPanel } from './types'

const sidebarStateAtom = atomWithStorage<unknown>('cpp_sidebar', null, undefined, { getOnInit: true })

/**
 * 展开侧栏并切到这个面板，例如档案里的「在侧栏里看」；档案是没有遮罩的抽屉，侧栏露在外面，所以不用关档案。
 * 手机上面板在「更多」里，档案盖满一屏，所以切到「更多」、关上档案
 */
export function useShowSidebarPanel(): (id: string) => void {
  const setStored = useSetAtom(sidebarStateAtom)
  const phone = usePhoneLayout()
  const setArea = useSetAtom(phoneAreaAtom)
  const setPage = useSetAtom(phoneMorePageAtom)
  const closeDossier = useCloseCharacterDossier()
  return useEvent((id: string) => {
    setStored({ open: true, panel: id } satisfies SidebarState)
    if (!phone) return
    setArea('more')
    setPage(null)
    closeDossier()
  })
}

/** 手机上回到「更多」的列表：关上开着的面板页和子页，例如更新笔记里指向「导入/导出」的那一条 */
export function useShowPhoneMoreList(): () => void {
  const setStored = useSetAtom(sidebarStateAtom)
  const setArea = useSetAtom(phoneAreaAtom)
  const setPage = useSetAtom(phoneMorePageAtom)
  return useEvent(() => {
    setStored((stored: unknown) => ({ ...readSidebarState(stored), open: false }) satisfies SidebarState)
    setArea('more')
    setPage(null)
  })
}

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

const SidebarPanelView = memo(
  ({ panel, onCollapse, phone }: { panel: SidebarPanel; onCollapse: () => void; phone: boolean }) => {
    const open = useOpenSidebarPanel()
    const { Body, Toolbar, Wide } = panel
    // 手机上占满一屏，返回回到「更多」的列表；不弹大窗口，「查看更多…」这类链接照样打开全屏的大窗口
    if (phone) {
      return (
        <div className="cpp-sidebar-panel">
          <PhonePageHead title={panel.title.toString()} onBack={onCollapse}>
            {Toolbar ? <Toolbar /> : null}
          </PhonePageHead>
          <Body key={panel.id} />
        </div>
      )
    }
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
  },
)

/** 「关于」和游戏的面板里，现在可用的那些；侧栏、手机的「更多」和它标签上的红点共用 */
export function useSidebarPanels(): SidebarPanel[] {
  const ga = useGameAdapter()
  const extraPanels = useComponents().sidebarPanels
  return [aboutPanel, ...(extraPanels ?? [])].filter((p) => !p.isAvailable || p.isAvailable(ga))
}

export const Sidebar = memo(() => {
  const panels = useSidebarPanels()
  const [stored, setStored] = useAtom(sidebarStateAtom)
  const phone = usePhoneLayout()
  // 第一次在手机上打开「更多」先看到列表；桌面上第一次打开时侧栏展开着「关于」
  const state = phone && stored == null ? { ...defaultSidebarState, open: false } : readSidebarState(stored)
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

  const current = useAtomValue(phoneAreaAtom) === 'more'
  const onOpenPanel = useEvent((id: string) => setStored({ open: true, panel: id } satisfies SidebarState))
  if (phone) {
    return (
      <section data-area="more" className={Classes.ELEVATION_1 + ' cpp-sidebar' + (current ? ' is-phone-current' : '')}>
        {activePanel ? (
          <SidebarPanelView panel={activePanel} onCollapse={onCollapse} phone />
        ) : (
          <PhoneMore panels={panels} onOpenPanel={onOpenPanel} />
        )}
      </section>
    )
  }
  return (
    <section
      data-area="more"
      className={Classes.ELEVATION_1 + ' cpp-sidebar'}
      style={{ width: activePanel ? 348 : 48 }}
    >
      <nav className="cpp-sidebar-rail" aria-label={gt.gettext('侧栏')} ref={railRef}>
        {panels.map((p) => (
          <SidebarRailItem key={p.id} panel={p} active={p === activePanel} onClick={onRailClick} />
        ))}
      </nav>
      {activePanel ? <SidebarPanelView panel={activePanel} onCollapse={onCollapse} phone={false} /> : null}
    </section>
  )
})
