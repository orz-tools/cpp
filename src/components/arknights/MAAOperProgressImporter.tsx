import { CardList, Dialog, DialogBody, InputGroup } from '@blueprintjs/core'
import { memo } from 'react'
import useEvent from 'react-use-event-hook'
import { gt } from '../../pkg/gt'
import { useImportByContent } from '../Importer'
import { MyCard, noop } from './MAAItemImporter'

export const MAAOperProgressImporterDialog = memo(({ onClose }: { onClose: () => void }) => {
  const importByContent = useImportByContent()
  const handleInput = useEvent<React.ClipboardEventHandler<HTMLInputElement>>((e) => {
    e.preventDefault()
    if (importByContent(e.clipboardData.getData('Text'))) onClose()
  })

  return (
    <Dialog isOpen={true} onClose={onClose} title={gt.gettext('导入 MAA「干员培养」计划')} icon="log-in">
      <DialogBody>
        <CardList compact>
          <MyCard step={1}>{gt.pgettext('arknights arkntools step', '打开明日方舟工具箱「精英材料计算」')}</MyCard>
          <MyCard step={2}>{gt.pgettext('arknights arkntools step', '点击「导出」→「导出培养方案至 MAA」')}</MyCard>
          <MyCard step={3}>
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
