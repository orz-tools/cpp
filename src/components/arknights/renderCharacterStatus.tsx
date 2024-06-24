import { Arknights, Character } from '../../pkg/cpp-arknights'
import { Hide } from '../CharacterList'
import { EmptyIcon } from '../Icons'
import { LevelIcon, SkillIcon, UniEquipIcon } from './Icons'

export function renderCharacterStatus(
  status: Arknights['characterStatus'],
  character: Character,
  current?: Arknights['characterStatus'],
  alreadyHide = false,
) {
  const uniEquips = character.uniEquips.filter((x) => x.equip.raw.unlockEvolvePhase > 'PHASE_0')
  const uniX = uniEquips.find((x) => x.equip.raw.typeName2!.toUpperCase() === 'X')
  const uniY = uniEquips.find((x) => x.equip.raw.typeName2!.toUpperCase() === 'Y')
  const uniD = uniEquips.find((x) => x.equip.raw.typeName2!.toUpperCase() === 'D')
  if ([uniX, uniY, uniD].filter((x) => !!x).length !== uniEquips.length) {
    console.warn('character extra uniEquips', character, uniEquips)
  }

  const classes = [`cpp-uniequip-count-${uniEquips.length}`]
  if (uniX) classes.push(`cpp-uniequip-has-x`)
  if (uniY) classes.push(`cpp-uniequip-has-y`)
  if (uniD) classes.push(`cpp-uniequip-has-d`)

  return (
    <>
      <Hide
        hide={current ? status.elite === current.elite && status.level === current.level : false}
        alreadyHide={alreadyHide}
      >
        <LevelIcon level={status} />
      </Hide>
      {uniX ? (
        <Hide
          hide={current ? (status.modLevel[uniX.equipId] || 0) === (current.modLevel[uniX.equipId] || 0) : false}
          alreadyHide={alreadyHide}
        >
          <UniEquipIcon
            classes={classes}
            uniEquip={uniX.equip}
            key={uniX.equipId}
            level={status.modLevel[uniX.equipId] || 0}
          />
        </Hide>
      ) : (
        <EmptyIcon classes={classes} />
      )}
      {uniY ? (
        <Hide
          hide={current ? (status.modLevel[uniY.equipId] || 0) === (current.modLevel[uniY.equipId] || 0) : false}
          alreadyHide={alreadyHide}
        >
          <UniEquipIcon
            classes={classes}
            uniEquip={uniY.equip}
            key={uniY.equipId}
            level={status.modLevel[uniY.equipId] || 0}
          />
        </Hide>
      ) : (
        <EmptyIcon classes={classes} />
      )}
      {uniD ? (
        <Hide
          hide={current ? (status.modLevel[uniD.equipId] || 0) === (current.modLevel[uniD.equipId] || 0) : false}
          alreadyHide={alreadyHide}
        >
          <UniEquipIcon
            classes={classes}
            uniEquip={uniD.equip}
            key={uniD.equipId}
            level={status.modLevel[uniD.equipId] || 0}
          />
        </Hide>
      ) : null}
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
      {new Array(3 - (character.raw.skills?.length || 0)).fill(0).map((_, i) => (
        <EmptyIcon key={i} />
      ))}
    </>
  )
}
