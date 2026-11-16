import { CardList, Dialog, DialogBody, InputGroup } from '@blueprintjs/core'
import { memo } from 'react'
import useEvent from 'react-use-event-hook'
import { gt } from '../../pkg/gt'
import { useImportByContent } from '../Importer'
import { MyCard, noop } from './MAAItemImporter'

export const ArkntoolsImporterDialog = memo(({ onClose }: { onClose: () => void }) => {
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

  return (
    <Dialog isOpen={true} onClose={onClose} title={gt.gettext('导入明日方舟工具箱「精英材料计算」备份')} icon="log-in">
      <DialogBody>
        <CardList compact>
          <MyCard step={1}>{gt.pgettext('arknights arkntools step', '打开明日方舟工具箱「精英材料计算」')}</MyCard>
          <MyCard step={2}>{gt.pgettext('arknights arkntools step', '点击「导出」→「备份」')}</MyCard>
          <MyCard step={3}>{gt.pgettext('arknights arkntools step', '点击「复制到剪贴板」')}</MyCard>
          <MyCard step={4}>
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
