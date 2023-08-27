import { memo } from 'react'
import { useGameAdapter } from '../../Cpp'
import { Re1999DataManager } from '../../pkg/cpp-re1999'
import { DataObjectStatus, DescriptionMenuItem } from '../AboutList'

export const AboutCopyright = memo(() => {
  return (
    <>
      <DescriptionMenuItem
        className="cpp-menu-not-interactive"
        icon={'info-sign'}
        text="游戏资源"
        description="本项目所使用的游戏资源（包括但不限于：游戏图片、动画、音频、文本原文或其转译版本等）仅用于更好地表现游戏资料、增强用户体验，其版权属于广州深蓝互动网络科技有限公司和其关联公司。"
      />
    </>
  )
})

export const AboutDataSources = memo(() => {
  const ga = useGameAdapter()
  const dm = ga.getDataManager() as Re1999DataManager

  return (
    <>
      <DescriptionMenuItem
        intent="danger"
        icon="error"
        text="数据滞后警告"
        className="cpp-menu-not-interactive"
        description={
          <>
            由于之前提供的游戏数据的好心人已删库跑路，未缓存的图片资源将无法正常载入。至于游戏数据，有个别的好心人随缘更新。
            <br />
            <br />
            如果您能稳定提供游戏数据和图片资源，欢迎您和我们联系。
            <br />
            <br />
            此外，点击左上角 Logo 中的 <code>[REVERSE1999]</code>{' '}
            字样，在菜单中返回主页后，可以切换到本工具支持的其他游戏。祝您在本工具支持的其他游戏中也算的愉快！
          </>
        }
      />
      <DataObjectStatus title="另一个好心人提供的游戏数据" href={null} dataObj={dm.$yy} />
      <DataObjectStatus
        title="伴春风而归的材料掉率共建表"
        href={'https://nga.178.com/read.php?tid=36522605'}
        dataObj={dm.$drops}
        copyright={
          '本表格采用知识共享 署名-非商业性使用 4.0 国际 许可协议进行许可。转载、公开或以任何形式复制、发行、再传播本表格任何内容时，必须注明从伴春风而归的材料掉率共建表转载，并提供版权标识、许可协议标识、免责标识和作品链接；且未经许可，不得将本表格内容或由其衍生作品用于商业目的。'
        }
      />
      <DataObjectStatus
        title="材料价值数据"
        href={'https://nga.178.com/read.php?tid=36522605'}
        dataObj={dm.$values}
        copyright="也来源于伴春风而归的材料掉率共建表，效率与价值算法主要由 pu4ers 贡献。"
      />
    </>
  )
})

export const AboutCredits = memo(() => {
  return (
    <>
      <DescriptionMenuItem
        icon={'people'}
        text="1999统计苦力群 群友"
        className="cpp-menu-not-interactive"
        description="测试和建议"
      />
    </>
  )
})

export const AboutThirdParty = memo(() => {
  return <></>
})
