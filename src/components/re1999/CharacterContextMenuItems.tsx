import { MenuItem } from '@blueprintjs/core'
import { memo } from 'react'
import { ICharacter } from '../../pkg/cpp-basic'
import { Character } from '../../pkg/cpp-re1999'
import { externalLinkProps } from '../AboutList'
import links from './links.json'
import taptap from './taptap.json'

const sanitizeName = (s: string) =>
  String(s || '')
    .toLowerCase()
    .replace(/[_.·・]|\s/g, '')

const englishNames = links.englishNames as Record<string, string>

export const CharacterContextMenuItems = memo(({ character: char }: { character: ICharacter }) => {
  const character = char as Character
  const gamekee = links.gamekee.find((x) => sanitizeName(x.name) === sanitizeName(character.raw.name))
  const englishName = Object.prototype.hasOwnProperty.call(englishNames, character.raw.nameEng)
    ? englishNames[character.raw.nameEng]
    : character.raw.nameEng

  const prydwen = `${englishName}`
    .replace(/[^A-Za-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()

  const fandom = `${englishName}`
    .replace(/[^A-Za-z0-9.-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')

  let tap = Object.prototype.hasOwnProperty.call(taptap.chars, character.raw.name)
    ? taptap.chars[character.raw.name as keyof (typeof taptap)['chars']]
    : undefined

  if (tap && !tap.startsWith('https://') && tap.startsWith('/')) {
    tap = 'https://www.taptap.cn' + tap
  }

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
      {tap ? (
        <MenuItem {...externalLinkProps} icon={'id-number'} text={'在「TapTap」查看此角色信息'} href={tap} />
      ) : null}
      {prydwen ? (
        <MenuItem
          {...externalLinkProps}
          icon={'id-number'}
          text={'View character profile on Prydwen.gg'}
          href={`https://www.prydwen.gg/re1999/characters/${encodeURIComponent(prydwen)}`}
        />
      ) : null}
      {fandom ? (
        <MenuItem
          {...externalLinkProps}
          icon={'id-number'}
          text={'View character profile on Fandom'}
          href={`https://reverse1999.fandom.com/wiki/${encodeURIComponent(fandom)}`}
        />
      ) : null}
    </>
  )
})
