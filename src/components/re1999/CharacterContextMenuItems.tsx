import { MenuItem } from '@blueprintjs/core'
import { memo } from 'react'
import { Character } from '../../pkg/cpp-re1999'
import { externalLinkProps } from '../AboutList'
import links from './links.json'

const sanitizeName = (s: string) =>
  String(s || '')
    .toLowerCase()
    .replace(/[_.·・]|\s/g, '')

export const CharacterContextMenuItems = memo(({ character }: { character: Character }) => {
  const gamekee = links.gamekee.find((x) => sanitizeName(x.name) === sanitizeName(character.raw.name))

  return (
    <>
      <MenuItem
        {...externalLinkProps}
        icon={'id-number'}
        text={'在「灰机wiki」查看此角色'}
        href={`https://res1999.huijiwiki.com/wiki/${encodeURIComponent(`${character.raw.name}`)}`}
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
        href={`https://reverse1999.gamekee.com/list?kw=${encodeURIComponent(`${character.raw.name}`)}&tab=1`}
      />
    </>
  )
})
