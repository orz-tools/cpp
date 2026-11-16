import { Callout, InputGroup } from '@blueprintjs/core'
import { useSetAtom } from 'jotai'
import { memo, useState } from 'react'
import useEvent from 'react-use-event-hook'
import { gt } from '../pkg/gt'
import { ErrAtom } from './Err'
import { useImportByContent } from './Importer'

/** A menu item that imports whatever is pasted or dropped on it, recognising the format by content. */
export const ImportPasteBox = memo(
  ({ inputRef, onImported }: { inputRef: React.Ref<HTMLInputElement>; onImported: () => void }) => {
    const importByContent = useImportByContent()
    const setErr = useSetAtom(ErrAtom)
    const [error, setError] = useState<string>()

    const importText = useEvent((text: string) => {
      const error = importByContent(text)
      if (error) {
        setError(error)
      } else {
        onImported()
      }
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
      setError(undefined)
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
        {error ? (
          <Callout
            intent="danger"
            compact
            icon={null}
            // width 0 + min-width 100%: wrap at the menu's width instead of stretching the menu to one long line
            style={{ marginTop: '5px', width: 0, minWidth: '100%' }}
          >
            {error}
          </Callout>
        ) : null}
      </li>
    )
  },
)

const noop = () => void 0
