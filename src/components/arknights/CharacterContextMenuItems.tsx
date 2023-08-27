import { MenuItem } from '@blueprintjs/core'
import { memo } from 'react'
import { ICharacter } from '../../pkg/cpp-basic'
import { externalLinkProps } from '../AboutList'

export const CharacterContextMenuItems = memo(({ character }: { character: ICharacter }) => {
  return (
    <>
      <MenuItem
        {...externalLinkProps}
        icon={'id-number'}
        text={'在「PRTS.wiki」查看此干员'}
        href={`https://prts.wiki/w/${encodeURIComponent(`${character.name}`)}`}
      />
      {/* <MenuItem
        {...externalLinkProps}
        icon={'help'}
        text={'在「明日方舟 DPS 计算器」查看此干员信息'}
        href={`https://viktorlab.cn/akdata/character/#!/${encodeURIComponent(`${character.key}`)}`}
      /> */}
      <MenuItem
        {...externalLinkProps}
        icon={'calculator'}
        text={'在「明日方舟 DPS 计算器」计算此干员 DPS'}
        href={`https://viktorlab.cn/akdata/dps/#${encodeURIComponent(`${character.key}`)}`}
      />
      <MenuItem
        {...externalLinkProps}
        icon={'chart'}
        text={'在「明日方舟 DPS 计算器」计算此干员专精/模组收益'}
        href={`https://viktorlab.cn/akdata/mastery/#${encodeURIComponent(`${character.key}`)}`}
      />
    </>
  )
})
