import { Button, FormGroup, InputGroup } from '@blueprintjs/core'
import { memo, useId, useState } from 'react'
import { gt } from '../../pkg/gt'

/** 另存为、重命名共用的命名 Popover 内容 */
export const NameDialog = memo(
  ({
    initialName,
    onSave,
    onCancel,
  }: {
    initialName: string
    onSave: (name: string) => void
    onCancel: () => void
  }) => {
    const [name, setName] = useState(initialName)
    const id = useId()
    const trimmed = name.trim()
    const submit = () => {
      if (trimmed) onSave(trimmed)
    }

    return (
      <form
        className="cpp-qe-name-dialog"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <FormGroup label={gt.pgettext('query editor', '名称')} labelFor={id}>
          <InputGroup
            id={id}
            autoFocus={true}
            value={name}
            onValueChange={setName}
            onFocus={(e) => e.currentTarget.select()}
          />
        </FormGroup>
        <div className="cpp-qe-name-dialog-actions">
          <Button variant="minimal" text={gt.pgettext('query editor', '取消')} onClick={onCancel} />
          <Button type="submit" intent="primary" disabled={!trimmed} text={gt.pgettext('query editor', '保存')} />
        </div>
      </form>
    )
  },
)
