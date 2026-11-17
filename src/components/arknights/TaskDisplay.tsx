import { Tag } from '@blueprintjs/core'
import { memo } from 'react'
import { useGameAdapter } from '../../Cpp'
import { Arknights, ArknightsAdapter } from '../../pkg/cpp-arknights'
import { gt } from '../../pkg/gt'
import { ProfessionIcon } from './Icons'
import { useDoneMissions } from './moduleMissionState'

/** 解锁模组的那一行，任务没做完时在前面标出做完几条；放在前面，因为这一行太长时末尾会被截掉 */
const MissionProgress = memo(({ modId }: { modId: string }) => {
  const ga = useGameAdapter() as ArknightsAdapter
  const done = useDoneMissions()
  const missions = ga.getDataManager().data.uniEquips[modId]?.missions ?? []
  const count = missions.filter((x) => done.has(x.id)).length
  if (missions.length === 0 || count === missions.length) return null
  return (
    <Tag minimal={true} intent="warning" className="cpp-mm-task-tag">
      {gt
        .pgettext('module mission', '任务 %1/%2') /* I10N: %1: missions done; %2: missions */
        .replace('%1', String(count))
        .replace('%2', String(missions.length))}
    </Tag>
  )
})

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
    const progress = type._ === 'mod' && type.to === 1 ? <MissionProgress modId={type.modId} /> : null

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
          {progress}
          {formattedString}
        </>
      )
    }
    return (
      <>
        {progress}
        {formattedString}
      </>
    )
  },
)
