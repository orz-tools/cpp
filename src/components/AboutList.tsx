import { Alignment, AnchorButton, Menu, MenuDivider, MenuItem, MenuItemProps, Navbar } from '@blueprintjs/core'
import { format } from 'date-fns'
import { memo } from 'react'
import { useCpp } from '../Cpp'
import { useComponents } from '../hooks/useComponents'
import { DataContainerObject } from '../pkg/dccache'
import { PSTR, gt } from '../pkg/gt'
import { SimpleLogList } from './LogList'

export const externalLinkProps = {
  rel: 'noreferrer noopener',
  referrerPolicy: 'no-referrer',
  target: '_blank',
  onContextMenu: (e) => {
    e.stopPropagation()
  },
} satisfies React.AnchorHTMLAttributes<HTMLAnchorElement>

export const AboutList = memo(() => {
  const { AboutCopyright, AboutCredits, AboutThirdParty, AboutDataSources, email } = useComponents()
  const realEmail = email || 'cpp@ouomail.com'

  return (
    <>
      <Navbar>
        <Navbar.Group align={Alignment.RIGHT} />
        <Navbar.Group align={Alignment.LEFT}>{gt.gettext('关于')}</Navbar.Group>
      </Navbar>
      <Menu style={{ flex: 1, flexShrink: 1, overflow: 'auto' }}>
        <SimpleLogList />
        <MenuDivider title={gt.gettext('帮助与社区')} />
        <MenuItem
          href="https://alidocs.dingtalk.com/i/p/OlnXRJreeRDKAXLp"
          icon="help"
          text={gt.gettext('帮助文档')}
          {...externalLinkProps}
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
        <MenuDivider title={gt.gettext('声明')} />
        {AboutCopyright && <AboutCopyright />}
        <MenuDivider title={gt.gettext('鸣谢')} />
        {AboutCredits && <AboutCredits />}
        <DescriptionMenuItem
          icon={'person'}
          text="若淇未央"
          {...externalLinkProps}
          description={gt.pgettext('credit role', '帮助文档撰写')}
        />
        <DescriptionMenuItem
          icon={'person'}
          text="西園寺玲咲 (SaionjiReisaki)"
          href={'https://github.com/SaionjiReisaki/'}
          {...externalLinkProps}
          description={gt.pgettext('credit role', '数据源自动化')}
        />
      </Menu>
    </>
  )
})

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
    hideCommit,
  }: {
    title?: PSTR
    href?: string | null
    dataObj: DataContainerObject<any>
    copyright?: React.ReactNode
    hideCommit?: boolean
  }) => {
    const cpp = useCpp()
    const dm = cpp.gameAdapter.getDataManager()
    const data = dm.get(dataObj)
    const shouldShowCommit =
      !hideCommit &&
      data.version.text &&
      data.version.text.trim() !== new Date(data.version.timestamp).toJSON() &&
      data.version.text.trim() !== new Date(data.version.timestamp).toJSON().replace(/\.\d+/g, '')
    const finalHref = href == null ? undefined : href || data.version.sources[0] || undefined
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
          <MenuItem
            className="cpp-menu-not-interactive"
            text={
              <div
                className="cpp-menu-secondary"
                style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}
              >
                <span style={{ flex: 1 }}>
                  {gt.gettext('更新于 %s').replaceAll('%s', format(data.version.timestamp, 'yyyy-MM-dd HH:mm:ss'))}
                </span>
              </div>
            }
          />
          {shouldShowCommit ? (
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
      href="https://alidocs.dingtalk.com/i/p/OlnXRJreeRDKAXLp"
      icon="help"
      minimal={true}
      text={gt.gettext('帮助')}
      {...externalLinkProps}
    />
  )
})
