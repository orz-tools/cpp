import { memo } from 'react'
import { WithGame } from '../../Cpp'
import { Arknights, Character, PreferenceKeys } from '../../pkg/cpp-arknights'
import { Hide } from '../CharacterList'
import { EmptyIcon } from '../Icons'
import { LevelIcon, PotentialIcon, SkillIcon, UniEquipIcon } from './Icons'
import { moduleSlots, unlockedUniEquips } from './moduleSlots'

const PotentialBadge = memo(({ potentialRank }: { potentialRank: number }) => {
  const show = WithGame<Arknights>().useGamePreferenceAtomValue(PreferenceKeys.ShowPotential)
  return show ? <PotentialIcon className="cpp-char-potential-badge" potentialRank={potentialRank} /> : null
})

export function renderCharacterAvatarBadge(status: Arknights['characterStatus']) {
  return <PotentialBadge potentialRank={status.potentialRank || 0} />
}

export function renderCharacterStatus(
  status: Arknights['characterStatus'],
  character: Character,
  current?: Arknights['characterStatus'],
  alreadyHide = false,
) {
  const uniEquips = unlockedUniEquips(character)
  const slots = moduleSlots(character)
  const hasType = (t: string) => uniEquips.some((x) => x.equip.raw.typeName2?.toUpperCase() === t)

  const classes = [`cpp-uniequip-count-${uniEquips.length}`, `cpp-uniequip-slots-${slots.length}`]
  if (hasType('X')) classes.push(`cpp-uniequip-has-x`)
  if (hasType('Y')) classes.push(`cpp-uniequip-has-y`)

  return (
    <>
      <Hide
        hide={current ? status.elite === current.elite && status.level === current.level : false}
        alreadyHide={alreadyHide}
      >
        <LevelIcon level={status} />
      </Hide>
      {slots.map((ue, i) =>
        ue ? (
          <Hide
            hide={current ? (status.modLevel[ue.equipId] || 0) === (current.modLevel[ue.equipId] || 0) : false}
            alreadyHide={alreadyHide}
            key={ue.equipId}
          >
            <UniEquipIcon classes={classes} uniEquip={ue.equip} level={status.modLevel[ue.equipId] || 0} />
          </Hide>
        ) : (
          <EmptyIcon classes={classes} key={`empty-${i}`} />
        ),
      )}
      {character.skills.slice(0, 3).map((skill) => (
        <Hide
          hide={
            current
              ? status.skillLevel === current.skillLevel &&
                (status.skillMaster[skill.skillId] || 0) === (current.skillMaster[skill.skillId] || 0)
              : false
          }
          key={skill.skillId}
          alreadyHide={alreadyHide}
        >
          <SkillIcon skill={skill.skill} level={status.skillLevel} master={status.skillMaster[skill.skillId] || 0} />
        </Hide>
      ))}
      {Array.from({ length: 3 - (character.raw.skills?.length || 0) }, () => 0).map((_, i) => (
        <EmptyIcon key={i} />
      ))}
    </>
  )
}
