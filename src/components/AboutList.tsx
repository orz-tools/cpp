import { Alignment, Menu, MenuDivider, MenuItem, Navbar } from '@blueprintjs/core'
import { MenuItem2 } from '@blueprintjs/popover2'
import { format } from 'date-fns'
import { useCpp } from '../Cpp'
import { useComponents } from '../hooks/useComponents'
import { DataContainerObject } from '../pkg/dccache'

export const externalLinkProps = {
  rel: 'noreferrer noopener',
  referrerPolicy: 'no-referrer',
  target: '_blank',
} satisfies React.AnchorHTMLAttributes<HTMLAnchorElement>

export function AboutList() {
  const { AboutCopyright, AboutCredits, AboutThirdParty, AboutDataSources } = useComponents()
  return (
    <>
      <Navbar>
        <Navbar.Group align={Alignment.RIGHT} />
        <Navbar.Group align={Alignment.LEFT}>关于</Navbar.Group>
      </Navbar>
      <Menu style={{ flex: 1, flexShrink: 1, overflow: 'auto' }}>
        <MenuDivider title="警告" />
        <DescriptionMenuItem
          className="cpp-menu-not-interactive"
          icon={'warning-sign'}
          text="数据千万条，备份第一条"
          description="此工具仍在缓慢开发中。虽然一般不会丢，但请随时做好丢失数据的准备。您已被建议经常使用“用户数据管理”中的“导出为文件”功能……"
        />
        <MenuDivider title="联系" />
        <MenuItem
          icon={'people'}
          multiline={true}
          href={
            'http://qm.qq.com/cgi-bin/qm/qr?_wv=1027&k=zFTyI8xNj6mivBd_h6hEoG3tRTPipBbH&authKey=jdONrgUlL5FP4QyYbxFJN46RSB2kr5IHYqmtEbzhegfTYGl%2FSH3tZqZpzMUDTa22&noverify=0&group_code=897997981'
          }
          {...externalLinkProps}
          text={
            <>
              QQ 交流群<span style={{ marginLeft: '0.5em', fontWeight: 300 }}>897997981</span>
            </>
          }
        />
        <MenuItem
          icon={'envelope'}
          multiline={true}
          href={'mailto:cpp@ouomail.com'}
          {...externalLinkProps}
          text={
            <>
              邮箱
              <span style={{ userSelect: 'text', marginLeft: '0.5em', fontWeight: 300 }}>cpp@ouomail.com</span>
            </>
          }
        />
        <MenuDivider title="数据源" />
        {AboutDataSources && <AboutDataSources />}
        <MenuDivider title="其他" />
        {AboutThirdParty && <AboutThirdParty />}
        <MenuItem
          icon={'font'}
          text="Source Han Sans"
          href={
            'https://github.com/adobe-fonts/source-han-sans/blob/e3bfa7062185d1ec689b07b9236e108a9a00e9c5/LICENSE.txt'
          }
          {...externalLinkProps}
        />
        <MenuDivider title="声明" />
        {AboutCopyright && <AboutCopyright />}
        <MenuDivider title="鸣谢" />
        {AboutCredits && <AboutCredits />}
        <DescriptionMenuItem
          icon={'person'}
          text="西園寺玲咲 (SaionjiReisaki)"
          href={'https://github.com/SaionjiReisaki/'}
          {...externalLinkProps}
          description={'数据源自动化'}
        />
      </Menu>
    </>
  )
}

export function DescriptionMenuItem(props: MenuItem2['props'] & { description?: React.ReactNode }) {
  const p = Object.assign({}, props)
  delete p.description
  return (
    <>
      <MenuItem2 {...p} />
      {props.description != null ? (
        <Menu className="cpp-menu-indent">
          <MenuItem
            className="cpp-menu-not-interactive"
            multiline={true}
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
}

export function DataObjectStatus({
  title,
  href,
  dataObj,
  copyright,
}: {
  title?: string
  href?: string
  dataObj: DataContainerObject<any>
  copyright?: React.ReactNode
}) {
  const cpp = useCpp()
  const dm = cpp.gameAdapter.getDataManager()
  const data = dm.get(dataObj)
  const showCommit =
    data.version.text &&
    data.version.text.trim() !== new Date(data.version.timestamp).toJSON() &&
    data.version.text.trim() !== new Date(data.version.timestamp).toJSON().replace(/\.\d+/g, '')
  return (
    <>
      <MenuItem2 icon={'database'} text={title} title={title} href={href || data.version.sources[0] || undefined} />
      <Menu className="cpp-menu-indent">
        <MenuItem2
          className="cpp-menu-not-interactive"
          text={
            <div className="cpp-menu-secondary" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
              <span style={{ flex: 1 }}>更新于 {format(data.version.timestamp, 'yyyy-MM-dd HH:mm:ss')}</span>
              {/* <Button
                minimal
                icon={<Icon icon="refresh" size={10} />}
                style={{ minWidth: 0, minHeight: 0, padding: '0px 2px', fontSize: 10.5 }}
              >
                更新
              </Button> */}
            </div>
          }
        />
        {showCommit ? (
          <MenuItem2
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
          <MenuItem2
            multiline={true}
            className="cpp-menu-not-interactive"
            text={<div className="cpp-menu-secondary">{copyright}</div>}
          />
        ) : null}
      </Menu>
    </>
  )
}
