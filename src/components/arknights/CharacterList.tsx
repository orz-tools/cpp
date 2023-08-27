import { Button, Dialog, DialogBody, InputGroup, Intent, Popover } from '@blueprintjs/core'
import { Draft } from 'immer'
import { useSetAtom } from 'jotai'
import { useEffect, useRef, useState } from 'react'
import useEvent from 'react-use-event-hook'
import { z } from 'zod'
import { useGameAdapter } from '../../Cpp'
import { Arknights, ArknightsAdapter } from '../../pkg/cpp-arknights'
import { UserData } from '../../pkg/cpp-core/UserData'
import { ErrAtom } from '../Err'
import { ImportContext, useStartImportSession } from '../Importer'

export function CharacterImportButton() {
  return (
    <>
      <SklandCharacterImportButton />
    </>
  )
}

export function SklandCharacterImportButton() {
  const ga = useGameAdapter<Arknights>() as ArknightsAdapter
  const [open, setOpen] = useState(false)
  const startImportSession = useStartImportSession()
  const handleData = useEvent((input: string) => {
    setOpen(false)
    startImportSession(() => {
      const dm = ga.getDataManager()
      const empty = ga.getUserDataAdapter().getFrozenEmptyCharacterStatus()
      let raw = JSON.parse(input)
      if (typeof raw === 'object' && typeof raw.data === 'object') {
        raw = raw.data
      }
      const data = SklandData.parse(raw)
      return (draft: Draft<UserData<Arknights>>, ctx: ImportContext) => {
        let shitEquip = false
        const keys = new Set(Object.keys(draft.current))
        for (const char of data.chars) {
          const key = ga.getRealCharacterKey(char.charId)
          const c = ga.getCharacter(key)
          if (!c) {
            throw new Error(`找不到角色 ${key}`)
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
            '森空岛目前提供的数据无法准确区分您的模组到底是没开还是仅 1 级。对于这种情况，此导入程序将会跳过这些模组。如果您有 1 级模组，请自行核对。',
          )
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
      alert('你粘贴的东西好像不太对哦~')
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
      setErr({ error: e, context: '与「提取装置」互操作时遇到问题' })
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
        windowRef.close()
      } catch (e) {
        console.error(e)
      }
      setWindowRef(null)
    } else {
      const windowWidth = 500
      const windowHeight = 700
      const left = (window.screenLeft || 0) + window.innerWidth / 2 - windowWidth / 2
      const top = (window.screenTop || 0) + window.innerHeight / 2 - windowHeight / 2
      const popup = window.open(
        `https://skland.xkcdn.win/?${new URLSearchParams({
          appName: 'Closure++ 二游计算器',
          origin: window.origin,
          scopes: ['chars'].join(','),
        })}`,
        '_blank',
        `width=${windowWidth},height=${windowHeight},left=${left},top=${top},toolbar=no,location=no,directories=no,status=no,menubar=no,copyhistory=no`,
      )
      setWindowRef(popup)
    }
  })

  return (
    <>
      <Button icon={'import'} minimal={true} onClick={() => setOpen(true)} />
      <Dialog isOpen={open} onClose={() => setOpen(false)} title={'从森空岛导入干员练度数据'} icon="import">
        <DialogBody>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1em' }}>
            <Button
              style={{ fontSize: '200%', padding: '0.75em' }}
              intent={windowRef ? Intent.DANGER : Intent.PRIMARY}
              onClick={handleDevice}
            >
              {windowRef ? `放弃「提取装置」` : `使用「提取装置」`}
            </Button>
            <Popover
              position="bottom"
              onOpened={focus}
              content={
                <div style={{ padding: '1em' }}>
                  <InputGroup
                    onPaste={handleInput}
                    value={''}
                    placeholder="请在此粘贴..."
                    inputRef={focusRef}
                    style={{ width: '10em' }}
                    onChange={noop}
                  />
                </div>
              }
            >
              <Button minimal text={'粘贴 JSON'} />
            </Popover>
          </div>
        </DialogBody>
      </Dialog>
    </>
  )
}

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
})

const SklandingData = z.object({
  version: z.literal(1),
  from: z.literal('sklanding'),
  type: z.literal('arknights'),
  data: SklandData,
})
