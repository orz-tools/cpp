import {
  AnchorButton,
  Button,
  Classes,
  Dialog,
  DialogBody,
  DialogFooter,
  type DialogProps,
  MenuItem,
  NonIdealState,
  TextArea,
} from '@blueprintjs/core'
import { useStore } from 'jotai'
import { type ReactNode, memo, useEffect, useRef, useState } from 'react'
import useEvent from 'react-use-event-hook'
import { useCpp } from '../Cpp'
import { gt } from '../pkg/gt'
import { formatProfileName, getStoragePrefix } from '../profiles'
import { useChamber } from './Chamber'
import { ErrAtom } from './Err'

/** A snapshot of the stored data, taken once when the component mounts. */
export function useUserDataDump(game: string, instanceName: string) {
  const [data] = useState(() => {
    const storagePrefix = getStoragePrefix(game, instanceName)
    try {
      const d = localStorage.getItem(storagePrefix + 'userdata')
      const p = localStorage.getItem(storagePrefix + 'preference')
      if (!d) throw new Error('empty')
      const now = Date.now()
      const userdata = JSON.stringify({
        '@type': '@orz/cpp/dump',
        '@version': 1,
        game: game,
        instanceName: instanceName,
        exportedAt: now,
        userdata: JSON.parse(d || ''),
        preference: p ? JSON.parse(p) : undefined,
        region: localStorage.getItem(storagePrefix + 'region') || '',
      })
      return { data: userdata, now: now }
    } catch (e) {
      console.warn(e)
      return undefined
    }
  })
  return data
}

export const UserDataManager = memo(
  ({ game, instanceName, onClose }: { game: string; instanceName: string; onClose?: DialogProps['onClose'] }) => {
    const data = useUserDataDump(game, instanceName)

    return (
      <Dialog
        isOpen={true}
        onClose={onClose}
        title={`Closure${formatProfileName(game, instanceName)}++ ${gt.gettext('用户数据管理')}`}
        icon="database"
      >
        <UserDataManagerContent data={data} game={game} instanceName={instanceName} />
      </Dialog>
    )
  },
)

export const UserDataManagerContent = memo(
  ({
    data,
    game,
    instanceName,
    exportOnly,
    children,
  }: {
    data?: { data: string; now: number } | undefined
    game: string
    instanceName: string
    /** For a game whose support is gone: the data can still leave and be cleared, but nothing comes in. */
    exportOnly?: boolean
    children?: ReactNode
  }) => {
    const [value, setValue] = useState(() => data?.data || '')

    // jotai's hook rather than Cpp's: a retired game's page mounts this without a Cpp around it.
    const store = useStore()

    const importData = useEvent((text: string) => {
      if (
        !confirm(
          gt.gettext(
            '警告：你确定要导入数据吗？\n' +
              '你现在的数据将会被永久覆盖！（真的很久！）\n' +
              '\n' +
              '若导入错误、无效的数据将可能导致页面无法正常运行，\n' +
              '届时可在「用户数据管理」中清空数据。',
          ),
        )
      )
        return
      try {
        const v = JSON.parse(text)
        if (v['@type'] !== '@orz/cpp/dump') throw new Error(gt.gettext('这不是 Closure++ 用户数据。'))
        if (v['@version'] !== 1) throw new Error(gt.gettext('这份 Closure++ 用户数据的版本无法识别。'))
        if (v['game'] !== game)
          throw new Error(
            gt
              .gettext('这是 Closure++ 的 %s 用户数据，不能导入到当前游戏。') /* I10N: %s: game codename */
              .replaceAll('%s', String(v['game']).toUpperCase()),
          )
        if (!v['userdata'] || typeof v['userdata'] !== 'object')
          throw new Error(gt.gettext('这份 Closure++ 用户数据已损坏。'))
        localStorage.setItem(getStoragePrefix(game, instanceName) + 'userdata', JSON.stringify(v['userdata']))
        if (!v['preference'] || typeof v['preference'] !== 'object') {
          //
        } else {
          localStorage.setItem(getStoragePrefix(game, instanceName) + 'preference', JSON.stringify(v['preference']))
        }
        if (v['region'] == null || typeof v['region'] !== 'string') {
          //
        } else {
          localStorage.setItem(getStoragePrefix(game, instanceName) + 'region', v['region'])
        }
        alert(gt.gettext('数据已导入，将重新载入页面。'))
        location.reload()
      } catch (e) {
        store.set(ErrAtom, { error: e, context: gt.pgettext('error context', '导入数据时遇到问题') })
      }
    })

    const importFile = useEvent(async (file: File) => {
      let text: string
      try {
        // Editors on Windows save JSON with a BOM, which JSON.parse rejects.
        text = (await file.text()).replace(/^\uFEFF/, '')
      } catch (e) {
        store.set(ErrAtom, { error: e, context: gt.pgettext('error context', '读取文件时遇到问题') })
        return
      }
      setValue(text)
      importData(text)
    })

    const fileInputRef = useRef<HTMLInputElement>(null)
    const [dragging, setDragging] = useState(false)
    useEffect(() => {
      if (exportOnly) return
      // Listening on window rather than the dialog: Blueprint focuses its own container, which sits outside
      // our children, so a paste right after opening would never reach an element of ours. The dialog is
      // modal, so nothing else on the page competes for these events while it is open.
      let dragEnd: ReturnType<typeof setTimeout> | undefined
      const hasFiles = (dt: DataTransfer | null) => !!dt && Array.from(dt.types).includes('Files')
      const onDragOver = (e: DragEvent) => {
        if (!hasFiles(e.dataTransfer)) return
        e.preventDefault()
        e.dataTransfer!.dropEffect = 'copy'
        setDragging(true)
        // dragover repeats while the pointer is held; dragleave fires on every child boundary and, when the
        // drag leaves the window or is cancelled, not reliably at all. Ending on silence covers all of them.
        clearTimeout(dragEnd)
        dragEnd = setTimeout(() => setDragging(false), 200)
      }
      const onDrop = (e: DragEvent) => {
        if (!hasFiles(e.dataTransfer)) return
        e.preventDefault()
        clearTimeout(dragEnd)
        setDragging(false)
        const file = e.dataTransfer!.files[0]
        if (file) void importFile(file)
      }
      const onPaste = (e: ClipboardEvent) => {
        const file = e.clipboardData?.files[0]
        if (!file) return
        e.preventDefault()
        void importFile(file)
      }
      window.addEventListener('dragover', onDragOver)
      window.addEventListener('drop', onDrop)
      window.addEventListener('paste', onPaste)
      return () => {
        clearTimeout(dragEnd)
        window.removeEventListener('dragover', onDragOver)
        window.removeEventListener('drop', onDrop)
        window.removeEventListener('paste', onPaste)
      }
    }, [importFile, exportOnly])

    const resetData = useEvent(() => {
      if (!confirm(gt.gettext('警告：你确定要清空数据吗？\n' + '你现在的数据将会永久失去！（真的很久！）'))) return

      localStorage.removeItem(getStoragePrefix(game, instanceName) + 'userdata')
      localStorage.removeItem(getStoragePrefix(game, instanceName) + 'preference')
      localStorage.removeItem(getStoragePrefix(game, instanceName) + 'region')
      location.reload()
    })

    return (
      <>
        <DialogBody>
          {children}
          {exportOnly ? null : (
            <p className={Classes.TEXT_MUTED}>{gt.gettext('可将导出的文件拖入此处，或直接粘贴文件导入。')}</p>
          )}
          <div style={{ position: 'relative' }}>
            <TextArea
              size="small"
              value={value}
              style={{
                width: '100%',
                minWidth: '400px',
                height: '200px',
                fontFamily: 'monospace',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}
              onChange={(e) => setValue(e.target.value)}
              readOnly={exportOnly}
              placeholder={exportOnly ? gt.gettext('没有可导出的数据。') : undefined}
              spellCheck="false"
            />
            {dragging && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  pointerEvents: 'none',
                  background: 'rgba(45, 114, 210, 0.15)',
                  outline: '2px dashed #2d72d2',
                  outlineOffset: -2,
                  backdropFilter: 'blur(2px)',
                }}
              >
                <NonIdealState icon="import" title={gt.gettext('松开以导入文件')} />
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0]
              // Reset so that picking the same file again still fires onChange.
              e.target.value = ''
              if (file) void importFile(file)
            }}
          />
        </DialogBody>
        <DialogFooter
          actions={
            <>
              <Button variant="minimal" intent={'danger'} icon="trash" text={gt.gettext('清空')} onClick={resetData} />
              {exportOnly ? null : (
                <>
                  <Button
                    variant="minimal"
                    intent={'primary'}
                    icon="document-open"
                    text={gt.gettext('从文件导入')}
                    onClick={() => fileInputRef.current?.click()}
                  />
                  <Button
                    variant="minimal"
                    intent={'primary'}
                    icon="log-in"
                    text={gt.gettext('从文本框中导入')}
                    onClick={() => importData(value)}
                  />
                </>
              )}
            </>
          }
        >
          <iframe name="cpp-export-download-target" style={{ display: 'none' }}></iframe>
          <AnchorButton
            variant="minimal"
            href={data ? 'data:text/json,' + encodeURIComponent(data.data) : ''}
            icon={'log-out'}
            target={'cpp-export-download-target'}
            text={gt.gettext('导出为文件')}
            download={data ? `cpp-dump-${game}-${instanceName}-${data.now}.json` : undefined}
            disabled={!data}
          />
        </DialogFooter>
      </>
    )
  },
)

export const UserDataManagerButton = memo(() => {
  const cpp = useCpp()
  const game = cpp.gameAdapter.getCodename()
  const instanceName = cpp.instanceName
  const { add } = useChamber()
  return (
    <Button
      variant="minimal"
      icon={'database'}
      text={gt.gettext('用户数据管理')}
      onClick={() => {
        add(UserDataManager, {
          game: game,
          instanceName: instanceName,
        })
      }}
    />
  )
})

export const UserDataManagerMenuItem = memo(() => {
  const cpp = useCpp()
  const game = cpp.gameAdapter.getCodename()
  const instanceName = cpp.instanceName
  const { add } = useChamber()
  return (
    <MenuItem
      icon={'database'}
      text={gt.gettext('用户数据管理')}
      onClick={() => {
        add(UserDataManager, {
          game: game,
          instanceName: instanceName,
        })
      }}
    />
  )
})
