import { Alert, Button } from '@blueprintjs/core'
import { useSetAtom, useStore } from 'jotai'
import { pick } from 'ramda'
import { memo, useState } from 'react'
import { useAtoms, useGameAdapter } from '../../Cpp'
import { Arknights } from '../../pkg/cpp-arknights'

const pickRetainableItems = pick([
  '4001', // 龙门币
  '4006', // 采购凭证
])

export const ItemImportButton = memo(() => {
  return (
    <>
      <MAAItemImportButton />
    </>
  )
})

const MAAItemImportButton = memo(<G extends Arknights>() => {
  const ga = useGameAdapter<G>()
  const atoms = useAtoms<G>()
  const store = useStore()
  const setData = useSetAtom(atoms.dataAtom)
  const [isOpen, setIsOpen] = useState(false)
  const [msg, setMsg] = useState('')
  return (
    <>
      <Button
        icon={'log-in'}
        minimal={true}
        onClick={() => {
          try {
            const input = prompt('Import from MAA: \nMAA 仓库识别 beta -> 导出至明日方舟工具箱 -> 下面粘贴') || ''
            if (!input) return
            const data = JSON.parse(input)
            if (!data) return
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
              setIsOpen(true)
            }
          } catch (e) {
            alert(e)
          }
        }}
      />
      <Alert confirmButtonText="Okay" isOpen={isOpen} onClose={() => setIsOpen(false)}>
        <pre style={{ tabSize: 16 }}>{msg}</pre>
      </Alert>
    </>
  )
})
