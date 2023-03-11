import { Alignment, Navbar, Menu, MenuItem, Blockquote, MenuDivider } from '@blueprintjs/core'

const externalLinkProps = {
  rel: 'noreferrer noopener',
  referrerPolicy: 'no-referrer',
  target: '_blank',
} satisfies React.AnchorHTMLAttributes<HTMLAnchorElement>

export function AboutList() {
  return (
    <>
      <Navbar>
        <Navbar.Group align={Alignment.RIGHT}></Navbar.Group>
        <Navbar.Group align={Alignment.LEFT}></Navbar.Group>
      </Navbar>
      <Menu style={{ flex: 1, flexShrink: 1, overflow: 'auto' }}>
        <MenuDivider title="鸣谢" />
        <MenuItem
          icon={'link'}
          multiline={true}
          href={'https://penguin-stats.io/'}
          {...externalLinkProps}
          text={
            <>
              企鹅物流数据统计
              <div style={{ fontWeight: 'normal', opacity: 0.75 }}>
                本工具中部分素材掉落统计数据由企鹅物流统计，采用知识共享 署名-非商业性使用 4.0 国际许可协议进行许可。
              </div>
            </>
          }
        ></MenuItem>
        <MenuItem icon={'link'} text="明日方舟一图流" href={'https://yituliu.site/'} {...externalLinkProps} />
        <MenuItem
          icon={'link'}
          text="明日方舟六星干员练度调查"
          href={'https://arknights-poll.net/'}
          {...externalLinkProps}
        />
        <MenuItem
          icon={'code'}
          text="Kengxxiao/ArknightsGameData"
          href={'https://github.com/Kengxxiao/ArknightsGameData'}
          {...externalLinkProps}
        />
        <MenuItem
          icon={'code'}
          text="yuanyan3060/Arknights-Bot-Resource"
          href={'https://github.com/yuanyan3060/Arknights-Bot-Resource'}
          {...externalLinkProps}
        />
        <MenuItem
          icon={'code'}
          text="Aceship/Arknight-Images"
          href={'https://github.com/Aceship/Arknight-Images'}
          {...externalLinkProps}
        />
      </Menu>
    </>
  )
}
