import { MenuItem } from '@blueprintjs/core'
import { memo } from 'react'
import { useGameAdapter } from '../../Cpp'
import { ArknightsDataManager } from '../../pkg/cpp-arknights'
import { HeyboxSurveySource, YituliuSurveySource } from '../../pkg/cpp-arknights/survey'
import { gt } from '../../pkg/gt'
import { DataObjectStatus, DescriptionMenuItem, externalLinkProps } from '../AboutList'

export const AboutCopyright = memo(() => {
  return (
    <>
      <DescriptionMenuItem
        className="cpp-menu-not-interactive"
        icon={'info-sign'}
        text={gt.gettext('游戏资源')}
        description={gt.gettext(
          '本项目所使用的游戏资源（包括但不限于：游戏图片、动画、音频、文本原文或其转译版本等）仅用于更好地表现游戏资料、增强用户体验，其版权属于上海鹰角网络科技有限公司和其关联公司。',
        )}
      />
    </>
  )
})

export const AboutDataSources = memo(() => {
  const ga = useGameAdapter()
  const dm = ga.getDataManager() as ArknightsDataManager

  return (
    <>
      <DataObjectStatus
        title={`${gt.gettext('Kengxxiao 解析的游戏数据')} (zh_CN)`}
        href={'https://github.com/Kengxxiao/ArknightsGameData'}
        dataObj={dm.$kengxxiao}
      />
      {dm.$kengxxiaoLocal ? (
        <DataObjectStatus
          title={`${gt.gettext('Kengxxiao 解析的游戏数据')} (${dm.$kengxxiaoLocal.lang})`}
          href={'https://github.com/Kengxxiao/ArknightsGameData'}
          dataObj={dm.$kengxxiaoLocal}
        />
      ) : null}
      <DataObjectStatus
        title={`${gt.gettext('企鹅物流数据统计 素材掉落统计数据')} (${dm.$penguin.server})`}
        href={'https://penguin-stats.io/'}
        dataObj={dm.$penguin}
        copyright={gt.gettext(
          '本工具中部分素材掉落统计数据由企鹅物流统计，采用知识共享 署名-非商业性使用 4.0 国际许可协议进行许可。',
        )}
      />
      <DataObjectStatus
        title={gt.gettext('明日方舟一图流 材料价值数据')}
        href={'https://ark.yituliu.cn/'}
        dataObj={dm.$yituliu}
      />
      <DataObjectStatus
        title={YituliuSurveySource.Name}
        href={YituliuSurveySource.URL}
        dataObj={dm.$surveyYituliu}
        copyright={gt.gettext(
          '来自明日方舟一图流的数据，除非另有声明，采用 知识共享 署名-非商业性使用 4.0 国际 许可协议 进行许可。转载、公开或以任何形式复制、发行、再传播明日方舟一图流的任何内容时，必须注明从明日方舟一图流转载，并提供版权标识、许可协议标识、免责标识和作品链接；且未经许可，不得将本站内容或由其衍生作品用于商业目的。',
        )}
      />
      <DataObjectStatus
        title={HeyboxSurveySource.Name}
        href={HeyboxSurveySource.URL}
        dataObj={dm.$surveyHeybox}
        copyright={gt.gettext('数据整理自小黑盒 app 明日方舟干员统计功能。')}
      />
    </>
  )
})

export const AboutThirdParty = memo(() => {
  return (
    <>
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
})

export const AboutCredits = memo(() => {
  return (
    <>
      <DescriptionMenuItem
        icon={'person'}
        text="GhostShe11"
        href={'https://www.bilibili.com/read/cv25970558/'}
        {...externalLinkProps}
        description={gt.pgettext('credit role', '矢量图标绘制')}
      />
    </>
  )
})
