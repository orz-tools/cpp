import { useAtom, useAtomValue } from 'jotai'
import { memo, useState } from 'react'
import { WithGame, useAtoms, useGameAdapter, useGameDataMemo } from '../../../Cpp'
import { Arknights, ArknightsDataManager, Character, PreferenceKeys, SurveySourceKey } from '../../../pkg/cpp-arknights'
import { HeyboxSurveySource, YituliuSurveySource } from '../../../pkg/cpp-arknights/survey'
import { gt } from '../../../pkg/gt'
import { EliteLevelSection } from './EliteLevelSection'
import { Header } from './Header'
import { ModSection } from './ModSection'
import { PotentialSection } from './PotentialSection'
import { SkillSection } from './SkillSection'
import { SurveyBar } from './SurveyBar'
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

    const [survey, surveyName] = useGameDataMemo(() => {
      if (source === SurveySourceKey.Yituliu)
        return [new YituliuSurveySource(dm), YituliuSurveySource.VeryShortName.toString()] as const
      if (source === SurveySourceKey.Heybox)
        return [new HeyboxSurveySource(dm), HeyboxSurveySource.VeryShortName.toString()] as const
      return [null, ''] as const
    }, [dm, source])

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
          {status.level > 0 ? (
            <>
              <EliteLevelSection />
              <SkillSection />
              <ModSection />
              {!isGoal && showPotential ? <PotentialSection /> : null}
            </>
          ) : (
            <div className="cpp-charstat-empty">{gt.pgettext('arknights status editor', '打开「持有」后设置练度')}</div>
          )}
        </div>
      </EditorContext.Provider>
    )
  },
)
