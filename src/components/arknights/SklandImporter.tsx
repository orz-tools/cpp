import { Button, Callout, Dialog, DialogBody, Intent, Spinner } from '@blueprintjs/core'
import { useSetAtom } from 'jotai'
import React, { memo, useEffect, useRef, useState } from 'react'
import useEvent from 'react-use-event-hook'
import { z } from '../../pkg/zod'
import { useGameAdapter } from '../../Cpp'
import { useRequest } from '../../hooks/useRequest'
import { Arknights, ArknightsAdapter } from '../../pkg/cpp-arknights'
import { SKLAND_SCOPES, SklandInput, toSklandInput } from '../../pkg/cpp-arknights/skland'
import { gt } from '../../pkg/gt'
import { ErrAtom } from '../Err'
import { showAlert } from '../MessageBox'
import { useSklandImport } from './importHooks'

/** Call it straight from a click: browsers block a popup opened any later. Returns null when it was blocked. */
export function openSklandDevice() {
  const windowWidth = 500
  const windowHeight = 700
  const left = Math.floor((window.screenLeft || 0) + window.innerWidth / 2 - windowWidth / 2)
  const top = Math.floor((window.screenTop || 0) + window.innerHeight / 2 - windowHeight / 2)
  return window.open(
    `https://skland.xkcdn.win/?${new URLSearchParams({
      appName: 'Closure++ 二游计算器',
      origin: window.origin,
      scopes: SKLAND_SCOPES.join(','),
    })}`,
    '_blank',
    `width=${windowWidth},height=${windowHeight},left=${left},top=${top},popup=yes`,
  )
}

/** popup: the 提取装置 the menu item opened. The dialog's own button opens it again when it did not appear. */
export const SklandImporterDialog = memo(({ onClose, popup }: { onClose: () => void; popup?: WindowProxy | null }) => {
  const ga = useGameAdapter<Arknights>() as ArknightsAdapter
  const importSkland = useSklandImport()
  const setErr = useSetAtom(ErrAtom)

  const dm = ga.getDataManager()
  const refreshData = useEvent(async () => {
    try {
      await dm.update({ absolutelyRequiredOnly: true })
    } catch (e) {
      console.error(e)
    }
    return true
  })
  const { send, response: checked } = useRequest(refreshData)

  const [windowRef, setWindowRef] = useState<WindowProxy | null>(popup ?? null)

  useEffect(() => {
    if (!windowRef) return
    const timer = setInterval(() => {
      if (windowRef.closed) setWindowRef((r) => (r === windowRef ? null : r))
    }, 100)
    return () => clearInterval(timer)
  }, [windowRef])

  useEffect(() => {
    send()
  }, [send])

  const closeDevice = useEvent(() => {
    if (!windowRef) return
    try {
      windowRef.close()
    } catch (e) {
      console.error(e)
    }
    setWindowRef(null)
  })

  const handleClose = useEvent(() => {
    closeDevice()
    onClose()
  })

  const finish = useEvent((input: SklandInput) => {
    handleClose()
    void importSkland(input)
  })

  // Data that arrives while the game data is being checked is imported once the check is over.
  const early = useRef<SklandInput | undefined>(undefined)
  useEffect(() => {
    if (checked && early.current) finish(early.current)
  }, [checked, finish])

  const processMessage = useEvent((e: MessageEvent) => {
    if (typeof e.data !== 'object') return
    if (e.data?.from !== 'sklanding') return
    let input: SklandInput
    try {
      input = toSklandInput(SklandingData.parse(e.data).data)
    } catch (e) {
      setErr({ error: e, context: gt.pgettext('error context', '与「提取装置」互操作时遇到问题') })
      return
    }
    if (checked) finish(input)
    else early.current = input
  })

  useEffect(() => {
    const handler: (typeof window)['onmessage'] = (e) => {
      processMessage(e)
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [processMessage])

  const focusDevice = useEvent((device: WindowProxy) => {
    try {
      device.focus()
    } catch {
      void showAlert(gt.gettext('请在弹出的「提取装置」中继续操作'))
    }
  })

  const handleDevice = useEvent(() => {
    if (windowRef) {
      focusDevice(windowRef)
    } else {
      setWindowRef(openSklandDevice())
    }
  })

  const handleBackdrop = useEvent(() => {
    if (windowRef) {
      focusDevice(windowRef)
    } else {
      handleClose()
    }
  })

  return (
    <Dialog
      isOpen={true}
      onClose={handleClose}
      title={gt.gettext('导入森空岛数据')}
      icon="log-in"
      canOutsideClickClose={false}
      backdropProps={{ onClick: handleBackdrop }}
    >
      {!checked ? (
        <Loading />
      ) : (
        <DialogBody>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1em' }}>
            {windowRef ? <Callout intent="warning" title={gt.gettext('请在弹出窗口中继续操作')} /> : null}
            <Button
              style={{ fontSize: '200%', padding: '0.75em' }}
              intent={windowRef ? Intent.PRIMARY : Intent.PRIMARY}
              onClick={handleDevice}
            >
              {windowRef ? gt.gettext('回到「提取装置」') : gt.gettext('使用「提取装置」')}
            </Button>
          </div>
        </DialogBody>
      )}
    </Dialog>
  )
})

const Loading = React.memo(() => {
  return (
    <DialogBody>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1em' }}>
        <Spinner size={50} />
        <p>{gt.gettext('更新数据中…')}</p>
      </div>
    </DialogBody>
  )
})

const SklandingData = z.object({
  version: z.literal(1),
  from: z.literal('sklanding'),
  type: z.literal('arknights'),
  // 原样留着存快照，由 toSklandInput 校验
  data: z.unknown(),
})
