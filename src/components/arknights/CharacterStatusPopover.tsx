import { Button, ButtonGroup, Checkbox, Classes, Intent, NumericInput, Tag } from '@blueprintjs/core'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import React, { memo, useContext, useEffect, useState } from 'react'
import { useAtoms, useCpp } from '../../Cpp'
import { Arknights, ArknightsDataManager, Character } from '../../pkg/cpp-arknights'
import { UserDataAtomHolder } from '../../pkg/cpp-core/UserData'
import { externalLinkProps } from '../AboutList'
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
  surveyCount: number
  survey?: ArknightsDataManager['raw']['operatorSurvey']['result'][0]
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
  const { currentStatus, character, surveyCount, survey } = useContext(EditorContext)
  return (
    <>
      {character.maxElite >= 0 &&
      !(
        currentStatus &&
        (currentStatus.elite > 0 || (currentStatus.elite === 0 && currentStatus.level > character.maxLevels[0]))
      ) ? (
        <div>
          <ButtonGroup>
            {survey ? (
              <SurveyNumber
                desc={'精零人数/持有人数'}
                percent={survey?.elite.rank0}
                samples={surveyCount * survey.own}
              />
            ) : null}
            <Tag large={true}>精零</Tag>
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
        <div>
          <ButtonGroup>
            {survey ? (
              <SurveyNumber
                desc={'精一人数/持有人数'}
                percent={survey?.elite.rank1}
                samples={surveyCount * survey.own}
              />
            ) : null}
            <Tag large={true}>精一</Tag>
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
        <div>
          <ButtonGroup>
            {survey ? (
              <SurveyNumber
                desc={'精二人数/持有人数'}
                percent={survey?.elite.rank2}
                samples={surveyCount * survey.own}
              />
            ) : null}
            <Tag large={true}>精二</Tag>
            <EliteLevelButton elite={2} level={1} />
            {new Array(character.maxLevels[2] / 10 + 1)
              .fill(0)
              .map((_, i) => i * 10)
              .slice(3)
              .map((lv) => (
                <EliteLevelButton
                  key={lv}
                  elite={2}
                  level={lv}
                  color={lv === character.modUnlockLevel ? 'rgba(0,0,255,0.25)' : undefined}
                />
              ))}
            <EliteLevelInput elite={2} />
          </ButtonGroup>
        </div>
      ) : undefined}
    </>
  )
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

function sampleScaleOpacity(s: number) {
  return 0.75 - (1 - Math.min(500, s) / 500) * 0.5
}

export const SurveyNumber = memo(({ percent, samples, desc }: { percent: number; samples: number; desc: string }) => {
  const s = Math.max(0, Math.round(Number.isFinite(samples) ? samples : 0))
  const p = Number.isFinite(percent) ? percent : 0
  const title = `${desc}\n${(p * 100).toFixed(5)}% (${Math.round(p * s)} / ${s})`
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
  ({
    skillId,
    level,
    survey,
  }: {
    skillId: string
    level: number
    survey?: typeof SurveyNumber extends React.FC<infer P> ? P : never
  }) => {
    const { status, setStatus, currentStatus } = useContext(EditorContext)
    const master = status.skillMaster[skillId] || 0
    const currentMaster = currentStatus ? currentStatus.skillMaster[skillId] || 0 : undefined
    const needElite = level > 0 && (status.elite < 2 || status.skillLevel < 7)
    const already = master >= level
    const disabled = currentMaster != null ? currentMaster > level : false
    return (
      <>
        {survey ? <SurveyNumber {...survey} /> : null}
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
  const { currentStatus, character, survey, surveyCount } = useContext(EditorContext)
  if (!character.skills.length) return <></>
  if (character.rarity < 3) return <></>
  const skillsSurveys = survey ? [survey.skill1, survey.skill2, survey.skill3] : undefined
  const all = currentStatus ? character.skills.every(([, skill]) => currentStatus.skillMaster[skill.key] === 3) : false
  if (all) return <></>

  return (
    <>
      {character.skills.map(([, skill], index) => {
        const ss = skillsSurveys?.[index]
        return (
          <div key={skill.key}>
            {survey && ss ? (
              <SurveyNumber
                desc={'专精了此技能的人数（一级及以上）/持有人数'}
                percent={ss.count}
                samples={surveyCount * survey.own}
              />
            ) : null}
            <ButtonGroup className={Classes.DARK}>
              <Tag large={true}>技能 {index + 1}</Tag>
              <SkillMasterButton skillId={skill.key} level={0} />
              <SkillMasterButton
                skillId={skill.key}
                level={1}
                survey={
                  survey && ss
                    ? {
                        desc: '专精一级此技能的人数/专精了此技能的人数（一级及以上）',
                        percent: ss.rank1 / ss.count,
                        samples: surveyCount * survey.own * ss.count,
                      }
                    : undefined
                }
              />
              <SkillMasterButton
                skillId={skill.key}
                level={2}
                survey={
                  survey && ss
                    ? {
                        desc: '专精二级此技能的人数/专精了此技能的人数（一级及以上）',
                        percent: ss.rank2 / ss.count,
                        samples: surveyCount * survey.own * ss.count,
                      }
                    : undefined
                }
              />
              <SkillMasterButton
                skillId={skill.key}
                level={3}
                survey={
                  survey && ss
                    ? {
                        desc: '专精三级此技能的人数/专精了此技能的人数（一级及以上）',
                        percent: ss.rank3 / ss.count,
                        samples: surveyCount * survey.own * ss.count,
                      }
                    : undefined
                }
              />
              <Tag
                large={false}
                style={{ width: 150, overflow: 'hidden', background: 'none' }}
                className={Classes.TEXT_OVERFLOW_ELLIPSIS}
              >
                {skill.raw.levels[0].name}
              </Tag>
            </ButtonGroup>
          </div>
        )
      })}
    </>
  )
})

export const ModButton = memo(
  ({
    modId,
    level,
    survey,
  }: {
    modId: string
    level: number
    survey?: typeof SurveyNumber extends React.FC<infer P> ? P : never
  }) => {
    const { character, status, setStatus, currentStatus } = useContext(EditorContext)
    const master = status.modLevel[modId] || 0
    const currentMaster = currentStatus ? currentStatus.modLevel[modId] || 0 : undefined
    const needElite = level > 0 && (status.elite < 2 || status.level < character.modUnlockLevel)
    const already = master >= level
    const disabled = currentMaster != null ? currentMaster > level : false
    return (
      <>
        {survey ? <SurveyNumber {...survey} /> : null}
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
  const { currentStatus, character, survey, surveyCount } = useContext(EditorContext)
  if (character.rarity < 3) return <></>

  const uniEquips = character.uniEquips.filter((x) => x.raw.unlockEvolvePhase > 'PHASE_0')
  if (!uniEquips.length) return <></>

  const all = currentStatus ? uniEquips.every((equip) => currentStatus.modLevel[equip.key] === 3) : false
  if (all) return <></>

  const modSurveys = survey
    ? ({
        X: survey.modX,
        Y: survey.modY,
        D: survey.modD,
      } as Record<string, ArknightsDataManager['raw']['operatorSurvey']['result'][0]['modX']>)
    : undefined

  return (
    <>
      {uniEquips.map((equip) => {
        const ss = modSurveys?.[equip.raw.typeName2!]
        return (
          <div key={equip.key}>
            {survey && ss ? (
              <SurveyNumber
                desc={'解锁了此模组的人数（一级及以上）/持有人数'}
                percent={ss.count}
                samples={surveyCount * survey.own}
              />
            ) : null}
            <ButtonGroup className={Classes.DARK}>
              <Tag large={true} style={{ fontFamily: 'monospace' }}>
                {equip.raw.typeName1}-{equip.raw.typeName2}
              </Tag>
              <ModButton modId={equip.key} level={0} />
              <ModButton
                modId={equip.key}
                level={1}
                survey={
                  survey && ss
                    ? {
                        desc: '解锁了此模组一级的人数/解锁了此模组的人数（一级及以上）',
                        percent: ss.rank1 / ss.count,
                        samples: surveyCount * survey.own * ss.count,
                      }
                    : undefined
                }
              />
              <ModButton
                modId={equip.key}
                level={2}
                survey={
                  survey && ss
                    ? {
                        desc: '解锁了此模组二级的人数/解锁了此模组的人数（一级及以上）',
                        percent: ss.rank2 / ss.count,
                        samples: surveyCount * survey.own * ss.count,
                      }
                    : undefined
                }
              />
              <ModButton
                modId={equip.key}
                level={3}
                survey={
                  survey && ss
                    ? {
                        desc: '解锁了此模组三级的人数/解锁了此模组的人数（一级及以上）',
                        percent: ss.rank3 / ss.count,
                        samples: surveyCount * survey.own * ss.count,
                      }
                    : undefined
                }
              />
              <Tag
                large={false}
                style={{ width: 150, overflow: 'hidden', background: 'none' }}
                className={Classes.TEXT_OVERFLOW_ELLIPSIS}
              >
                {equip.raw.uniEquipName}
              </Tag>
            </ButtonGroup>
          </div>
        )
      })}
    </>
  )
})

export function CharacterStatusSkillSection() {
  const { currentStatus, character, survey } = useContext(EditorContext)
  if (!character.skills.length) return <></>
  if ((currentStatus?.skillLevel || 0) >= 7) return <></>

  return (
    <>
      <div>
        <ButtonGroup>
          {survey ? <SurveyDummy /> : null}
          <Tag large={true}>技能</Tag>
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
  const charId = character.key
  const statusAtom = isGoal ? atoms.goalCharacter(charId) : atoms.currentCharacter(charId)
  const [status, setStatus] = useAtom(statusAtom)
  let currentStatus: Arknights['characterStatus'] | undefined = useAtomValue(atoms.currentCharacter(charId))
  if (!isGoal) currentStatus = undefined
  const ctx = {
    status,
    setStatus,
    character,
    currentStatus,
    dm,
    surveyCount: dm.raw.operatorSurvey.userCount,
    survey: dm.raw.operatorSurvey.result.find((x) => x.charId === character.key),
  } satisfies IEditorContext

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
            持有
          </Checkbox>
        )}
        {character.raw.name} - {isGoal ? '培养目标' : '当前状态'}
      </div>
      {ctx.survey ? (
        <div
          style={{
            fontSize: '85.7142857143%',
            lineHeight: '21px',
            whiteSpace: 'nowrap',
            opacity: 0.75,
          }}
        >
          <a href="https://yituliu.site/survey/operators" {...externalLinkProps}>
            练度统计
          </a>
          持有率
          <code style={{ marginLeft: 8 }}>
            {(ctx.survey.own * 100).toFixed(2)}% ({Math.round(ctx.survey.own * ctx.surveyCount)} / {ctx.surveyCount})
          </code>
        </div>
      ) : null}
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
