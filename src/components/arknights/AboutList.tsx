import { MenuItem } from '@blueprintjs/core'
import { useGameAdapter } from '../../Cpp'
import { ArknightsDataManager } from '../../pkg/cpp-arknights'
import { DataObjectStatus, DescriptionMenuItem, externalLinkProps } from '../AboutList'

export function AboutCopyright() {
  return (
    <>
      <DescriptionMenuItem
        className="cpp-menu-not-interactive"
        icon={'info-sign'}
        text="游戏资源"
        description="本项目所使用的游戏资源（包括但不限于：游戏图片、动画、音频、文本原文或其转译版本等）仅用于更好地表现游戏资料、增强用户体验，其版权属于上海鹰角网络科技有限公司和其关联公司。"
      />
    </>
  )
}

export function AboutDataSources() {
  const ga = useGameAdapter()
  const dm = ga.getDataManager() as ArknightsDataManager

  return (
    <>
      <DataObjectStatus
        title="Kengxxiao 解析的游戏数据"
        href={'https://github.com/Kengxxiao/ArknightsGameData'}
        dataObj={dm.$kengxxiao}
      />
      <DataObjectStatus
        title="企鹅物流数据统计 素材掉落统计数据"
        href={'https://penguin-stats.io/'}
        dataObj={dm.$penguin}
        copyright={
          '本工具中部分素材掉落统计数据由企鹅物流统计，采用知识共享 署名-非商业性使用 4.0 国际许可协议进行许可。'
        }
      />
      <DataObjectStatus title="明日方舟一图流 材料价值数据" href={'https://yituliu.site/'} dataObj={dm.$yituliu} />
    </>
  )
}

export function AboutThirdParty() {
  return (
    <>
      {/* <MenuItem
        icon={'link'}
        text="明日方舟六星干员练度调查"
        href={'https://arknights-poll.net/'}
        {...externalLinkProps}
      /> */}
      <MenuItem
        icon={'media'}
        text="yuanyan3060/Arknights-Bot-Resource"
        href={'https://github.com/yuanyan3060/Arknights-Bot-Resource'}
        {...externalLinkProps}
      />
      <MenuItem
        icon={'media'}
        text="Aceship/Arknight-Images"
        href={'https://github.com/Aceship/Arknight-Images'}
        {...externalLinkProps}
      />
    </>
  )
}

export function AboutCredits() {
  return <></>
}
