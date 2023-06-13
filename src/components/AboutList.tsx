import { Alignment, Navbar, Menu, MenuItem, Blockquote, MenuDivider } from '@blueprintjs/core'
import { useComponents } from '../hooks/useComponents'

export const externalLinkProps = {
  rel: 'noreferrer noopener',
  referrerPolicy: 'no-referrer',
  target: '_blank',
} satisfies React.AnchorHTMLAttributes<HTMLAnchorElement>

export function AboutList() {
  const { AboutCopyright, AboutCredits } = useComponents()
  return (
    <>
      <Navbar>
        <Navbar.Group align={Alignment.RIGHT}></Navbar.Group>
        <Navbar.Group align={Alignment.LEFT}>关于</Navbar.Group>
      </Navbar>
      <Menu style={{ flex: 1, flexShrink: 1, overflow: 'auto' }}>
        <MenuDivider title="联系" />
        <MenuItem
          icon={'envelope'}
          multiline={true}
          href={'mailto:cpp@ouomail.com'}
          {...externalLinkProps}
          text={<span style={{ userSelect: 'text' }}>cpp@ouomail.com</span>}
        ></MenuItem>
        <MenuDivider title="警告" />
        <MenuItem
          multiline={true}
          text={
            <>
              <div style={{ fontWeight: 'normal', opacity: 0.75 }}>
                此工具仍在缓慢开发中，虽然不应该发生，但请随时做好丢失数据的准备，可以没事先自己备份备份 localStorage……
              </div>
            </>
          }
        ></MenuItem>
        <MenuDivider title="声明" />
        {AboutCopyright && <AboutCopyright />}
        <MenuDivider title="鸣谢" />
        {AboutCredits && <AboutCredits />}
        <MenuItem
          icon={'font'}
          text="Source Han Sans"
          href={
            'https://github.com/adobe-fonts/source-han-sans/blob/e3bfa7062185d1ec689b07b9236e108a9a00e9c5/LICENSE.txt'
          }
          {...externalLinkProps}
        />
      </Menu>
    </>
  )
}
