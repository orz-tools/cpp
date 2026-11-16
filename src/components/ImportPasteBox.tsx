import { InputGroup } from '@blueprintjs/core'
import { useSetAtom } from 'jotai'
import { memo } from 'react'
import useEvent from 'react-use-event-hook'
import { gt } from '../pkg/gt'
import { ErrAtom } from './Err'
import { useImportByContent } from './Importer'

/** A menu item that imports whatever is pasted or dropped on it, recognising the format by content. */
export const ImportPasteBox = memo(
  ({ inputRef, onImported }: { inputRef: React.Ref<HTMLInputElement>; onImported: () => void }) => {
    const importByContent = useImportByContent()
    const setErr = useSetAtom(ErrAtom)

    const importText = useEvent((text: string) => {
      if (importByContent(text)) onImported()
    })

    const importFile = useEvent(async (file: File) => {
      let text: string
      try {
        // Editors on Windows save JSON with a BOM, which JSON.parse rejects.
        text = (await file.text()).replace(/^\uFEFF/, '')
      } catch (e) {
        setErr({ error: e, context: gt.pgettext('error context', '读取文件时遇到问题') })
        return
      }
      importText(text)
    })

    const importData = (data: DataTransfer) => {
      const file = data.files[0]
      if (file) {
        void importFile(file)
      } else {
        importText(data.getData('text'))
      }
    }

    return (
      <li role="none" style={{ padding: '2px 0 5px' }}>
        <InputGroup
          leftIcon="clipboard"
          value={''}
          onChange={noop}
          placeholder={gt.gettext('在此粘贴数据或文件，自动识别格式')}
          spellCheck={false}
          inputRef={inputRef}
          onPaste={(e) => {
            e.preventDefault()
            importData(e.clipboardData)
          }}
          onDragOver={(e) => {
            if (!Array.from(e.dataTransfer.types).includes('Files')) return
            e.preventDefault()
            e.dataTransfer.dropEffect = 'copy'
          }}
          onDrop={(e) => {
            if (!Array.from(e.dataTransfer.types).includes('Files')) return
            e.preventDefault()
            importData(e.dataTransfer)
          }}
        />
      </li>
    )
  },
)

const noop = () => void 0
