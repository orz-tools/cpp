import { Button, ButtonGroup, Checkbox, Intent, NumericInput, Tag } from '@blueprintjs/core'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import React, { useContext, useEffect, useState } from 'react'
import { useAtoms } from '../../Cpp'
import { UserDataAtomHolder } from '../../pkg/cpp-core/UserData'
import { Character, Re1999 } from '../../pkg/cpp-re1999'
import { gt } from '../../pkg/gt'

const useTypeHolderForSetStatusAtom = () =>
  useSetAtom(null as any as ReturnType<UserDataAtomHolder<Re1999>['atoms']['goalCharacter']>)

const EditorContext = React.createContext<{
  status: Re1999['characterStatus']
  currentStatus?: Re1999['characterStatus']
  setStatus: ReturnType<typeof useTypeHolderForSetStatusAtom>
  character: Character
}>(undefined as any)

export function InsightLevelInput({ insight }: { insight: number }) {
  const { character, status, setStatus, currentStatus } = useContext(EditorContext)
  const [input, setInput] = useState(String(status.level))
  useEffect(() => setInput(String(status.level)), [status.level])

  if (status.insight !== insight) return <></>
  return (
    <NumericInput
      allowNumericCharactersOnly={false}
      value={input}
      min={currentStatus ? (currentStatus.insight === insight ? currentStatus.level : 1) : 1}
      max={character.maxLevels[insight]}
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
}

export function InsightLevelButton({ insight, level, color }: { insight: number; level: number; color?: string }) {
  const { status, setStatus, currentStatus } = useContext(EditorContext)
  const already = status.insight > insight || (status.insight === insight && status.level >= level)
  return (
    <Button
      onClick={() =>
        setStatus((x) => {
          x.insight = insight
          x.level = level
        })
      }
      disabled={
        currentStatus
          ? currentStatus.insight > insight || (currentStatus.insight === insight && currentStatus.level > level)
          : false
      }
      intent={already ? Intent.PRIMARY : Intent.NONE}
      style={{ backgroundColor: already ? undefined : color }}
    >
      {level}
    </Button>
  )
}

export function CharacterStatusInsightLevelSection() {
  const { currentStatus, character } = useContext(EditorContext)
  return (
    <>
      {character.maxInsight >= 0 &&
      !(
        currentStatus &&
        (currentStatus.insight > 0 || (currentStatus.insight === 0 && currentStatus.level > character.maxLevels[0]))
      ) ? (
        <div className="cpp-charstat-group">
          <ButtonGroup>
            <Tag large={true}>{gt.pgettext('re1999 status group', '洞零')}</Tag>
            <InsightLevelButton insight={0} level={1} />
            {new Array(character.maxLevels[0] / 10 + 1)
              .fill(0)
              .map((_, i) => i * 10)
              .slice(1)
              .map((lv) => (
                <InsightLevelButton key={lv} insight={0} level={lv} />
              ))}
            <InsightLevelInput insight={0} />
          </ButtonGroup>
        </div>
      ) : undefined}
      {character.maxInsight >= 1 &&
      !(
        currentStatus &&
        (currentStatus.insight > 1 || (currentStatus.insight === 1 && currentStatus.level > character.maxLevels[1]))
      ) ? (
        <div className="cpp-charstat-group">
          <ButtonGroup>
            <Tag large={true}>{gt.pgettext('re1999 status group', '洞一')}</Tag>
            <InsightLevelButton insight={1} level={1} />
            {new Array(character.maxLevels[1] / 10 + 1)
              .fill(0)
              .map((_, i) => i * 10)
              .slice(1)
              .map((lv) => (
                <InsightLevelButton key={lv} insight={1} level={lv} />
              ))}
            <InsightLevelInput insight={1} />
          </ButtonGroup>
        </div>
      ) : undefined}
      {character.maxInsight >= 2 &&
      !(
        currentStatus &&
        (currentStatus.insight > 2 || (currentStatus.insight === 2 && currentStatus.level > character.maxLevels[2]))
      ) ? (
        <div className="cpp-charstat-group">
          <ButtonGroup>
            <Tag large={true}>{gt.pgettext('re1999 status group', '洞二')}</Tag>
            <InsightLevelButton insight={2} level={1} />
            {new Array(character.maxLevels[2] / 10 + 1)
              .fill(0)
              .map((_, i) => i * 10)
              .slice(1)
              .map((lv) => (
                <InsightLevelButton key={lv} insight={2} level={lv} />
              ))}
            <InsightLevelInput insight={2} />
          </ButtonGroup>
        </div>
      ) : undefined}
      {character.maxInsight >= 3 &&
      !(
        currentStatus &&
        (currentStatus.insight > 3 || (currentStatus.insight === 3 && currentStatus.level > character.maxLevels[3]))
      ) ? (
        <div className="cpp-charstat-group">
          <ButtonGroup>
            <Tag large={true}>{gt.pgettext('re1999 status group', '洞三')}</Tag>
            <InsightLevelButton insight={3} level={1} />
            {new Array(character.maxLevels[3] / 10 + 1)
              .fill(0)
              .map((_, i) => i * 10)
              .slice(1)
              .map((lv) => (
                <InsightLevelButton key={lv} insight={3} level={lv} />
              ))}
            <InsightLevelInput insight={3} />
          </ButtonGroup>
        </div>
      ) : undefined}
    </>
  )
}

export function ResonateButton({ level }: { level: number }) {
  const { status, setStatus, currentStatus, character } = useContext(EditorContext)
  const already = status.resonate >= level
  const needInsight = level > character.maxResonateAtInsight(status.insight)
  const disabled = currentStatus ? currentStatus.resonate > level : false
  return (
    <Button
      onClick={() =>
        setStatus((x) => {
          if (needInsight && x.insight < character.resonateInsightRequires(level)) {
            x.insight = character.resonateInsightRequires(level)
            x.level = 1
          }
          x.resonate = level
        })
      }
      disabled={disabled}
      intent={already ? Intent.PRIMARY : needInsight ? Intent.WARNING : Intent.NONE}
    >
      {level}
    </Button>
  )
}

export function CharacterStatusResonateSection() {
  const { currentStatus, character } = useContext(EditorContext)
  if ((currentStatus?.resonate || 0) >= 15) return <></>

  return (
    <>
      <div className="cpp-charstat-group">
        <ButtonGroup>
          <Tag large={true}>{gt.pgettext('re1999 status group', '共鸣')}</Tag>
          {new Array(character.maxResonate).fill(0).map((_, i) => (
            <ResonateButton key={i + 1} level={i + 1} />
          ))}
        </ButtonGroup>
      </div>
    </>
  )
}

export function CharacterStatusPopover({ character, isGoal }: { character: Character; isGoal: boolean }) {
  const atoms = useAtoms<Re1999>()
  const charId = character.key
  const statusAtom = isGoal ? atoms.goalCharacter(charId) : atoms.currentCharacter(charId)
  const [status, setStatus] = useAtom(statusAtom)
  let currentStatus: Re1999['characterStatus'] | undefined = useAtomValue(atoms.currentCharacter(charId))
  if (!isGoal) currentStatus = undefined
  const ctx = { status, setStatus, character, currentStatus }

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
                  x.insight = 0
                  x.level = 1
                })
              } else {
                setStatus((x) => {
                  x.insight = 0
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
      {status.level > 0 ? (
        <>
          <CharacterStatusInsightLevelSection />
          <CharacterStatusResonateSection />

          {character.maxResonate >= 10 ? (
            <div className="cpp-charstat-group">
              <ButtonGroup>
                <Tag large={true}>{gt.pgettext('re1999 status group', '调频')}</Tag>
                <Button disabled>WIP</Button>
              </ButtonGroup>
            </div>
          ) : null}
        </>
      ) : undefined}
    </EditorContext.Provider>
  )
}
