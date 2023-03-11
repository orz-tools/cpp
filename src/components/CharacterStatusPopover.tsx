import { Button, ButtonGroup, Checkbox, Classes, Intent, NumericInput, Tag } from '@blueprintjs/core'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import React, { useContext, useEffect, useState } from 'react'
import m0 from '../assets/m0.png'
import m1 from '../assets/m1.png'
import m2 from '../assets/m2.png'
import m3 from '../assets/m3.png'
import { useInject } from '../hooks/useContainer'
import { Character, Skill } from '../pkg/cpp-core/DataManager'
import { CharacterStatus, UserDataAtomHolder } from '../pkg/cpp-core/UserData'

const modUnlockLevels = [-1, -1, -1, 40, 50, 60]

const setStatusAtomTypeHolder = () => useSetAtom(null as any as ReturnType<UserDataAtomHolder['goalCharacter']>)
const EditorContext = React.createContext<{
  status: CharacterStatus
  currentStatus?: CharacterStatus
  setStatus: ReturnType<typeof setStatusAtomTypeHolder>
  character: Character
}>(undefined as any)

export function EliteLevelInput({ elite }: { elite: number }) {
  const { character, status, setStatus, currentStatus } = useContext(EditorContext)
  const [input, setInput] = useState(String(status.level))
  useEffect(() => setInput(String(status.level)), [status.level])

  if (status.elite != elite) return <></>
  return (
    <NumericInput
      value={input}
      min={currentStatus ? (currentStatus.elite == elite ? currentStatus.level : 1) : 1}
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
}

export function EliteLevelButton({ elite, level, color }: { elite: number; level: number; color?: string }) {
  const { status, setStatus, currentStatus } = useContext(EditorContext)
  const already = status.elite > elite || (status.elite == elite && status.level >= level)
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
          ? currentStatus.elite > elite || (currentStatus.elite == elite && currentStatus.level > level)
          : false
      }
      intent={already ? Intent.PRIMARY : Intent.NONE}
      style={{ backgroundColor: already ? undefined : color }}
    >
      {level}
    </Button>
  )
}

export function CharacterStatusEliteLevelSection() {
  const { status, setStatus, currentStatus, character } = useContext(EditorContext)
  const modUnlockLevel = modUnlockLevels[character.rarity]
  return (
    <>
      {character.maxElite >= 0 &&
      !(
        currentStatus &&
        (currentStatus.elite > 0 || (currentStatus.elite == 0 && currentStatus.level >= character.maxLevels[0]))
      ) ? (
        <div>
          <ButtonGroup>
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
        (currentStatus.elite > 1 || (currentStatus.elite == 1 && currentStatus.level >= character.maxLevels[1]))
      ) ? (
        <div>
          <ButtonGroup>
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
        (currentStatus.elite > 2 || (currentStatus.elite == 2 && currentStatus.level >= character.maxLevels[2]))
      ) ? (
        <div>
          <ButtonGroup>
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
                  color={lv == modUnlockLevel ? 'rgba(0,0,255,0.25)' : undefined}
                />
              ))}
            <EliteLevelInput elite={2} />
          </ButtonGroup>
        </div>
      ) : undefined}
    </>
  )
}

export function SkillButton({ level }: { level: number }) {
  const { status, setStatus, currentStatus } = useContext(EditorContext)
  const already = status.skillLevel >= level
  const needElite = status.elite == 0 ? level >= 5 : false
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
}

export function SkillMasterButton({ skillId, level }: { skillId: string; level: number }) {
  const { status, setStatus, currentStatus } = useContext(EditorContext)
  const master = status.skillMaster[skillId] || 0
  const currentMaster = currentStatus ? currentStatus.skillMaster[skillId] || 0 : undefined
  const needElite = status.elite < 2 || status.skillLevel < 7
  const already = master >= level
  const disabled = currentMaster != null ? currentMaster > level : false
  return (
    <Button
      onClick={() =>
        setStatus((x) => {
          if (x.elite < 2) {
            x.elite = 2
            x.level = 1
          }
          if (x.skillLevel < 7) x.skillLevel = 7
          x.skillMaster[skillId] = level
        })
      }
      disabled={disabled}
      intent={already ? Intent.PRIMARY : needElite ? Intent.WARNING : Intent.NONE}
      icon={<img src={[m0, m1, m2, m3][level]} width="100%" height="100%" />}
    ></Button>
  )
}

export function CharacterStatusSkillMasterSection() {
  const { status, setStatus, currentStatus, character } = useContext(EditorContext)
  if (!character.skills.length) return <></>
  if (character.rarity < 3) return <></>
  const all = currentStatus ? character.skills.every(([, skill]) => currentStatus.skillMaster[skill.key] == 3) : false
  if (all) return <></>

  return (
    <>
      {character.skills.map(([cSkill, skill], index) => {
        return (
          <div key={skill.key}>
            <ButtonGroup className={Classes.DARK}>
              <Tag large={true}>{['一技能', '二技能', '三技能'][index]}</Tag>
              <SkillMasterButton skillId={skill.key} level={0} />
              <SkillMasterButton skillId={skill.key} level={1} />
              <SkillMasterButton skillId={skill.key} level={2} />
              <SkillMasterButton skillId={skill.key} level={3} />
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
}

export function ModButton({ modId, level }: { modId: string; level: number }) {
  const { character, status, setStatus, currentStatus } = useContext(EditorContext)
  const master = status.modLevel[modId] || 0
  const currentMaster = currentStatus ? currentStatus.modLevel[modId] || 0 : undefined
  const needElite = status.elite < 2 || status.level < modUnlockLevels[character.rarity]
  const already = master >= level
  const disabled = currentMaster != null ? currentMaster > level : false
  return (
    <Button
      onClick={() =>
        setStatus((x) => {
          if (x.elite < 2) {
            x.elite = 2
            x.level = 1
          }
          if (x.level < modUnlockLevels[character.rarity]) x.level = modUnlockLevels[character.rarity]
          x.modLevel[modId] = level
        })
      }
      disabled={disabled}
      intent={already ? Intent.PRIMARY : needElite ? Intent.WARNING : Intent.NONE}
    >
      {level}
    </Button>
  )
}

export function CharacterStatusModSection() {
  const { status, setStatus, currentStatus, character } = useContext(EditorContext)
  if (character.rarity < 3) return <></>

  const uniEquips = character.uniEquips.filter((x) => x.raw.unlockEvolvePhase > 0)
  if (!uniEquips.length) return <></>

  const all = currentStatus ? uniEquips.every((equip) => currentStatus.modLevel[equip.key] == 3) : false
  if (all) return <></>

  return (
    <>
      {uniEquips.map((equip, index) => {
        return (
          <div key={equip.key}>
            <ButtonGroup className={Classes.DARK}>
              <Tag large={true} style={{ fontFamily: 'monospace' }}>
                {equip.raw.typeName1}-{equip.raw.typeName2}
              </Tag>
              <ModButton modId={equip.key} level={0} />
              <ModButton modId={equip.key} level={1} />
              <ModButton modId={equip.key} level={2} />
              <ModButton modId={equip.key} level={3} />
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
}

export function CharacterStatusSkillSection() {
  const { status, setStatus, currentStatus, character } = useContext(EditorContext)
  if (!character.skills.length) return <></>
  if ((currentStatus?.skillLevel || 0) >= 7) return <></>

  return (
    <>
      <div>
        <ButtonGroup>
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

export function CharacterStatusPopover({ character, isGoal }: { character: Character; isGoal: boolean }) {
  const atoms = useInject(UserDataAtomHolder)
  const charId = character.key
  const statusAtom = isGoal ? atoms.goalCharacter(charId) : atoms.currentCharacter(charId)
  const [status, setStatus] = useAtom(statusAtom)
  let currentStatus: CharacterStatus | undefined = useAtomValue(atoms.currentCharacter(charId))
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
}
