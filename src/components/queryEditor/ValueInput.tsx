import { Button, Checkbox, HTMLSelect, InputGroup, Menu, MenuItem, Popover, Tag, TagInput } from '@blueprintjs/core'
import { memo, useMemo } from 'react'
import { FieldOption, QNumber, QStrings, QueryFieldEntry } from '../../pkg/cpp-basic'
import {
  fromDisplay,
  isListOp,
  readRegexOperand,
  toDisplay,
  writeRegexOperand,
} from '../../pkg/cpp-basic/queryEditorModel'
import { gt } from '../../pkg/gt'
import { useDebouncedCommit } from './useDebouncedCommit'

interface ValueInputProps {
  entry: QueryFieldEntry
  /** 规范运算符名 */
  op: string
  operand: any
  onChange: (operand: any) => void
  label: string
}

export const ValueInput = memo(({ entry, op, operand, onChange, label }: ValueInputProps) => {
  const options = useMemo(() => entry.config.options?.(), [entry])
  const type = entry.config.type

  if (options && isListOp(op)) {
    return <OptionMultiSelect options={options} value={operand} onChange={onChange} label={label} />
  }
  if (options && (op === 'eq' || op === 'ne' || type === QStrings)) {
    return <OptionSelect options={options} value={operand} onChange={onChange} label={label} />
  }
  if (type === QNumber) {
    return <NumberValue entry={entry} value={operand} onChange={onChange} label={label} />
  }
  if (isListOp(op)) {
    return (
      <TagInput
        className="cpp-qe-value"
        values={Array.isArray(operand) ? operand.map(String) : []}
        onChange={(values) => onChange(values.map(String))}
        addOnBlur={true}
        placeholder={gt.pgettext('query editor', '输入后回车添加')}
        inputProps={{ 'aria-label': label }}
      />
    )
  }
  if (op === 'matches') {
    return <RegexValue value={operand} onChange={onChange} label={label} />
  }
  return <TextValue value={typeof operand === 'string' ? operand : ''} onChange={onChange} label={label} />
})

const OptionSelect = memo(
  ({
    options,
    value,
    onChange,
    label,
  }: {
    options: FieldOption[]
    value: any
    onChange: (v: any) => void
    label: string
  }) => {
    const known = options.some((x) => x.value === value)
    return (
      <HTMLSelect
        className="cpp-qe-value"
        aria-label={label}
        value={JSON.stringify(value)}
        onChange={(e) => onChange(JSON.parse(e.currentTarget.value))}
      >
        {known ? null : <option value={JSON.stringify(value)}>{JSON.stringify(value)}</option>}
        {options.map((x) => (
          <option key={JSON.stringify(x.value)} value={JSON.stringify(x.value)}>
            {String(x.label)}
          </option>
        ))}
      </HTMLSelect>
    )
  },
)

const OptionMultiSelect = memo(
  ({
    options,
    value,
    onChange,
    label,
  }: {
    options: FieldOption[]
    value: any
    onChange: (v: any[]) => void
    label: string
  }) => {
    const selected: any[] = Array.isArray(value) ? value : []
    const labelOf = (v: any) => String(options.find((x) => x.value === v)?.label ?? JSON.stringify(v))
    const toggle = (v: any) => onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v])

    return (
      <Popover
        className="cpp-qe-value"
        minimal={true}
        placement="bottom-start"
        content={
          <Menu aria-label={label}>
            {options.map((x) => (
              <MenuItem
                key={JSON.stringify(x.value)}
                roleStructure="listoption"
                selected={selected.includes(x.value)}
                text={String(x.label)}
                shouldDismissPopover={false}
                onClick={() => toggle(x.value)}
              />
            ))}
          </Menu>
        }
      >
        <Button
          className="cpp-qe-tags-button"
          fill={true}
          alignText="start"
          endIcon="caret-down"
          aria-label={label}
          text={
            selected.length === 0 ? (
              <span className="cpp-qe-placeholder">{gt.pgettext('query editor', '选择…')}</span>
            ) : (
              <span className="cpp-qe-tags">
                {selected.map((v) => (
                  <Tag key={JSON.stringify(v)} minimal={true}>
                    {labelOf(v)}
                  </Tag>
                ))}
              </span>
            )
          }
        />
      </Popover>
    )
  },
)

const NumberValue = memo(
  ({
    entry,
    value,
    onChange,
    label,
  }: {
    entry: QueryFieldEntry
    value: any
    onChange: (v: number) => void
    label: string
  }) => {
    const percent = entry.config.format === 'percent'
    const text = typeof value === 'number' && Number.isFinite(value) ? String(toDisplay(entry, value)) : ''
    const input = useDebouncedCommit(text, (t) => {
      const n = Number(t)
      if (t.trim() === '' || !Number.isFinite(n)) return
      onChange(fromDisplay(entry, n))
    })
    return (
      <InputGroup
        className="cpp-qe-value"
        type="number"
        aria-label={label}
        value={input.value}
        onValueChange={input.onChange}
        onFocus={input.onFocus}
        onBlur={input.onBlur}
        rightElement={percent ? <span className="cpp-qe-unit">%</span> : undefined}
      />
    )
  },
)

const TextValue = memo(
  ({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) => {
    const input = useDebouncedCommit(value, onChange)
    return (
      <InputGroup
        className="cpp-qe-value"
        aria-label={label}
        value={input.value}
        onValueChange={input.onChange}
        onFocus={input.onFocus}
        onBlur={input.onBlur}
      />
    )
  },
)

const RegexValue = memo(({ value, onChange, label }: { value: any; onChange: (v: any) => void; label: string }) => {
  const regex = readRegexOperand(value)
  const input = useDebouncedCommit(regex.pattern, (pattern) => onChange(writeRegexOperand({ ...regex, pattern })))
  return (
    <div className="cpp-qe-value cpp-qe-regex">
      <InputGroup
        aria-label={label}
        className="cpp-qe-mono"
        value={input.value}
        onValueChange={input.onChange}
        onFocus={input.onFocus}
        onBlur={input.onBlur}
      />
      <Checkbox
        className="cpp-qe-checkbox"
        checked={regex.ignoreCase}
        label={gt.pgettext('query editor', '忽略大小写')}
        onChange={(e) => onChange(writeRegexOperand({ ...regex, ignoreCase: e.currentTarget.checked }))}
      />
    </div>
  )
})
