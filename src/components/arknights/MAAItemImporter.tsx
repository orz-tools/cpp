import { Card, CardList, Dialog, DialogBody, InputGroup } from '@blueprintjs/core'
import { Draft } from 'immer'
import { pick } from 'ramda'
import { memo } from 'react'
import useEvent from 'react-use-event-hook'
import { useGameAdapter } from '../../Cpp'
import { Arknights } from '../../pkg/cpp-arknights'
import { UserData } from '../../pkg/cpp-core/UserData'
import { ImportContext, useStartImportSession } from '../Importer'

const pickRetainableItems = pick([
  '4001', // 龙门币
  '4006', // 采购凭证
])

export const MAAItemImporterDialog = memo(<G extends Arknights>({ onClose }: { onClose: () => void }) => {
  const ga = useGameAdapter<G>()
  const startImportSession = useStartImportSession()
  const handleData = useEvent((input: string) => {
    onClose()
    startImportSession(() => {
      const data = JSON.parse(input)
      return (draft: Draft<UserData<Arknights>>, ctx: ImportContext) => {
        void ctx

        const quans = Object.fromEntries(
          Object.entries(data).filter(([key, value]) => {
            return !!ga.getItem(key) && key[0] !== '#' && typeof value === 'number'
          }),
        )

        draft.items = {
          ...quans,
          ...pickRetainableItems(draft.items),
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

  // const focusRef = useRef<HTMLInputElement>(null)
  // const focus = useEvent(() => focusRef.current?.focus())

  return (
    <Dialog isOpen={true} onClose={onClose} title={'导入「MAA 仓库识别」数据'} icon="log-in">
      <DialogBody>
        <CardList compact>
          <MyCard step={1}>打开 MAA「小工具」</MyCard>
          <MyCard step={2}>选择「仓库识别」功能</MyCard>
          <MyCard step={3}>点击「开始识别」按钮</MyCard>
          <MyCard step={4}>等待识别完成</MyCard>
          <MyCard step={5}>点击「导出至明日方舟工具箱」按钮</MyCard>
          <MyCard step={6}>
            <InputGroup
              onPaste={handleInput}
              value={''}
              placeholder="请在此粘贴..."
              autoFocus
              // inputRef={focusRef}
              style={{ width: '100%' }}
              onChange={noop}
            />
          </MyCard>
        </CardList>
      </DialogBody>
    </Dialog>
  )
})

const MyCard = memo((props: { children: React.ReactNode; step: number }) => {
  return (
    <Card>
      <span style={{ fontSize: '1.5em', marginRight: '1em' }}>{props.step}</span>
      {props.children}
    </Card>
  )
})

const noop = () => void 0
