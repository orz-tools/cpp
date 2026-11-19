import { useAtom, useAtomValue } from 'jotai'
import { memo, useState } from 'react'
import { WithGame, useAtoms, useGameAdapter, useGameDataMemo } from '../../../Cpp'
import { Arknights, ArknightsDataManager, Character, PreferenceKeys, SurveySourceKey } from '../../../pkg/cpp-arknights'
import { editableUniEquips, levelMaxed } from '../../../pkg/cpp-arknights/statusEdit'
import { HeyboxSurveySource, YituliuSurveySource } from '../../../pkg/cpp-arknights/survey'
import { gt } from '../../../pkg/gt'
import { useMissingData } from '../../MissingData'
import { EliteLevelSection } from './EliteLevelSection'
import { Header } from './Header'
import { ModSection } from './ModSection'
import { PotentialSection } from './PotentialSection'
import { SkillSection } from './SkillSection'
import { SurveyBar, surveyContainer } from './SurveyBar'
import { EditorContext, EditorContextValue } from './context'

/**
 * One operator's current status or goal: elite and level, skills, modules and, in the current status, potential.
 * The list's popovers and the dossier's 练度 page both render it; the dossier passes embedded.
 */
export const CharacterStatusEditor = memo(
  ({
    character,
    isGoal,
    embedded = false,
    onModeChange,
  }: {
    character: Character
    isGoal: boolean
    embedded?: boolean
    onModeChange?: (isGoal: boolean) => void
  }) => {
    const atoms = useAtoms<Arknights>()
    const dm = useGameAdapter().getDataManager() as ArknightsDataManager
    const charId = character.key
    const [status, setStatus] = useAtom(isGoal ? atoms.goalCharacter(charId) : atoms.currentCharacter(charId))
    const currentStatus = useAtomValue(atoms.currentCharacter(charId))
    const [source, setSource] = WithGame<Arknights>().useGamePreferenceAtom(PreferenceKeys.SurveySource)
    const showPotential = WithGame<Arknights>().useGamePreferenceAtomValue(PreferenceKeys.ShowPotential)
    const [openDetail, setOpenDetail] = useState<string | null>(null)

    // Without the statistics there is nothing to draw under the cells; SurveyBar says they did not load.
    const { missing } = useMissingData(surveyContainer(dm, source))
    const [survey, surveyName] = useGameDataMemo(() => {
      if (missing) return [null, ''] as const
      if (source === SurveySourceKey.Yituliu)
        return [new YituliuSurveySource(dm), YituliuSurveySource.VeryShortName.toString()] as const
      if (source === SurveySourceKey.Heybox)
        return [new HeyboxSurveySource(dm), HeyboxSurveySource.VeryShortName.toString()] as const
      return [null, ''] as const
    }, [dm, source, missing])

    // Maxed skills and modules stay in a goal, all gray, because their (i) still opens the descriptions.
    const showLevel = !isGoal || !levelMaxed(character, currentStatus)
    const maxed = !showLevel && !character.skills.length && !editableUniEquips(character).length

    const ctx: EditorContextValue = {
      character,
      status,
      current: isGoal ? currentStatus : undefined,
      setStatus,
      dm,
      survey,
      surveyName,
      openDetail,
      toggleDetail: (key) => setOpenDetail((x) => (x === key ? null : key)),
    }

    return (
      <EditorContext.Provider value={ctx}>
        <div className={'cpp-charstat' + (embedded ? ' cpp-charstat-embedded' : '')}>
          <Header isGoal={isGoal} embedded={embedded} onModeChange={onModeChange} />
          <SurveyBar source={source} setSource={setSource} />
          {status.level <= 0 ? (
            <div className="cpp-charstat-empty">{gt.pgettext('arknights status editor', '打开「持有」后设置练度')}</div>
          ) : maxed ? (
            <div className="cpp-charstat-empty">{gt.pgettext('arknights status editor', '已经练满了')}</div>
          ) : (
            <>
              {showLevel ? <EliteLevelSection /> : null}
              <SkillSection />
              <ModSection />
              {!isGoal && showPotential ? <PotentialSection /> : null}
            </>
          )}
        </div>
      </EditorContext.Provider>
    )
  },
)
