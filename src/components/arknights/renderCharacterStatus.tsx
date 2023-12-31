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
  const uniEquips = character.uniEquips.filter((x) => x.raw.unlockEvolvePhase > 'PHASE_0')
  const uniX = uniEquips.find((x) => x.raw.typeName2!.toUpperCase() === 'X')
  const uniY = uniEquips.find((x) => x.raw.typeName2!.toUpperCase() === 'Y')
  const uniD = uniEquips.find((x) => x.raw.typeName2!.toUpperCase() === 'D')
  if ([uniX, uniY, uniD].filter((x) => !!x).length !== uniEquips.length) {
    console.warn('character extra uniEquips', character, uniEquips)
  }

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
          hide={current ? (status.modLevel[uniX.key] || 0) === (current.modLevel[uniX.key] || 0) : false}
          alreadyHide={alreadyHide}
        >
          <UniEquipIcon
            count={uniEquips.length}
            uniEquip={uniX}
            key={uniX.key}
            level={status.modLevel[uniX.key] || 0}
          />
        </Hide>
      ) : (
        <EmptyIcon />
      )}
      {uniY ? (
        <Hide
          hide={current ? (status.modLevel[uniY.key] || 0) === (current.modLevel[uniY.key] || 0) : false}
          alreadyHide={alreadyHide}
        >
          <UniEquipIcon
            count={uniEquips.length}
            uniEquip={uniY}
            key={uniY.key}
            level={status.modLevel[uniY.key] || 0}
          />
        </Hide>
      ) : (
        <EmptyIcon />
      )}
      {uniD ? (
        <Hide
          hide={current ? (status.modLevel[uniD.key] || 0) === (current.modLevel[uniD.key] || 0) : false}
          alreadyHide={alreadyHide}
        >
          <UniEquipIcon
            count={uniEquips.length}
            uniEquip={uniD}
            key={uniD.key}
            level={status.modLevel[uniD.key] || 0}
          />
        </Hide>
      ) : null}
      {character.skills.slice(0, 3).map(([, skill]) => (
        <Hide
          hide={
            current
              ? status.skillLevel === current.skillLevel &&
                (status.skillMaster[skill.key] || 0) === (current.skillMaster[skill.key] || 0)
              : false
          }
          key={skill.key}
          alreadyHide={alreadyHide}
        >
          <SkillIcon skill={skill} level={status.skillLevel} master={status.skillMaster[skill.key] || 0} />
        </Hide>
      ))}
      {new Array(3 - (character.raw.skills?.length || 0)).fill(0).map((_, i) => (
        <EmptyIcon key={i} />
      ))}
    </>
  )
}
