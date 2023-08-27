import { Button, Dialog, DialogBody, InputGroup, Intent } from '@blueprintjs/core'
import { Popover2 } from '@blueprintjs/popover2'
import { Draft } from 'immer'
import { useRef, useState } from 'react'
import useEvent from 'react-use-event-hook'
import { z } from 'zod'
import { useGameAdapter } from '../../Cpp'
import { Arknights, ArknightsAdapter } from '../../pkg/cpp-arknights'
import { UserData } from '../../pkg/cpp-core/UserData'
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
      const data = SklandData.parse(JSON.parse(input))
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

  return (
    <>
      <Button icon={'import'} minimal={true} onClick={() => setOpen(true)} />
      <Dialog isOpen={open} onClose={() => setOpen(false)} title={'从森空岛导入干员练度数据'} icon="import">
        <DialogBody>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1em' }}>
            <Button style={{ fontSize: '200%', padding: '0.75em' }} intent={Intent.PRIMARY}>
              使用「提取装置」
            </Button>
            <Popover2
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
            </Popover2>
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
