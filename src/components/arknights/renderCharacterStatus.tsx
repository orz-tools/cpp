import { Arknights, Character } from '../../pkg/cpp-arknights'
import { Hide } from '../CharacterList'
import { EmptyIcon } from '../Icons'
import { LevelIcon, PotentialIcon, SkillIcon, UniEquipIcon } from './Icons'

export function renderCharacterAvatarBadge(status: Arknights['characterStatus']) {
  return <PotentialIcon className="cpp-char-potential-badge" potentialRank={status.potentialRank || 0} />
}

export function renderCharacterStatus(
  status: Arknights['characterStatus'],
  character: Character,
  current?: Arknights['characterStatus'],
  alreadyHide = false,
) {
  const uniEquips = character.uniEquips.filter((x) => x.equip.raw.unlockEvolvePhase > 'PHASE_0')
  const uniX = uniEquips.find((x) => x.equip.raw.typeName2?.toUpperCase() === 'X')
  const uniY = uniEquips.find((x) => x.equip.raw.typeName2?.toUpperCase() === 'Y')
  const rest = uniEquips.filter((x) => x !== uniX && x !== uniY)

  // X and Y keep their own columns so they line up across the list; every other branch (D, A, B, ...)
  // goes into a third, narrower column, and only borrows an empty X/Y slot when one column is not enough.
  const slots: (Character['uniEquips'][number] | undefined)[] = [uniX, uniY]
  if (rest.length) slots.push(undefined)
  for (let i = slots.length - 1; i >= 0 && rest.length; i--) {
    if (!slots[i]) slots[i] = rest.pop()
  }
  slots.push(...rest)

  const classes = [`cpp-uniequip-count-${uniEquips.length}`, `cpp-uniequip-slots-${slots.length}`]
  if (uniX) classes.push(`cpp-uniequip-has-x`)
  if (uniY) classes.push(`cpp-uniequip-has-y`)

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
