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
        <MenuItem
          multiline={true}
          text={
            <>
              <div style={{ fontWeight: 'normal', opacity: 0.75 }}>
                本项目所使用的游戏资源（包括但不限于：游戏图片、动画、音频、文本原文或其转译版本等）仅用于更好地表现游戏资料、增强用户体验，其版权属于上海鹰角网络科技有限公司和其关联公司。
              </div>
            </>
          }
        ></MenuItem>
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
