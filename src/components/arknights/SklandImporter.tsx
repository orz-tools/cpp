import { Button, Callout, Dialog, DialogBody, InputGroup, Intent, Popover } from '@blueprintjs/core'
import { Draft } from 'immer'
import { useSetAtom } from 'jotai'
import { memo, useEffect, useRef, useState } from 'react'
import useEvent from 'react-use-event-hook'
import { z } from 'zod'
import { useGameAdapter } from '../../Cpp'
import { Arknights, ArknightsAdapter } from '../../pkg/cpp-arknights'
import { UserData } from '../../pkg/cpp-core/UserData'
import { gt } from '../../pkg/gt'
import { ErrAtom } from '../Err'
import { ImportContext, useStartImportSession } from '../Importer'

export const SklandImporterDialog = memo(({ onClose }: { onClose: () => void }) => {
  const ga = useGameAdapter<Arknights>() as ArknightsAdapter
  const startImportSession = useStartImportSession()
  const handleData = useEvent((input: string) => {
    onClose()
    startImportSession(() => {
      const dm = ga.getDataManager()
      const empty = ga.getUserDataAdapter().getFrozenEmptyCharacterStatus()
      let raw = JSON.parse(input)
      if (typeof raw === 'object' && typeof raw.data === 'object') {
        raw = raw.data
      }
      const data = SklandData.parse(raw)
      return (draft: Draft<UserData<Arknights>>, ctx: ImportContext) => {
        if (data.cultivate?.characters) {
          const keys = new Set(Object.keys(draft.current))
          for (const char of data.cultivate.characters) {
            const key = ga.getRealCharacterKey(char.id)
            const c = ga.getCharacter(key)
            if (!c) {
              throw new Error(`Character Not Found: ${key}`)
            }
            keys.delete(key)
            if (!draft.current[key]) draft.current[key] = JSON.parse(JSON.stringify(empty))
            const o = draft.current[key]
            o.elite = char.evolvePhase
            o.level = char.level
            o.skillLevel = char.mainSkillLevel
            if (char.skills) {
              for (const skill of c.skills) {
                const key = skill[0].skillId!
                const lv = char.skills.find((x) => x.id === key)?.level || 0
                if (lv > 0) {
                  o.skillMaster[key] = lv
                } else {
                  delete o.skillMaster[key]
                }
              }
            }
            if (o.elite === 2 && o.level >= dm.data.constants.modUnlockLevel[c.rarity] && char.equips) {
              const uniEquips = c.uniEquips.filter((x) => x.raw.unlockEvolvePhase > 'PHASE_0')
              for (const ue of uniEquips) {
                const level = ((): number | undefined => {
                  const d = char.equips.find((x) => x.id === ue.key)
                  if (!d) {
                    return 0
                  }
                  return d.level
                })()
                if (level === undefined) continue
                if (level === 0) {
                  delete o.modLevel[ue.key]
                } else {
                  o.modLevel[ue.key] = level
                }
              }
            }
          }
          for (const key of keys) {
            delete draft.current[key]
          }
        } else {
          let shitEquip = false
          const keys = new Set(Object.keys(draft.current))
          for (const char of data.chars) {
            const key = ga.getRealCharacterKey(char.charId)
            const c = ga.getCharacter(key)
            if (!c) {
              throw new Error(`Character Not Found: ${key}`)
            }
            keys.delete(key)
            if (!draft.current[key]) draft.current[key] = JSON.parse(JSON.stringify(empty))
            const o = draft.current[key]
            o.elite = char.evolvePhase
            o.level = char.level
            o.skillLevel = char.mainSkillLvl
            if (char.skills) {
              for (const skill of c.skills) {
                const key = skill[0].skillId!
                const lv = char.skills.find((x) => x.id === key)?.specializeLevel || 0
                if (lv > 0) {
                  o.skillMaster[key] = lv
                } else {
                  delete o.skillMaster[key]
                }
              }
            }
            if (o.elite === 2 && o.level >= dm.data.constants.modUnlockLevel[c.rarity] && char.equip) {
              const uniEquips = c.uniEquips.filter((x) => x.raw.unlockEvolvePhase > 'PHASE_0')
              for (const ue of uniEquips) {
                const level = ((): number | undefined => {
                  const d = char.equip.find((x) => x.id === ue.key)
                  if (!d) {
                    return 0
                  }
                  if (d.level > 1 || d.level === 0) {
                    return d.level
                  }
                  if (d.level === 1) {
                    if (char.defaultEquipId === ue.key) {
                      return 1
                    }
                    shitEquip = true
                    // TODO: 开没开咱也不知道啊...
                  }
                  return undefined
                })()
                if (level === undefined) continue
                if (level === 0) {
                  delete o.modLevel[ue.key]
                } else {
                  o.modLevel[ue.key] = level
                }
              }
            }
          }
          for (const key of keys) {
            delete draft.current[key]
          }
          if (shitEquip) {
            ctx.addWarning(
              gt.gettext(
                '森空岛目前提供的数据无法准确区分您的模组到底是没开还是仅 1 级。对于这种情况，此导入程序将会跳过这些模组。如果您有 1 级模组，请自行核对。',
              ),
            )
          }
        }

        if (data.cultivate?.items) {
          const quans = Object.fromEntries(
            data.cultivate.items
              .map((x) => [x.id, parseInt(x.count, 10)] as const)
              .filter(([key, value]) => {
                return !!ga.getItem(key) && key[0] !== '#' && typeof value === 'number' && Number.isFinite(value)
              }),
          )
          console.log(quans)

          draft.items = {
            ...quans,
          }
        }
      }
    })
  })

  const handleInput = useEvent<React.ClipboardEventHandler<HTMLInputElement>>((e) => {
    e.preventDefault()
    const data = e.clipboardData.getData('Text')
    if (data) {
      handleData(data)
    } else {
      alert(gt.gettext('粘贴的东西好像不太对，请重试。'))
    }
  })

  const focusRef = useRef<HTMLInputElement>(null)
  const focus = useEvent(() => focusRef.current?.focus())
  const setErr = useSetAtom(ErrAtom)

  const [windowRef, setWindowRef] = useState<WindowProxy | null>(null)

  useEffect(() => {
    if (!windowRef) return
    const timer = setInterval(() => {
      if (windowRef.closed) setWindowRef((r) => (r === windowRef ? null : r))
    }, 100)
    return () => clearInterval(timer)
  }, [windowRef])

  const processMessage = useEvent((e: MessageEvent) => {
    if (typeof e.data !== 'object') return
    if (e.data?.from !== 'sklanding') return
    let data = ''
    try {
      data = JSON.stringify(SklandingData.parse(e.data).data)
    } catch (e) {
      setErr({ error: e, context: gt.pgettext('error context', '与「提取装置」互操作时遇到问题') })
      return
    }
    handleData(data)
    if (windowRef) {
      try {
        windowRef.close()
        setWindowRef(null)
      } catch {
        //
      }
    }
  })

  useEffect(() => {
    const handler: (typeof window)['onmessage'] = (e) => {
      processMessage(e)
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [processMessage])

  const handleDevice = useEvent(() => {
    if (windowRef) {
      try {
        windowRef.focus()
      } catch (e) {
        alert(gt.gettext('请在弹出的「提取装置」中继续操作'))
      }
    } else {
      const windowWidth = 500
      const windowHeight = 700
      const left = Math.floor((window.screenLeft || 0) + window.innerWidth / 2 - windowWidth / 2)
      const top = Math.floor((window.screenTop || 0) + window.innerHeight / 2 - windowHeight / 2)
      console.log(windowWidth, windowHeight, left, top)
      const popup = window.open(
        `https://skland.xkcdn.win/?${new URLSearchParams({
          appName: 'Closure++ 二游计算器',
          origin: window.origin,
          scopes: ['chars', 'cultivate.characters', 'cultivate.items'].join(','),
        })}`,
        '_blank',
        `width=${windowWidth},height=${windowHeight},left=${left},top=${top},popup=yes`,
      )
      setWindowRef(popup)
    }
  })

  const handleClose = useEvent(() => {
    if (windowRef) {
      try {
        windowRef.close()
      } catch (e) {
        console.error(e)
      }
      setWindowRef(null)
    }
    onClose()
  })

  const handleBackdrop = useEvent(() => {
    if (windowRef) {
      try {
        windowRef.focus()
      } catch (e) {
        alert(gt.gettext('请在弹出的「提取装置」中继续操作'))
      }
    } else {
      handleClose()
    }
  })

  return (
    <Dialog
      isOpen={true}
      onClose={handleClose}
      title={gt.gettext('导入「森空岛」数据')}
      icon="log-in"
      canOutsideClickClose={false}
      backdropProps={{ onClick: handleBackdrop }}
    >
      <DialogBody>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1em' }}>
          {windowRef ? <Callout intent="warning" title={gt.gettext('请在弹出窗口中继续操作')} /> : null}
          <Button
            style={{ fontSize: '200%', padding: '0.75em' }}
            intent={windowRef ? Intent.PRIMARY : Intent.PRIMARY}
            onClick={handleDevice}
          >
            {windowRef ? `回到「提取装置」` : `使用「提取装置」`}
          </Button>
          <Popover
            position="bottom"
            onOpened={focus}
            content={
              <>
                <Callout intent="danger" title={'你走错了？！'}>
                  请您点击上方<strong>{windowRef ? '回到' : '使用'}「提取装置」</strong>继续。
                  <br />
                  <br />
                  这是给无法使用「提取装置」的人提供的备用入口。
                  <br />
                  请勿在此粘贴任何凭据。
                </Callout>
                <div style={{ padding: '1em' }}>
                  <InputGroup
                    onPaste={handleInput}
                    value={''}
                    placeholder={gt.gettext('请在此粘贴...')}
                    inputRef={focusRef}
                    style={{ width: '100%' }}
                    onChange={noop}
                  />
                </div>
              </>
            }
          >
            <Button minimal text={gt.gettext('粘贴 JSON')} style={{ color: 'rgba(0, 0, 0, 0.25)' }} />
          </Popover>
        </div>
      </DialogBody>
    </Dialog>
  )
})

const noop = () => void 0

const SklandData = z.object({
  chars: z.array(
    z.object({
      charId: z.string(),
      level: z.number().int().positive(),
      evolvePhase: z.number().int().min(0).max(2),
      potentialRank: z.number().int().min(0).max(5),
      mainSkillLvl: z.number().int().min(1).max(7),
      skills: z.array(
        z.object({
          id: z.string(),
          specializeLevel: z.number().int().min(0).max(3),
        }),
      ),
      equip: z.array(
        z.object({
          id: z.string(),
          level: z.number().int().min(1).max(3),
        }),
      ),
      defaultEquipId: z.string(),
    }),
  ),
  cultivate: z
    .object({
      characters: z.array(
        z.object({
          id: z.string(),
          level: z.number().int().positive(),
          evolvePhase: z.number().int().min(0).max(2),
          mainSkillLevel: z.number().int().min(1).max(7),
          skills: z.array(
            z.object({
              id: z.string(),
              level: z.number().int().min(0).max(3),
            }),
          ),
          equips: z.array(
            z.object({
              id: z.string(),
              level: z.number().int().min(0).max(3),
            }),
          ),
          potentialRank: z.number().int().min(0).max(5),
        }),
      ),
      items: z.array(
        z.object({
          id: z.string(),
          count: z.string().regex(/^\d+$/),
        }),
      ),
    })
    .optional(),
})

const SklandingData = z.object({
  version: z.literal(1),
  from: z.literal('sklanding'),
  type: z.literal('arknights'),
  data: SklandData,
})
