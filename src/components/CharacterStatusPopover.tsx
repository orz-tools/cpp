import { Button, ButtonGroup, Checkbox, Classes, Intent, NumericInput, Tag } from '@blueprintjs/core'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import React, { useContext, useEffect, useState } from 'react'
import m1 from '../assets/m1.png'
import m2 from '../assets/m2.png'
import m3 from '../assets/m3.png'
import { useInject } from '../hooks/useContainer'
import { Character } from '../pkg/cpp-core/DataManager'
import { CharacterStatus, UserDataAtomHolder } from '../pkg/cpp-core/UserData'

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
          ? currentStatus.elite > elite || (currentStatus.elite == elite && currentStatus.level >= level)
          : false
      }
      intent={already ? Intent.PRIMARY : Intent.NONE}
      style={{ backgroundColor: already ? undefined : color }}
    >
      {level}
    </Button>
  )
}

export function CharacterStatusPopover({ character, isGoal }: { character: Character; isGoal: boolean }) {
  const atoms = useInject(UserDataAtomHolder)
  const charId = character.key
  const statusAtom = isGoal ? atoms.goalCharacter(charId) : atoms.currentCharacter(charId)
  const uniEquips = character.uniEquips.filter((x) => x.raw.unlockEvolvePhase > 0)
  const [status, setStatus] = useAtom(statusAtom)
  let currentStatus: CharacterStatus | undefined = useAtomValue(atoms.currentCharacter(charId))
  if (!isGoal) currentStatus = undefined
  const ctx = { status, setStatus, character, currentStatus }

  const modUnlockLevel = [-1, -1, -1, 40, 50, 60][character.rarity]

  return (
    <EditorContext.Provider value={ctx}>
      <div>
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
        {character.raw.name} - {isGoal ? '培养目标' : '当前状态'}
      </div>
      {status.level > 0 ? (
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
          <div>
            <ButtonGroup>
              <Tag large={true}>技能</Tag>
              <Button
                onClick={() =>
                  setStatus((x) => {
                    x.skillLevel = 1
                  })
                }
              >
                1
              </Button>
              <Button
                onClick={() =>
                  setStatus((x) => {
                    x.skillLevel = 2
                  })
                }
              >
                2
              </Button>
              <Button
                onClick={() =>
                  setStatus((x) => {
                    x.skillLevel = 3
                  })
                }
              >
                3
              </Button>
              <Button
                onClick={() =>
                  setStatus((x) => {
                    x.skillLevel = 4
                  })
                }
              >
                4
              </Button>
              <Button
                onClick={() =>
                  setStatus((x) => {
                    x.skillLevel = 5
                  })
                }
              >
                5
              </Button>
              <Button
                onClick={() =>
                  setStatus((x) => {
                    x.skillLevel = 6
                  })
                }
              >
                6
              </Button>
              <Button
                onClick={() =>
                  setStatus((x) => {
                    x.skillLevel = 7
                  })
                }
              >
                7
              </Button>
            </ButtonGroup>
          </div>

          {character.skills.map(([cSkill, skill]) => {
            return (
              <div key={skill.key}>
                <ButtonGroup className={Classes.DARK}>
                  <Tag large={true}>{skill.raw.levels[0].name}</Tag>
                  <Button
                    icon={<img src={m1} width="100%" height="100%" />}
                    onClick={() =>
                      setStatus((x) => {
                        x.skillMaster[skill.key] = 1
                      })
                    }
                  ></Button>
                  <Button
                    icon={<img src={m2} width="100%" height="100%" />}
                    onClick={() =>
                      setStatus((x) => {
                        x.skillMaster[skill.key] = 2
                      })
                    }
                  ></Button>
                  <Button
                    icon={<img src={m3} width="100%" height="100%" />}
                    onClick={() =>
                      setStatus((x) => {
                        x.skillMaster[skill.key] = 3
                      })
                    }
                  ></Button>
                </ButtonGroup>
              </div>
            )
          })}

          {uniEquips.map((equip) => {
            return (
              <div key={equip.key}>
                <ButtonGroup className={Classes.DARK}>
                  <Tag large={true}>{equip.raw.uniEquipName}</Tag>
                  <Tag large={true}>
                    {equip.raw.typeName1}-{equip.raw.typeName2}
                  </Tag>
                  <Button
                    onClick={() =>
                      setStatus((x) => {
                        x.modLevel[equip.key] = 0
                      })
                    }
                  >
                    0
                  </Button>
                  <Button
                    onClick={() =>
                      setStatus((x) => {
                        x.modLevel[equip.key] = 1
                      })
                    }
                  >
                    1
                  </Button>
                  <Button
                    onClick={() =>
                      setStatus((x) => {
                        x.modLevel[equip.key] = 2
                      })
                    }
                  >
                    2
                  </Button>
                  <Button
                    onClick={() =>
                      setStatus((x) => {
                        x.modLevel[equip.key] = 3
                      })
                    }
                  >
                    3
                  </Button>
                </ButtonGroup>
              </div>
            )
          })}
        </>
      ) : undefined}
    </EditorContext.Provider>
  )
}
