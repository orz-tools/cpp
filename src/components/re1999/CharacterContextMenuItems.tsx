import { MenuItem } from '@blueprintjs/core'
import { memo } from 'react'
import { ICharacter } from '../../pkg/cpp-basic'
import { Character } from '../../pkg/cpp-re1999'
import { externalLinkProps } from '../AboutList'
import links from './links.json'

const sanitizeName = (s: string) =>
  String(s || '')
    .toLowerCase()
    .replace(/[_.·・]|\s/g, '')

export const CharacterContextMenuItems = memo(({ character: char }: { character: ICharacter }) => {
  const character = char as Character
  const gamekee = links.gamekee.find((x) => sanitizeName(x.name) === sanitizeName(character.raw.name))
  const specialName = { Six: '6', 'Thirty-seven': '37' } as Record<string, string>
  const nameEng = Object.prototype.hasOwnProperty.call(specialName, character.raw.nameEng)
    ? specialName[character.raw.nameEng]
    : character.raw.nameEng

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
      <MenuItem
        {...externalLinkProps}
        icon={'id-number'}
        text={'View character profile on Prydwen.gg'}
        href={`https://www.prydwen.gg/re1999/characters/${encodeURIComponent(
          `${nameEng}`
            .replace(/[^A-Za-z0-9]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '')
            .toLowerCase(),
        )}`}
      />
      <MenuItem
        {...externalLinkProps}
        icon={'id-number'}
        text={'View character profile on Fandom'}
        href={`https://reverse1999.fandom.com/wiki/${encodeURIComponent(
          `${nameEng}`
            .replace(/[^A-Za-z0-9.-]/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, ''),
        )}`}
      />
    </>
  )
})
