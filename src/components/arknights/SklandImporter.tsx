import {
  Button,
  Callout,
  Dialog,
  DialogBody,
  DialogFooter,
  InputGroup,
  Intent,
  Popover,
  Spinner,
} from '@blueprintjs/core'
import { useSetAtom } from 'jotai'
import React, { memo, useEffect, useRef, useState } from 'react'
import useEvent from 'react-use-event-hook'
import { z } from 'zod'
import { useGameAdapter } from '../../Cpp'
import { useRequest } from '../../hooks/useRequest'
import { Arknights, ArknightsAdapter } from '../../pkg/cpp-arknights'
import { SklandData } from '../../pkg/cpp-arknights/skland'
import { gt } from '../../pkg/gt'
import { ErrAtom } from '../Err'
import { useImportByContent } from '../Importer'
import { useSklandImport } from './importHooks'

export const SklandImporterDialog = memo(({ onClose }: { onClose: () => void }) => {
  const ga = useGameAdapter<Arknights>() as ArknightsAdapter
  const importSkland = useSklandImport()
  const importByContent = useImportByContent()

  const handleInput = useEvent<React.ClipboardEventHandler<HTMLInputElement>>((e) => {
    e.preventDefault()
    const error = importByContent(e.clipboardData.getData('Text'))
    if (error) {
      alert(error)
    } else {
      handleClose()
    }
  })

  const focusRef = useRef<HTMLInputElement>(null)
  const focus = useEvent(() => focusRef.current?.focus())
  const setErr = useSetAtom(ErrAtom)

  const dm = ga.getDataManager()
  const refreshData = useEvent(async () => {
    try {
      const r = await dm.checkUpdates(true)
      if (r || dm.dataUpdatedAfterInit) {
        return true
      }
    } catch (e) {
      console.error(e)
      return false
    }
    return false
  })
  const { loading, send, response } = useRequest(refreshData)

  const [windowRef, setWindowRef] = useState<WindowProxy | null>(null)

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

  const processMessage = useEvent((e: MessageEvent) => {
    if (typeof e.data !== 'object') return
    if (e.data?.from !== 'sklanding') return
    let data: SklandData
    try {
      data = SklandingData.parse(e.data).data
    } catch (e) {
      setErr({ error: e, context: gt.pgettext('error context', '与「提取装置」互操作时遇到问题') })
      return
    }
    onClose()
    importSkland(data)
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
      } catch {
        alert(gt.gettext('请在弹出的「提取装置」中继续操作'))
      }
    } else {
      const windowWidth = 500
      const windowHeight = 700
      const left = Math.floor((window.screenLeft || 0) + window.innerWidth / 2 - windowWidth / 2)
      const top = Math.floor((window.screenTop || 0) + window.innerHeight / 2 - windowHeight / 2)
      const popup = window.open(
        `https://skland.xkcdn.win/?${new URLSearchParams({
          appName: 'Closure++ 二游计算器',
          origin: window.origin,
          scopes: ['chars', 'building.training', 'cultivate.characters', 'cultivate.items'].join(','),
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
      } catch {
        alert(gt.gettext('请在弹出的「提取装置」中继续操作'))
      }
    } else {
      handleClose()
    }
  })

  const deviceLabel = windowRef ? gt.gettext('回到「提取装置」') : gt.gettext('使用「提取装置」')

  return (
    <Dialog
      isOpen={true}
      onClose={handleClose}
      title={gt.gettext('导入森空岛数据')}
      icon="log-in"
      canOutsideClickClose={false}
      backdropProps={{ onClick: handleBackdrop }}
    >
      {loading ? (
        <Loading />
      ) : response ? (
        <ForceRefresh />
      ) : (
        <DialogBody>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1em' }}>
            {windowRef ? <Callout intent="warning" title={gt.gettext('请在弹出窗口中继续操作')} /> : null}
            <Button
              style={{ fontSize: '200%', padding: '0.75em' }}
              intent={windowRef ? Intent.PRIMARY : Intent.PRIMARY}
              onClick={handleDevice}
            >
              {deviceLabel}
            </Button>
            <Popover
              position="bottom"
              onOpened={focus}
              content={
                <>
                  <Callout intent="danger" title={gt.gettext('你走错了？！')}>
                    {gt
                      .gettext('请点击上方的%s继续。') /* I10N: %s: the button label above, in bold */
                      .split('%s')
                      .flatMap((x, i) => [i > 0 ? <strong key="label">{deviceLabel}</strong> : null, x])}
                    <br />
                    <br />
                    {gt.gettext('这是给无法使用「提取装置」的人提供的备用入口。')}
                    <br />
                    {gt.gettext('请勿在此粘贴任何凭据。')}
                  </Callout>
                  <div style={{ padding: '1em' }}>
                    <InputGroup
                      onPaste={handleInput}
                      value={''}
                      placeholder={gt.gettext('在此粘贴…')}
                      inputRef={focusRef}
                      style={{ width: '100%' }}
                      onChange={noop}
                    />
                  </div>
                </>
              }
            >
              <Button variant="minimal" text={gt.gettext('粘贴 JSON')} style={{ color: 'rgba(0, 0, 0, 0.25)' }} />
            </Popover>
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

const ForceRefresh = React.memo(() => {
  return (
    <>
      <DialogBody>
        <Callout intent="warning">{gt.gettext('游戏数据已更新，请重新载入后再尝试导入。')}</Callout>
      </DialogBody>
      <DialogFooter
        actions={
          <Button onClick={() => location.reload()} variant="minimal" intent={Intent.PRIMARY}>
            {gt.gettext('重新载入')}
          </Button>
        }
      />
    </>
  )
})

const noop = () => void 0

const SklandingData = z.object({
  version: z.literal(1),
  from: z.literal('sklanding'),
  type: z.literal('arknights'),
  data: SklandData,
})
