import { memo } from 'react'
import { useGameAdapter } from '../../Cpp'
import { Arknights, ArknightsAdapter } from '../../pkg/cpp-arknights'
import { ProfessionIcon } from './Icons'

export const TaskDisplay = memo(
  ({
    type,
    charId,
    formattedString,
  }: {
    type: Arknights['characterTaskType']
    charId: string
    formattedString: string
  }) => {
    const ga = useGameAdapter() as ArknightsAdapter
    const character = ga.getCharacter(charId)

    if (character.hasPatches && (type._ === 'skillMaster' || type._ === 'mod')) {
      const rawCharId =
        type._ === 'skillMaster'
          ? character.skills.find((x) => x.skillId === type.skillId)!.rawCharId
          : character.uniEquips.find((x) => x.equipId === type.modId)!.rawCharId

      return (
        <>
          <ProfessionIcon
            profession={character.getPatchProfession(rawCharId)}
            style={{ verticalAlign: -3, paddingRight: 2 }}
          />
          {formattedString}
        </>
      )
    }
    return <>{formattedString}</>
  },
)
