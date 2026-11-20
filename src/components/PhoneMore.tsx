import { Alignment, Button, Icon, Menu, MenuDivider, MenuItem, Navbar, Tag } from '@blueprintjs/core'
import { useAtom, useSetAtom } from 'jotai'
import React, { memo, useRef } from 'react'
import { useCpp } from '../Cpp'
import { useComponents } from '../hooks/useComponents'
import { LocaleMenu, getLocale } from '../locales'
import { gt } from '../pkg/gt'
import { useThemeSetting } from '../theme'
import { HELP_DOC_URL, externalLinkProps } from './AboutList'
import { ConfigMenu, RegionMenu, useHasBlobFlavours, useRegions } from './ConfigUi'
import { ImportPasteBox } from './ImportPasteBox'
import { PhoneMorePage, phoneMorePageAtom } from './phoneLayout'
import { useReloadGameData } from './reloadGameData'
import { ThemeMenu, themeIcon, themeName } from './ThemeMenu'
import { SidebarPanel } from './types'
import { UserDataManagerMenuItem } from './UserDataManager'
import { ValueOptionMenu, useValueTypeName } from './Value'

const monospace: React.CSSProperties = { fontFamily: 'monospace' }

/** 行尾：可选的小标签，再一个 ›，表示点了进下一页 */
const Next = ({ tag }: { tag?: React.ReactNode }) => (
  <span className="cpp-phone-more-next">
    {tag != null ? (
      <Tag minimal style={monospace}>
        {tag}
      </Tag>
    ) : null}
    <Icon icon="chevron-right" />
  </span>
)

const noBadge = () => false

const PanelRow = memo(({ panel, onOpen }: { panel: SidebarPanel; onOpen: (id: string) => void }) => {
  // A panel keeps its hook for as long as it is available, so the hook order never changes
  const useBadge = panel.useBadge ?? noBadge
  const badge = useBadge()
  const label = panel.label.toString()
  return (
    <MenuItem
      icon={panel.icon}
      text={
        <>
          {label}
          {badge ? <span className="cpp-phone-more-dot" aria-label={gt.gettext('有新内容')} role="img" /> : null}
        </>
      }
      labelElement={<Next />}
      onClick={() => onOpen(panel.id)}
    />
  )
})

const SoulMenuItem = memo(() => {
  const [blobFlavour, setBlobFlavour] = useAtom(useCpp().preferenceAtoms.blobFlavourAtom)
  return (
    <MenuItem
      icon="image-rotate-right"
      text="?"
      active={blobFlavour !== 'normal'}
      onClick={() => setBlobFlavour((a) => (a === 'normal' ? 'soul' : 'normal'))}
    />
  )
})

const noop = () => {}

const MoreList = memo(({ panels, onOpenPanel }: { panels: SidebarPanel[]; onOpenPanel: (id: string) => void }) => {
  const setPage = useSetAtom(phoneMorePageAtom)
  const { ImporterMenuItems, ExporterMenuItems } = useComponents()
  const pasteBoxRef = useRef<HTMLInputElement>(null)
  const valueName = useValueTypeName()
  const { regions, current: currentRegion, region } = useRegions()
  const soul = useHasBlobFlavours()
  const { updating, checkForUpdates, reload } = useReloadGameData()
  const theme = useThemeSetting()
  const go = (page: PhoneMorePage) => () => setPage(page)

  return (
    <Menu className="cpp-phone-more">
      <MenuDivider title={gt.pgettext('phone more', '数据')} />
      <ImportPasteBox inputRef={pasteBoxRef} onImported={noop} />
      {ImporterMenuItems ? (
        <MenuItem
          icon="log-in"
          text={gt.pgettext('phone more', '导入')}
          labelElement={<Next />}
          onClick={go('import')}
        />
      ) : null}
      {ExporterMenuItems ? (
        <MenuItem
          icon="log-out"
          text={gt.pgettext('phone more', '导出')}
          labelElement={<Next />}
          onClick={go('export')}
        />
      ) : null}
      <UserDataManagerMenuItem />
      <MenuDivider title={gt.pgettext('phone more', '面板')} />
      {panels.map((p) => (
        <PanelRow key={p.id} panel={p} onOpen={onOpenPanel} />
      ))}
      <MenuDivider title={gt.pgettext('phone more', '设置')} />
      <MenuItem
        icon="calculator"
        text={gt.pgettext('phone more', '价值')}
        labelElement={<Next tag={valueName} />}
        onClick={go('value')}
      />
      <MenuItem icon="properties" text={gt.gettext('选项')} labelElement={<Next />} onClick={go('options')} />
      {regions.length > 1 ? (
        <MenuItem
          icon="globe"
          text={gt.gettext('游戏服务器')}
          labelElement={<Next tag={currentRegion?.short || currentRegion?.name || region} />}
          onClick={go('region')}
        />
      ) : null}
      <MenuItem
        icon="translate"
        text={gt.gettext('界面语言')}
        labelElement={<Next tag={getLocale()} />}
        onClick={go('locale')}
      />
      <MenuItem
        icon={themeIcon(theme)}
        text={gt.gettext('外观')}
        labelElement={<Next tag={themeName(theme)} />}
        onClick={go('theme')}
      />
      {soul ? <SoulMenuItem /> : null}
      <MenuDivider title={gt.pgettext('phone more', '游戏数据')} />
      <MenuItem icon="refresh" text={gt.gettext('检查数据更新')} disabled={updating} onClick={checkForUpdates} />
      <MenuItem icon="reset" text={gt.gettext('重新下载数据')} disabled={updating} onClick={reload} />
      <MenuDivider />
      <MenuItem icon="help" text={gt.gettext('帮助文档')} href={HELP_DOC_URL} {...externalLinkProps} />
    </Menu>
  )
})

function pageTitle(page: PhoneMorePage): string {
  switch (page) {
    case 'import':
      return gt.pgettext('phone more', '导入')
    case 'export':
      return gt.pgettext('phone more', '导出')
    case 'value':
      return gt.pgettext('phone more', '价值')
    case 'options':
      return gt.gettext('选项')
    case 'region':
      return gt.gettext('游戏服务器')
    case 'locale':
      return gt.gettext('界面语言')
    case 'theme':
      return gt.gettext('外观')
  }
}

const PageBody = memo(({ page }: { page: PhoneMorePage }) => {
  const { ImporterMenuItems, ExporterMenuItems } = useComponents()
  switch (page) {
    case 'import':
      return <Menu className="cpp-phone-more">{ImporterMenuItems ? <ImporterMenuItems /> : null}</Menu>
    case 'export':
      return <Menu className="cpp-phone-more">{ExporterMenuItems ? <ExporterMenuItems /> : null}</Menu>
    case 'value':
      return <ValueOptionMenu className="cpp-phone-more" />
    case 'options':
      return <ConfigMenu className="cpp-phone-more" />
    case 'region':
      return <RegionMenu className="cpp-phone-more" />
    case 'locale':
      return <LocaleMenu className="cpp-phone-more" />
    case 'theme':
      return <ThemeMenu className="cpp-phone-more" />
  }
})

/** 手机上「更多」一页的标题栏：左边返回，后面是标题，右边可以再放控件 */
export const PhonePageHead = ({
  title,
  onBack,
  children,
}: {
  title: string
  onBack: () => void
  children?: React.ReactNode
}) => {
  const back = gt.gettext('返回')
  return (
    <Navbar className="cpp-phone-page-head">
      <Navbar.Group align={Alignment.LEFT}>
        <Button variant="minimal" icon="chevron-left" title={back} aria-label={back} onClick={onBack} />
        <Navbar.Heading>{title}</Navbar.Heading>
      </Navbar.Group>
      {children != null ? <Navbar.Group align={Alignment.RIGHT}>{children}</Navbar.Group> : null}
    </Navbar>
  )
}

/** 手机布局里侧栏那一栏：数据、面板、设置的列表；点带 › 的行进下一页，内容和桌面的弹出菜单同一个组件 */
export const PhoneMore = memo(
  ({ panels, onOpenPanel }: { panels: SidebarPanel[]; onOpenPanel: (id: string) => void }) => {
    const [page, setPage] = useAtom(phoneMorePageAtom)
    if (page == null) return <MoreList panels={panels} onOpenPanel={onOpenPanel} />
    return (
      <div className="cpp-phone-page">
        <PhonePageHead title={pageTitle(page)} onBack={() => setPage(null)} />
        <PageBody key={page} page={page} />
      </div>
    )
  },
)
