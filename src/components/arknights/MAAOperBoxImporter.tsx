import { CardList, Dialog, DialogBody, InputGroup } from '@blueprintjs/core'
import { memo } from 'react'
import useEvent from 'react-use-event-hook'
import { gt } from '../../pkg/gt'
import { useImportByContent } from '../Importer'
import { MyCard, noop } from './MAAItemImporter'

export const MAAOperBoxImporterDialog = memo(({ onClose }: { onClose: () => void }) => {
  const importByContent = useImportByContent()
  const handleInput = useEvent<React.ClipboardEventHandler<HTMLInputElement>>((e) => {
    e.preventDefault()
    if (importByContent(e.clipboardData.getData('Text'))) onClose()
  })

  return (
    <Dialog isOpen={true} onClose={onClose} title={gt.gettext('导入 MAA「干员识别」数据')} icon="log-in">
      <DialogBody>
        <CardList compact>
          <MyCard step={1}>{gt.pgettext('arknights maa step', '打开 MAA「小工具」')}</MyCard>
          <MyCard step={2}>{gt.pgettext('arknights maa step', '切换到「干员识别」')}</MyCard>
          <MyCard step={3}>{gt.pgettext('arknights maa step', '点击「开始识别」')}</MyCard>
          <MyCard step={4}>{gt.pgettext('arknights maa step', '等待识别完成')}</MyCard>
          <MyCard step={5}>{gt.pgettext('arknights maa step', '在「导出到」中选择「剪切板」，再点击「导出」')}</MyCard>
          <MyCard step={6}>
            <InputGroup
              onPaste={handleInput}
              value={''}
              placeholder={gt.gettext('在此粘贴…')}
              autoFocus
              style={{ width: '100%' }}
              onChange={noop}
            />
          </MyCard>
        </CardList>
      </DialogBody>
    </Dialog>
  )
})
