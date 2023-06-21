import { MenuItem } from '@blueprintjs/core'
import { externalLinkProps } from '../AboutList'

export function AboutCopyright() {
  return (
    <MenuItem
      multiline={true}
      text={
        <>
          <div style={{ fontWeight: 'normal', opacity: 0.75 }}>
            本项目所使用的游戏资源（包括但不限于：游戏图片、动画、音频、文本原文或其转译版本等）仅用于更好地表现游戏资料、增强用户体验，其版权属于广州深蓝互动网络科技有限公司和其关联公司。
          </div>
        </>
      }
    ></MenuItem>
  )
}

export function AboutCredits() {
  return (
    <>
      <MenuItem
        icon={'link'}
        multiline={true}
        href={'https://nga.178.com/read.php?tid=36522605'}
        {...externalLinkProps}
        text={
          <>
            伴春风而归的材料掉率共建表
            <div style={{ fontWeight: 'normal', opacity: 0.75 }}>
              本表格采用知识共享 署名-非商业性使用 4.0 国际
              许可协议进行许可。转载、公开或以任何形式复制、发行、再传播本表格任何内容时，必须注明从伴春风而归的材料掉率共建表转载，并提供版权标识、许可协议标识、免责标识和作品链接；且未经许可，不得将本表格内容或由其衍生作品用于商业目的。
            </div>
          </>
        }
      ></MenuItem>
      <MenuItem
        icon={'code'}
        text="yuanyan3060/Reverse1999Resource"
        href={'https://github.com/yuanyan3060/Reverse1999Resource'}
        {...externalLinkProps}
      />
    </>
  )
}
