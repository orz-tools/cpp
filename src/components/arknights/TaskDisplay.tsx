import { Tag } from '@blueprintjs/core'
import { memo } from 'react'
import useEvent from 'react-use-event-hook'
import { useGameAdapter } from '../../Cpp'
import { Arknights, ArknightsAdapter } from '../../pkg/cpp-arknights'
import { gt } from '../../pkg/gt'
import { useShowCharacterDossier } from '../dossierHooks'
import { useRequestFrame } from '../focusFrame'
import { ProfessionIcon } from './Icons'
import { MODULE_MISSIONS_SECTION, moduleMissionsFrame } from './ModuleMissionSection'
import { useDoneMissions } from './moduleMissionState'

// 标签在菜单项的 <a> 里：Enter 会被菜单项再转成一次点击
const stopPropagation = (e: React.SyntheticEvent) => e.stopPropagation()

/** 解锁模组的那一行，任务没做完时标出做完几条；点了打开档案的「模组任务」页，框出这个模组 */
const MissionProgress = memo(({ charId, modId }: { charId: string; modId: string }) => {
  const ga = useGameAdapter() as ArknightsAdapter
  const done = useDoneMissions()
  const showDossier = useShowCharacterDossier()
  const frame = useRequestFrame()
  const onClick = useEvent(() => {
    showDossier(charId, { section: MODULE_MISSIONS_SECTION })
    frame(moduleMissionsFrame(modId))
  })
  const missions = ga.getDataManager().data.uniEquips[modId]?.missions ?? []
  const count = missions.filter((x) => done.has(x.id)).length
  if (missions.length === 0 || count === missions.length) return null
  return (
    <Tag
      minimal={true}
      intent="warning"
      className="cpp-mm-task-tag"
      interactive={true}
      onClick={onClick}
      onKeyDown={stopPropagation}
      htmlTitle={gt.pgettext('module mission', '在档案里看模组任务')}
    >
      {gt
        .pgettext('module mission', '任务 %1/%2') /* I10N: %1: missions done; %2: missions */
        .replace('%1', String(count))
        .replace('%2', String(missions.length))}
    </Tag>
  )
})

export const TaskTag = memo(({ type, charId }: { type: Arknights['characterTaskType']; charId: string }) =>
  type._ === 'mod' && type.to === 1 ? <MissionProgress charId={charId} modId={type.modId} /> : null,
)

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
