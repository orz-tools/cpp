import { AnchorButton, Menu, MenuDivider, MenuItem, MenuItemProps } from '@blueprintjs/core'
import { format } from 'date-fns'
import { memo } from 'react'
import useEvent from 'react-use-event-hook'
import { useGameAdapter } from '../Cpp'
import { useComponents } from '../hooks/useComponents'
import { DataContainerObject } from '../pkg/dccache'
import { PSTR, gt, lpstr } from '../pkg/gt'
import { FullLogList, SimpleLogList, useChangelogBadge, useMarkChangelogSeen } from './LogList'
import { useMissingData } from './MissingData'
import { useOpenSidebarPanel } from './SidebarPanelDialog'
import { SidebarPanel } from './types'

export const externalLinkProps = {
  rel: 'noreferrer noopener',
  referrerPolicy: 'no-referrer',
  target: '_blank',
  onContextMenu: (e) => {
    e.stopPropagation()
  },
} satisfies React.AnchorHTMLAttributes<HTMLAnchorElement>

/** 「关于」、顶栏的帮助按钮和手机「更多」里的帮助文档共用 */
export const HELP_DOC_URL = 'https://alidocs.dingtalk.com/i/p/OlnXRJreeRDKAXLp'

const AboutLinks = memo(() => {
  const { AboutCopyright, AboutCredits, AboutThirdParty, AboutDataSources, email } = useComponents()
  const realEmail = email || 'cpp@ouomail.com'

  return (
    <>
      <MenuDivider title={gt.gettext('帮助与社区')} />
      <MenuItem href={HELP_DOC_URL} icon="help" text={gt.gettext('帮助文档')} {...externalLinkProps} />
      <MenuItem
        icon={'chat'}
        multiline={true}
        href={'https://discord.gg/vsgEuT6VBJ'}
        {...externalLinkProps}
        text={<>{gt.gettext('Discord')}</>}
      />
      <MenuItem
        icon={'people'}
        multiline={true}
        href={
          'http://qm.qq.com/cgi-bin/qm/qr?_wv=1027&k=zFTyI8xNj6mivBd_h6hEoG3tRTPipBbH&authKey=jdONrgUlL5FP4QyYbxFJN46RSB2kr5IHYqmtEbzhegfTYGl%2FSH3tZqZpzMUDTa22&noverify=0&group_code=897997981'
        }
        {...externalLinkProps}
        text={
          <>
            {gt.gettext('QQ 交流群')}
            <span style={{ marginLeft: '0.5em', fontWeight: 300 }}>897997981</span>
          </>
        }
      />
      <MenuItem
        icon={'envelope'}
        multiline={true}
        href={'mailto:' + realEmail}
        {...externalLinkProps}
        text={
          <>
            {gt.gettext('邮箱')}
            <span style={{ userSelect: 'text', marginLeft: '0.5em', fontWeight: 300 }}>{realEmail}</span>
          </>
        }
      />
      <MenuItem
        icon={'git-repo'}
        multiline={true}
        href={'https://github.com/orz-tools/cpp'}
        {...externalLinkProps}
        text={
          <>
            GitHub
            <span style={{ marginLeft: '0.5em', fontWeight: 300 }}>AGPL-3.0-or-later</span>
          </>
        }
      />
      <MenuDivider title={gt.gettext('数据源')} />
      {AboutDataSources && <AboutDataSources />}
      <MenuDivider title={gt.gettext('其他资源')} />
      {AboutThirdParty && <AboutThirdParty />}
      <MenuItem
        icon={'font'}
        text="Source Han Sans"
        href={
          'https://github.com/adobe-fonts/source-han-sans/blob/e3bfa7062185d1ec689b07b9236e108a9a00e9c5/LICENSE.txt'
        }
        {...externalLinkProps}
      />
      <MenuDivider title={gt.gettext('鸣谢')} />
      <DescriptionMenuItem
        icon={'person'}
        text="西園寺玲咲 (SaionjiReisaki)"
        href={'https://github.com/SaionjiReisaki/'}
        {...externalLinkProps}
        description={gt.pgettext('credit role', '数据源自动化、氛围开发')}
      />
      {AboutCredits && <AboutCredits />}
      <DescriptionMenuItem
        icon={'person'}
        text="若淇未央"
        {...externalLinkProps}
        description={gt.pgettext('credit role', '帮助文档撰写')}
      />
      <MenuDivider title={gt.gettext('声明')} />
      {AboutCopyright && <AboutCopyright />}
    </>
  )
})

const AboutPanelBody = memo(() => {
  useMarkChangelogSeen()
  const open = useOpenSidebarPanel()
  const openWide = useEvent(() => open(aboutPanel))
  return (
    <Menu style={{ flex: 1, flexShrink: 1, overflow: 'auto' }}>
      <SimpleLogList onMore={openWide} />
      <AboutLinks />
    </Menu>
  )
})

const AboutWide = memo(() => {
  useMarkChangelogSeen()
  return (
    <div className="cpp-about-wide">
      <Menu>
        <MenuDivider title={gt.gettext('更新笔记')} />
        <FullLogList />
      </Menu>
      <Menu>
        <AboutLinks />
      </Menu>
    </div>
  )
})

export const aboutPanel: SidebarPanel = {
  id: 'about',
  icon: 'info-sign',
  label: lpstr(() => gt.gettext('关于')),
  title: lpstr(() => gt.gettext('关于')),
  Body: AboutPanelBody,
  Wide: AboutWide,
  useBadge: useChangelogBadge,
}

export const DescriptionMenuItem = memo((props: MenuItemProps & { description?: React.ReactNode }) => {
  const p = Object.assign({}, props)
  delete p.description
  return (
    <>
      <MenuItem className={!props.href && !props.onClick ? 'cpp-menu-not-interactive' : undefined} {...p} />
      {props.description != null ? (
        <Menu className="cpp-menu-indent">
          <MenuItem
            className="cpp-menu-not-interactive"
            multiline={true}
            intent={props.intent}
            text={
              <>
                <div className="cpp-menu-secondary">{props.description}</div>
              </>
            }
          />
        </Menu>
      ) : null}
    </>
  )
})

export const DataObjectStatus = memo(
  ({
    title,
    href,
    dataObj,
    copyright,
    notes,
    hideCommit,
  }: {
    title?: PSTR
    href?: string | null
    dataObj: DataContainerObject<any>
    copyright?: React.ReactNode
    notes?: React.ReactNode
    hideCommit?: boolean
  }) => {
    const dm = useGameAdapter().getDataManager()
    const { missing, loading, retry } = useMissingData(dataObj)
    const data = missing ? undefined : dm.get(dataObj)
    const shouldShowCommit =
      data &&
      !hideCommit &&
      data.version.text &&
      data.version.text.trim() !== new Date(data.version.timestamp).toJSON() &&
      data.version.text.trim() !== new Date(data.version.timestamp).toJSON().replace(/\.\d+/g, '')
    const finalHref = href == null ? undefined : href || data?.version.sources[0] || undefined
    return (
      <>
        <MenuItem
          icon={'database'}
          text={title?.toString()}
          title={title?.toString()}
          href={finalHref}
          className={finalHref ? '' : 'cpp-menu-not-interactive'}
          {...externalLinkProps}
        />
        <Menu className="cpp-menu-indent">
          {data ? (
            <MenuItem
              className="cpp-menu-not-interactive"
              text={
                <div
                  className="cpp-menu-secondary"
                  style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}
                >
                  <span style={{ flex: 1 }}>
                    {gt
                      .gettext('更新于 %s') /* I10N: %s: datetime */
                      .replaceAll('%s', format(data.version.timestamp, 'yyyy-MM-dd HH:mm:ss'))}
                  </span>
                </div>
              }
            />
          ) : (
            <>
              <MenuItem
                className="cpp-menu-not-interactive"
                intent="danger"
                text={gt.pgettext('missing data', '载入失败')}
              />
              <MenuItem
                icon="refresh"
                text={gt.pgettext('missing data', '重试')}
                disabled={loading}
                shouldDismissPopover={false}
                onClick={retry}
              />
            </>
          )}
          {data && shouldShowCommit ? (
            <MenuItem
              multiline={true}
              href={data.version.sources[0] || undefined}
              {...externalLinkProps}
              className={data.version.sources[0] ? '' : 'cpp-menu-not-interactive'}
              text={
                <pre className="cpp-menu-secondary" style={{ whiteSpace: 'pre-wrap', margin: 0, padding: 0 }}>
                  {data.version.text}
                </pre>
              }
            />
          ) : null}
          {notes ? (
            <MenuItem
              multiline={true}
              className="cpp-menu-not-interactive"
              text={<div className="cpp-menu-secondary">{notes}</div>}
            />
          ) : null}
          {copyright ? (
            <MenuItem
              multiline={true}
              className="cpp-menu-not-interactive"
              text={<div className="cpp-menu-secondary">{copyright}</div>}
            />
          ) : null}
        </Menu>
      </>
    )
  },
)

export const HelpButton = memo(() => {
  return (
    <AnchorButton
      href={HELP_DOC_URL}
      icon="help"
      variant="minimal"
      text={<span className="cpp-very-compact">{gt.gettext('帮助')}</span>}
      {...externalLinkProps}
    />
  )
})
