import { AnchorButton, Button, Dialog, DialogBody, DialogFooter, MenuItem, TextArea } from '@blueprintjs/core'
import { memo, useEffect, useState } from 'react'
import useEvent from 'react-use-event-hook'
import { useCpp, useStore } from '../Cpp'
import { gt } from '../pkg/gt'
import { formatProfileName, getStoragePrefix } from '../profiles'
import { useChamber } from './Chamber'
import { ErrAtom } from './Err'

export const UserDataManager = memo(
  ({ game, instanceName, onClose }: { game: string; instanceName: string; onClose?: Dialog['props']['onClose'] }) => {
    const storagePrefix = getStoragePrefix(game, instanceName)
    const [data, setData] = useState<{ data: string; now: number } | undefined>(undefined)
    useEffect(() => {
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
        setData({ data: userdata, now: now })
      } catch (e) {
        console.warn(e)
        setData(undefined)
      }
    }, [storagePrefix, game, instanceName])

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

const UserDataManagerContent = memo(
  ({
    data,
    game,
    instanceName,
  }: {
    data?: { data: string; now: number } | undefined
    game: string
    instanceName: string
  }) => {
    const [value, setValue] = useState('')
    useEffect(() => {
      if (data) {
        setValue(data.data || '')
      }
    }, [data])

    const store = useStore()

    const importData = useEvent(() => {
      if (
        !confirm(
          gt.gettext(
            '警告：你确定要导入数据吗？\n' +
              '你现在的数据将会被永久覆盖！（真的很久！）\n' +
              '\n' +
              '若导入错误、无效的数据将可能导致页面无法正常运行，\n' +
              '届时您可在数据管理中清空数据。',
          ),
        )
      )
        return
      try {
        const v = JSON.parse(value)
        if (v['@type'] !== '@orz/cpp/dump') throw new Error('这根本不是 @orz/cpp/dump 数据。')
        if (v['@version'] !== 1) throw new Error('@orz/cpp/dump 数据版本无法识别。')
        if (v['game'] !== game) throw new Error(`game 不匹配，请不要把 ${v['game']} 导入到 ${game}。`)
        if (!v['userdata'] || typeof v['userdata'] !== 'object') throw new Error('userdata 根本无效。')
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
        store.set(ErrAtom, { error: e, context: gt.gettext('导入数据时遇到问题') })
      }
    })

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
          <TextArea
            small
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
            spellCheck="false"
          />
        </DialogBody>
        <DialogFooter
          actions={
            <>
              <Button minimal intent={'danger'} icon="trash" text={gt.gettext('清空')} onClick={resetData} />
              <Button
                minimal
                intent={'primary'}
                icon="log-in"
                text={gt.gettext('从文本框中导入')}
                onClick={importData}
              />
            </>
          }
        >
          <iframe name="cpp-export-download-target" style={{ display: 'none' }}></iframe>
          <AnchorButton
            minimal
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
      minimal
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
