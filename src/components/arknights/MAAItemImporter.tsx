import { Card, CardList, Dialog, DialogBody, InputGroup } from '@blueprintjs/core'
import { memo } from 'react'
import useEvent from 'react-use-event-hook'
import { gt } from '../../pkg/gt'
import { useImportByContent } from '../Importer'

export const MAAItemImporterDialog = memo(({ onClose }: { onClose: () => void }) => {
  const importByContent = useImportByContent()
  const handleInput = useEvent<React.ClipboardEventHandler<HTMLInputElement>>((e) => {
    e.preventDefault()
    const error = importByContent(e.clipboardData.getData('Text'))
    if (error) {
      alert(error)
    } else {
      onClose()
    }
  })

  // const focusRef = useRef<HTMLInputElement>(null)
  // const focus = useEvent(() => focusRef.current?.focus())

  return (
    <Dialog isOpen={true} onClose={onClose} title={gt.gettext('导入 MAA「仓库识别」数据')} icon="log-in">
      <DialogBody>
        <CardList compact>
          <MyCard step={1}>{gt.pgettext('arknights maa step', '打开 MAA「小工具」')}</MyCard>
          <MyCard step={2}>{gt.pgettext('arknights maa step', '切换到「仓库识别」')}</MyCard>
          <MyCard step={3}>{gt.pgettext('arknights maa step', '点击「开始识别」')}</MyCard>
          <MyCard step={4}>{gt.pgettext('arknights maa step', '等待识别完成')}</MyCard>
          <MyCard step={5}>
            {gt.pgettext(
              'arknights maa step',
              '在「导出到」中选择「明日方舟工具箱」或「企鹅物流刷图规划」，再点击「导出」',
            )}
          </MyCard>
          <MyCard step={6}>
            <InputGroup
              onPaste={handleInput}
              value={''}
              placeholder={gt.gettext('在此粘贴…')}
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

export const MyCard = memo((props: { children: React.ReactNode; step: number }) => {
  return (
    <Card>
      <span style={{ fontSize: '1.5em', marginRight: '1em' }}>{props.step}</span>
      {props.children}
    </Card>
  )
})

export const noop = () => void 0
