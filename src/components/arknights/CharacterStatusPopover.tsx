import { Button, ButtonGroup, Checkbox, Classes, Intent, NumericInput, Tag } from '@blueprintjs/core'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import React, { memo, useContext, useEffect, useMemo, useState } from 'react'
import { WithGame, useAtoms, useCpp } from '../../Cpp'
import { Arknights, ArknightsDataManager, Character, PreferenceKeys, SurveySourceKey } from '../../pkg/cpp-arknights'
import { HeyboxSurveySource, SurveyProps, SurveySource, YituliuSurveySource } from '../../pkg/cpp-arknights/survey'
import { UserDataAtomHolder } from '../../pkg/cpp-core/UserData'
import { gt } from '../../pkg/gt'
import m0 from './assets/m0.png'
import m1 from './assets/m1.png'
import m2 from './assets/m2.png'
import m3 from './assets/m3.png'

const useTypeHolderForSetStatusAtom = () =>
  useSetAtom(null as any as ReturnType<UserDataAtomHolder<Arknights>['atoms']['goalCharacter']>)

type IEditorContext = {
  status: Arknights['characterStatus']
  currentStatus?: Arknights['characterStatus']
  setStatus: ReturnType<typeof useTypeHolderForSetStatusAtom>
  character: Character
  dm: ArknightsDataManager
  surveySource?: SurveySource
}

const EditorContext = React.createContext<IEditorContext>(undefined as any)

export const EliteLevelInput = memo(({ elite }: { elite: number }) => {
  const { character, status, setStatus, currentStatus } = useContext(EditorContext)
  const [input, setInput] = useState(String(status.level))
  useEffect(() => setInput(String(status.level)), [status.level])

  if (status.elite !== elite) return <></>
  return (
    <NumericInput
      allowNumericCharactersOnly={false}
      value={input}
      min={currentStatus ? (currentStatus.elite === elite ? currentStatus.level : 1) : 1}
      max={character.maxLevels[elite]}
      onValueChange={(_, valueAsString) => setInput(valueAsString)}
      onBlur={() => {
        if (input === String(status.level)) return
        setStatus((x) => {
          x.level = parseInt(input, 10)
        })
        setInput(String(status.level))
      }}
      onButtonClick={(_, valueAsString) => {
        setStatus((x) => {
          x.level = parseInt(valueAsString, 10)
        })
      }}
      style={{ width: '3em', marginLeft: '1em' }}
    />
  )
})

export const EliteLevelButton = memo(({ elite, level, color }: { elite: number; level: number; color?: string }) => {
  const { status, setStatus, currentStatus } = useContext(EditorContext)
  const already = status.elite > elite || (status.elite === elite && status.level >= level)
  return (
    <Button
      onClick={() =>
        setStatus((x) => {
          x.elite = elite
          x.level = level
        })
      }
      disabled={
        currentStatus
          ? currentStatus.elite > elite || (currentStatus.elite === elite && currentStatus.level > level)
          : false
      }
      intent={already ? Intent.PRIMARY : Intent.NONE}
      style={{ backgroundColor: already ? undefined : color }}
    >
      {level}
    </Button>
  )
})

export const CharacterStatusEliteLevelSection = memo(() => {
  const { currentStatus, character, surveySource } = useContext(EditorContext)

  return (
    <>
      {character.maxElite >= 0 &&
      !(
        currentStatus &&
        (currentStatus.elite > 0 || (currentStatus.elite === 0 && currentStatus.level > character.maxLevels[0]))
      ) ? (
        <div className="cpp-charstat-group">
          <ButtonGroup>
            {surveySource ? <Survey survey={surveySource.elite0(character)} /> : null}
            <Tag large={true}>{gt.pgettext('arknights status group', '精零')}</Tag>
            {
              <Survey
                survey={
                  surveySource && surveySource instanceof HeyboxSurveySource && character.rarity >= 3 ? null : undefined
                }
              />
            }
            <EliteLevelButton elite={0} level={1} />
            <EliteLevelButton elite={0} level={character.maxLevels[0]} />
            <EliteLevelInput elite={0} />
          </ButtonGroup>
        </div>
      ) : undefined}
      {character.maxElite >= 1 &&
      !(
        currentStatus &&
        (currentStatus.elite > 1 || (currentStatus.elite === 1 && currentStatus.level > character.maxLevels[1]))
      ) ? (
        <div className="cpp-charstat-group">
          <ButtonGroup>
            {surveySource ? <Survey survey={surveySource.elite1(character)} /> : null}
            <Tag large={true}>{gt.pgettext('arknights status group', '精一')}</Tag>
            {
              <Survey
                survey={
                  surveySource && surveySource instanceof HeyboxSurveySource && character.rarity >= 3 ? null : undefined
                }
              />
            }
            <EliteLevelButton elite={1} level={1} />
            <EliteLevelButton elite={1} level={character.maxLevels[1]} />
            <EliteLevelInput elite={1} />
          </ButtonGroup>
        </div>
      ) : undefined}
      {character.maxElite >= 2 &&
      !(
        currentStatus &&
        (currentStatus.elite > 2 || (currentStatus.elite === 2 && currentStatus.level > character.maxLevels[2]))
      ) ? (
        <div className="cpp-charstat-group">
          <ButtonGroup>
            {surveySource ? <Survey survey={surveySource.elite2(character)} /> : null}
            <Tag large={true}>{gt.pgettext('arknights status group', '精二')}</Tag>
            {<Survey survey={surveySource?.e2level(character, 1)} />}
            <EliteLevelButton elite={2} level={1} />
            {new Array(character.maxLevels[2] / 10 + 1)
              .fill(0)
              .map((_, i) => i * 10)
              .slice(3)
              .map((lv) => (
                <React.Fragment key={lv}>
                  {lv === 70 ? <Survey survey={surveySource?.e2level(character, 70)} /> : undefined}
                  {lv === 90 ? <Survey survey={surveySource?.e2level(character, 90)} /> : undefined}
                  <EliteLevelButton
                    elite={2}
                    level={lv}
                    color={lv === character.modUnlockLevel ? 'rgba(0,0,255,0.25)' : undefined}
                  />
                </React.Fragment>
              ))}
            <EliteLevelInput elite={2} />
          </ButtonGroup>
        </div>
      ) : undefined}
    </>
  )
})

function sampleScaleOpacity(s: number) {
  if (!Number.isFinite(s)) return 0.75
  return 0.75 - (1 - Math.min(500, s) / 500) * 0.5
}

export const Survey = memo(({ survey }: { survey: SurveyProps | undefined | null }) => {
  if (survey === undefined) {
    return null
  } else if (survey === null) {
    return <SurveyDummy />
  } else {
    return <SurveyNumber {...survey} />
  }
})

export const SurveyDummy = memo(() => {
  return (
    <Tag
      large={false}
      style={{
        width: 'calc(7ex)',
        boxSizing: 'content-box',
        overflow: 'hidden',
        background: 'none',
        textAlign: 'right',
        opacity: 0.0,
      }}
      className={Classes.TEXT_OVERFLOW_ELLIPSIS}
    >
      {'0.00%'}
    </Tag>
  )
})

export const SurveyNumber = memo(({ percent, samples, desc }: SurveyProps) => {
  const s = Math.max(0, Math.round(samples))
  const p = Number.isFinite(percent) ? percent : 0
  const title = `${desc}\n${(p * 100).toFixed(5)}%${
    Number.isFinite(samples) ? ` (${Math.round(p * s)} / ${s})` : ' 未知样本数'
  }`
  return (
    <Tag
      large={false}
      style={{
        width: 'calc(7ex)',
        boxSizing: 'content-box',
        overflow: 'hidden',
        background: 'none',
        color: 'rgb(28, 33, 39)',
        textAlign: 'right',
        opacity: sampleScaleOpacity(s),
      }}
      className={Classes.TEXT_OVERFLOW_ELLIPSIS}
      title={title}
    >
      <code>{(p * 100).toFixed(2)}%</code>
    </Tag>
  )
})

export const SkillButton = memo(({ level }: { level: number }) => {
  const { status, setStatus, currentStatus } = useContext(EditorContext)
  const already = status.skillLevel >= level
  const needElite = status.elite === 0 ? level >= 5 : false
  const disabled = currentStatus ? currentStatus.skillLevel > level : false
  return (
    <Button
      onClick={() =>
        setStatus((x) => {
          if (needElite && x.elite < 1) {
            x.elite = 1
            x.level = 1
          }
          x.skillLevel = level
        })
      }
      disabled={disabled}
      intent={already ? Intent.PRIMARY : needElite ? Intent.WARNING : Intent.NONE}
    >
      {level}
    </Button>
  )
})

export const SkillMasterButton = memo(
  ({ skillId, level, survey }: { skillId: string; level: number; survey?: SurveyProps | null | undefined }) => {
    const { status, setStatus, currentStatus } = useContext(EditorContext)
    const master = status.skillMaster[skillId] || 0
    const currentMaster = currentStatus ? currentStatus.skillMaster[skillId] || 0 : undefined
    const needElite = level > 0 && (status.elite < 2 || status.skillLevel < 7)
    const already = master >= level
    const disabled = currentMaster != null ? currentMaster > level : false
    return (
      <>
        <Survey survey={survey} />
        <Button
          onClick={() =>
            setStatus((x) => {
              if (level > 0) {
                if (x.elite < 2) {
                  x.elite = 2
                  x.level = 1
                }
                if (x.skillLevel < 7) x.skillLevel = 7
              }
              x.skillMaster[skillId] = level
            })
          }
          disabled={disabled}
          intent={already ? Intent.PRIMARY : needElite ? Intent.WARNING : Intent.NONE}
          icon={<img src={[m0, m1, m2, m3][level]} width="100%" height="100%" />}
        />
      </>
    )
  },
)

export const CharacterStatusSkillMasterSection = memo(() => {
  const { currentStatus, character, surveySource } = useContext(EditorContext)
  if (!character.skills.length) return <></>
  if (character.rarity < 3) return <></>
  const all = currentStatus
    ? character.skills.every((charSkill) => currentStatus.skillMaster[charSkill.skillId] === 3)
    : false
  if (all) return <></>

  return (
    <>
      {character.skills.map((charSkill) => {
        const ss = surveySource?.skill(character, charSkill.skill, charSkill.rawCharId, charSkill.charSkillIndex)
        return (
          <div key={charSkill.skillId} className="cpp-charstat-group">
            <Survey survey={ss ? ss[0] : ss} />
            <ButtonGroup className={Classes.DARK}>
              <Tag large={true}>
                {gt
                  .pgettext('arknights status group', '技能 %d') /* I10N: %d: skill number */
                  .replaceAll('%d', `${charSkill.charSkillIndex + 1}`)}
              </Tag>
              <SkillMasterButton skillId={charSkill.skillId} level={0} />
              <SkillMasterButton skillId={charSkill.skillId} level={1} survey={ss ? ss[1] : ss} />
              <SkillMasterButton skillId={charSkill.skillId} level={2} survey={ss ? ss[2] : ss} />
              <SkillMasterButton skillId={charSkill.skillId} level={3} survey={ss ? ss[3] : ss} />
              <Tag
                large={false}
                style={{ width: 150, overflow: 'hidden', background: 'none' }}
                className={Classes.TEXT_OVERFLOW_ELLIPSIS}
              >
                {charSkill.skill.name}
              </Tag>
            </ButtonGroup>
          </div>
        )
      })}
    </>
  )
})

export const ModButton = memo(
  ({ modId, level, survey }: { modId: string; level: number; survey?: SurveyProps | null | undefined }) => {
    const { character, status, setStatus, currentStatus } = useContext(EditorContext)
    const master = status.modLevel[modId] || 0
    const currentMaster = currentStatus ? currentStatus.modLevel[modId] || 0 : undefined
    const needElite = level > 0 && (status.elite < 2 || status.level < character.modUnlockLevel)
    const already = master >= level
    const disabled = currentMaster != null ? currentMaster > level : false
    return (
      <>
        <Survey survey={survey} />
        <Button
          onClick={() =>
            setStatus((x) => {
              if (level > 0) {
                if (x.elite < 2) {
                  x.elite = 2
                  x.level = 1
                }
                if (x.level < character.modUnlockLevel) x.level = character.modUnlockLevel
              }
              x.modLevel[modId] = level
            })
          }
          disabled={disabled}
          intent={already ? Intent.PRIMARY : needElite ? Intent.WARNING : Intent.NONE}
        >
          {level}
        </Button>
      </>
    )
  },
)

export const CharacterStatusModSection = memo(() => {
  const { currentStatus, character, surveySource } = useContext(EditorContext)
  if (character.rarity < 3) return <></>

  const uniEquips = character.uniEquips.filter((x) => x.equip.raw.unlockEvolvePhase > 'PHASE_0')
  if (!uniEquips.length) return <></>

  const all = currentStatus ? uniEquips.every((equip) => currentStatus.modLevel[equip.equipId] === 3) : false
  if (all) return <></>

  return (
    <>
      {uniEquips.map((charMod) => {
        const ss = surveySource?.mod(character, charMod.equip, charMod.rawCharId)
        return (
          <div key={charMod.equipId} className="cpp-charstat-group">
            <Survey survey={ss ? ss[0] : ss} />
            <ButtonGroup className={Classes.DARK}>
              <Tag large={true} style={{ fontFamily: 'monospace' }} title={charMod.equipId}>
                {charMod.equip.raw.typeName1}-{charMod.equip.raw.typeName2}
              </Tag>
              <ModButton modId={charMod.equipId} level={0} />
              <ModButton modId={charMod.equipId} level={1} survey={ss ? ss[1] : ss} />
              <ModButton modId={charMod.equipId} level={2} survey={ss ? ss[2] : ss} />
              <ModButton modId={charMod.equipId} level={3} survey={ss ? ss[3] : ss} />
              <Tag
                large={false}
                style={{ width: 150, overflow: 'hidden', background: 'none' }}
                className={Classes.TEXT_OVERFLOW_ELLIPSIS}
              >
                {charMod.equip.name}
              </Tag>
            </ButtonGroup>
          </div>
        )
      })}
    </>
  )
})

export function CharacterStatusSkillSection() {
  const { currentStatus, character, surveySource } = useContext(EditorContext)
  if (!character.skills.length) return <></>
  if ((currentStatus?.skillLevel || 0) >= 7) return <></>

  return (
    <>
      <div className="cpp-charstat-group">
        <ButtonGroup>
          {surveySource ? <SurveyDummy /> : null}
          <Tag large={true}>{gt.pgettext('arknights status group', '技能')}</Tag>
          <SkillButton level={1} />
          <SkillButton level={2} />
          <SkillButton level={3} />
          <SkillButton level={4} />
          <SkillButton level={5} />
          <SkillButton level={6} />
          <SkillButton level={7} />
        </ButtonGroup>
      </div>
    </>
  )
}

export const CharacterStatusPopover = memo(({ character, isGoal }: { character: Character; isGoal: boolean }) => {
  const atoms = useAtoms<Arknights>()
  const dm = useCpp().gameAdapter.getDataManager() as ArknightsDataManager
  const [surveySourcePref, setSurveySourcePref] = WithGame<Arknights>().useGamePreferenceAtom(
    PreferenceKeys.SurveySource,
  )
  const charId = character.key
  const statusAtom = isGoal ? atoms.goalCharacter(charId) : atoms.currentCharacter(charId)
  const [status, setStatus] = useAtom(statusAtom)
  let currentStatus: Arknights['characterStatus'] | undefined = useAtomValue(atoms.currentCharacter(charId))
  if (!isGoal) currentStatus = undefined

  const [surveySourceProvider, surveySource] = useMemo(() => {
    if (surveySourcePref === SurveySourceKey.Heybox) return [HeyboxSurveySource, new HeyboxSurveySource(dm)]
    if (surveySourcePref === SurveySourceKey.Yituliu) return [YituliuSurveySource, new YituliuSurveySource(dm)]
    return [undefined, undefined]
  }, [dm, surveySourcePref])

  const ctx = {
    status,
    setStatus,
    character,
    currentStatus,
    dm,
    surveySource: surveySource,
  } satisfies IEditorContext

  const showAction = gt.gettext('显示%s') /* I10N: %s: stat source name */
  const switchToAction = gt.gettext('切换至%s') /* I10N: %s: stat source name */

  const own = surveySource?.own(character)
  return (
    <EditorContext.Provider value={ctx}>
      <div>
        {currentStatus && currentStatus.level > 0 ? undefined : (
          <Checkbox
            checked={status.level > 0}
            style={{ float: 'right', marginLeft: 10 }}
            onChange={(x) => {
              if (x.currentTarget.checked) {
                setStatus((x) => {
                  x.elite = 0
                  x.level = 1
                })
              } else {
                setStatus((x) => {
                  x.elite = 0
                  x.level = 0
                })
              }
            }}
          >
            {gt.gettext('持有')}
          </Checkbox>
        )}
        {character.name} - {isGoal ? gt.gettext('培养目标') : gt.gettext('当前状态')}
      </div>
      <div
        style={{
          fontSize: '85.7142857143%',
          lineHeight: '21px',
          whiteSpace: 'nowrap',
          opacity: 0.75,
        }}
      >
        {surveySource && surveySourceProvider ? (
          <>
            {gt
              .gettext('%s持有率') /* I10N: %s: stat source name */
              .replaceAll('%s', surveySourceProvider.ShortName.toString())}
            {own ? (
              <code style={{ marginLeft: 8 }}>
                {(own.percent * 100).toFixed(2)}%
                {Number.isFinite(own.samples) ? (
                  <>
                    {' '}
                    ({Math.round(own.percent * own.samples)} / {own.samples})
                  </>
                ) : null}
              </code>
            ) : (
              <code style={{ marginLeft: 8 }}>N/A</code>
            )}
          </>
        ) : (
          <>{gt.gettext('社区练度统计数据')}</>
        )}
        {surveySourcePref !== SurveySourceKey.Yituliu ? (
          <>
            {' | '}
            <a
              href={'#'}
              onClick={(e) => {
                setSurveySourcePref(SurveySourceKey.Yituliu)
                e.preventDefault()
              }}
            >
              {(surveySourcePref === SurveySourceKey.None ? showAction : switchToAction).replaceAll(
                '%s',
                YituliuSurveySource.VeryShortName.toString(),
              )}
            </a>
          </>
        ) : null}
        {surveySourcePref !== SurveySourceKey.Heybox ? (
          <>
            {' | '}
            <a
              href={'#'}
              onClick={(e) => {
                setSurveySourcePref(SurveySourceKey.Heybox)
                e.preventDefault()
              }}
            >
              {(surveySourcePref === SurveySourceKey.None ? showAction : switchToAction).replaceAll(
                '%s',
                HeyboxSurveySource.VeryShortName.toString(),
              )}
            </a>
          </>
        ) : null}
        {surveySourcePref !== SurveySourceKey.None ? (
          <>
            {' | '}
            <a
              href={'#'}
              onClick={(e) => {
                setSurveySourcePref(SurveySourceKey.None)
                e.preventDefault()
              }}
            >
              {gt.gettext('隐藏')}
            </a>
          </>
        ) : null}
      </div>
      {status.level > 0 ? (
        <>
          <CharacterStatusEliteLevelSection />
          <CharacterStatusSkillSection />
          <CharacterStatusSkillMasterSection />
          <CharacterStatusModSection />
        </>
      ) : undefined}
    </EditorContext.Provider>
  )
})
