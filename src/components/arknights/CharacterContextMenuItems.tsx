import { MenuItem } from '@blueprintjs/core'
import { memo } from 'react'
import { Character } from '../../pkg/cpp-arknights'
import { ICharacter } from '../../pkg/cpp-basic'
import { externalLinkProps } from '../AboutList'

export const CharacterContextMenuItems = memo(({ character: char }: { character: ICharacter }) => {
  const character = char as Character
  return (
    <>
      <MenuItem
        {...externalLinkProps}
        icon={'id-number'}
        text={'在「PRTS.wiki」查看此干员'}
        href={`https://prts.wiki/w/${encodeURIComponent(`${character.raw.name}`)}`}
      />
    </>
  )
})
