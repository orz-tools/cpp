import { memo } from 'react'
import { Character, ProfessionNames } from '../../pkg/cpp-arknights'
import { PSTR, gt } from '../../pkg/gt'

export const CharacterDossierMeta = memo(({ character }: { character: Character }) => {
  const rarity = gt.pgettext('arknights quick filter', '%d 星').replaceAll('%d', String(character.rarity + 1))
  // raw is the base form: Amiya's other professions come as patches and are left out
  const profession = (ProfessionNames as Partial<Record<string, PSTR>>)[character.raw.profession]
  return <>{profession ? `${rarity} · ${profession.toString()}` : rarity}</>
})
