import { MenuItem } from '@blueprintjs/core'
import { memo } from 'react'
import { ICharacter } from '../../pkg/cpp-basic'
import { externalLinkProps } from '../AboutList'
import links from './links.json'

const sanitizeName = (s: string) =>
  String(s || '')
    .toLowerCase()
    .replace(/[_.·・]|\s/g, '')

export const CharacterContextMenuItems = memo(({ character }: { character: ICharacter }) => {
  const gamekee = links.gamekee.find((x) => sanitizeName(x.name) === sanitizeName(character.name))

  return (
    <>
      <MenuItem
        {...externalLinkProps}
        icon={'id-number'}
        text={'在「灰机wiki」查看此角色'}
        href={`https://res1999.huijiwiki.com/wiki/${encodeURIComponent(`${character.name}`)}`}
      />
      {gamekee ? (
        <MenuItem
          {...externalLinkProps}
          icon={'id-number'}
          text={'在「逆流的Rainstorm WIKI攻略组」查看此角色'}
          href={gamekee.url}
        />
      ) : null}
      <MenuItem
        {...externalLinkProps}
        icon={'search'}
        text={'在「逆流的Rainstorm WIKI攻略组」搜索此角色名'}
        href={`https://reverse1999.gamekee.com/list?kw=${encodeURIComponent(`${character.name}`)}&tab=1`}
      />
    </>
  )
})
