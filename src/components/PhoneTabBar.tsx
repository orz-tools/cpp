import { Icon } from '@blueprintjs/core'
import { useAtom } from 'jotai'
import React, { memo } from 'react'
import { gt } from '../pkg/gt'
import { PhoneArea, phoneAreaAtom } from './phoneLayout'
import { useActiveRosterPin } from './rosterPin'
import { useSidebarPanels } from './Sidebar'
import { SidebarPanel } from './types'

const tabs: { area: PhoneArea; glyph: React.ReactNode; label: () => string }[] = [
  { area: 'chars', glyph: <Icon icon="people" size={20} />, label: () => gt.pgettext('phone tab', '干员') },
  { area: 'tasks', glyph: <Icon icon="tick-circle" size={20} />, label: () => gt.pgettext('phone tab', '任务') },
  { area: 'farm', glyph: <Icon icon="map" size={20} />, label: () => gt.pgettext('phone tab', '刷图') },
  { area: 'items', glyph: <Icon icon="box" size={20} />, label: () => gt.pgettext('phone tab', '材料') },
  { area: 'more', glyph: <Icon icon="menu" size={20} />, label: () => gt.gettext('更多') },
]

const noBadge = () => false

/** 每个面板一个：调自己的 useBadge，有新内容时画一个点；几个点叠在同一处，看上去就是一个 */
const PanelBadgeDot = memo(({ panel }: { panel: SidebarPanel }) => {
  // A panel keeps its hook for as long as it is available, so the hook order never changes
  const useBadge = panel.useBadge ?? noBadge
  return useBadge() ? <span className="cpp-phone-tab-dot" aria-hidden /> : null
})

/** 手机布局底部的五个区域；侧栏面板收窄了干员列表而人不在「干员」时，「干员」上亮蓝点 */
export const PhoneTabBar = memo(() => {
  const [area, setArea] = useAtom(phoneAreaAtom)
  const panels = useSidebarPanels()
  const pinned = useActiveRosterPin() != null
  return (
    <nav className="cpp-phone-tabbar" aria-label={gt.pgettext('phone tab', '区域')}>
      {tabs.map((tab) => {
        const current = tab.area === area
        return (
          <button
            key={tab.area}
            type="button"
            className={'cpp-phone-tab' + (current ? ' is-current' : '')}
            aria-current={current ? 'page' : undefined}
            onClick={() => setArea(tab.area)}
          >
            <span className="cpp-phone-tab-icon">
              {tab.glyph}
              {tab.area === 'more' ? panels.map((p) => <PanelBadgeDot key={p.id} panel={p} />) : null}
              {tab.area === 'chars' && pinned && !current ? (
                <span className="cpp-phone-tab-dot is-pin" aria-hidden />
              ) : null}
            </span>
            <span className="cpp-phone-tab-label">{tab.label()}</span>
          </button>
        )
      })}
    </nav>
  )
})
