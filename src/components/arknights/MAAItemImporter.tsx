import { Alert } from '@blueprintjs/core'
import { useSetAtom, useStore } from 'jotai'
import { pick } from 'ramda'
import { memo, useEffect, useState } from 'react'
import useEvent from 'react-use-event-hook'
import { useAtoms, useGameAdapter } from '../../Cpp'
import { Arknights } from '../../pkg/cpp-arknights'

const pickRetainableItems = pick([
  '4001', // 龙门币
  '4006', // 采购凭证
])

export const MAAItemImporterDialog = memo(<G extends Arknights>({ onClose }: { onClose: () => void }) => {
  const ga = useGameAdapter<G>()
  const atoms = useAtoms<G>()
  const store = useStore()
  const setData = useSetAtom(atoms.dataAtom)
  const [msg, setMsg] = useState('')

  const run = useEvent(() => {
    try {
      const input =
        prompt('导入「MAA 仓库识别」数据: \nMAA 小工具 -> 仓库识别 -> 导出至明日方舟工具箱 -> 下面粘贴') || ''
      if (!input) {
        onClose()
        return
      }
      const data = JSON.parse(input)
      if (!data) {
        onClose()
        return
      }
      const quans = Object.fromEntries(
        Object.entries(data).filter(([key, value]) => {
          return !!ga.getItem(key) && key[0] !== '#' && typeof value === 'number'
        }),
      )
      const before = store.get(atoms.itemQuantities)
      setData('modify', (x) => {
        x.items = {
          ...quans,
          ...pickRetainableItems(x.items),
        }
      })
      const after = store.get(atoms.itemQuantities)
      {
        // FIXME: 挪走
        const msg = [] as string[]
        const allKeys = new Set([...Object.keys(before), ...Object.keys(after)])
        let count = 0
        for (const i of allKeys) {
          const item = ga.getItem(i)
          const b = before[i] || 0
          const a = after[i] || 0
          if (a - b === 0) continue
          const v = item.valueAsAp == null ? undefined : (a - b) * item.valueAsAp
          msg.push(`${item.name}\t${b} -> ${a}\t${a - b > 0 ? '+' : '-'}${Math.abs(a - b)}\tAP ${v?.toFixed(3)}`)
          if (v != null) {
            count += v
          }
        }
        msg.push(`Σ\t\t\tAP ${count.toFixed(3)}`)
        setMsg(msg.join('\n'))
      }
    } catch (e) {
      alert(e)
      onClose()
    }
  })

  useEffect(run, [run])

  return (
    <Alert confirmButtonText="Okay" isOpen={true} onClose={onClose}>
      <pre style={{ tabSize: 16 }}>{msg}</pre>
    </Alert>
  )
})
