import { Card, CardList, Dialog, DialogBody, InputGroup } from '@blueprintjs/core'
import { Draft } from 'immer'
import { pick, pickBy } from 'ramda'
import { memo } from 'react'
import useEvent from 'react-use-event-hook'
import { useGameAdapter } from '../../Cpp'
import { Arknights } from '../../pkg/cpp-arknights'
import { UserData } from '../../pkg/cpp-core/UserData'
import { gt } from '../../pkg/gt'
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

        const list = new Set(
          Object.keys(ga.getInventoryPages())
            .map((x) => ga.getInventoryItems(x))
            .flat()
            .map((x) => x.key),
        )
        const pickByNotInTheList = pickBy<Record<string, number>>((_, k) => !list.has(k))

        draft.items = {
          ...quans,
          ...pickRetainableItems(draft.items),
          ...pickByNotInTheList(draft.items),
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

  // const focusRef = useRef<HTMLInputElement>(null)
  // const focus = useEvent(() => focusRef.current?.focus())

  return (
    <Dialog isOpen={true} onClose={onClose} title={gt.gettext('导入「MAA 仓库识别」数据')} icon="log-in">
      <DialogBody>
        <CardList compact>
          <MyCard step={1}>{gt.pgettext('arknights maa step', '打开 MAA「小工具」')}</MyCard>
          <MyCard step={2}>{gt.pgettext('arknights maa step', '选择「仓库识别」功能')}</MyCard>
          <MyCard step={3}>{gt.pgettext('arknights maa step', '点击「开始识别」按钮')}</MyCard>
          <MyCard step={4}>{gt.pgettext('arknights maa step', '等待识别完成')}</MyCard>
          <MyCard step={5}>{gt.pgettext('arknights maa step', '点击「导出至明日方舟工具箱」按钮')}</MyCard>
          <MyCard step={6}>
            <InputGroup
              onPaste={handleInput}
              value={''}
              placeholder={gt.gettext('请在此粘贴...')}
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
