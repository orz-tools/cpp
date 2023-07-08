import { Button, Icon, IconName, MaybeElement, Menu, MenuItem, Tag } from '@blueprintjs/core'
import { Popover2 } from '@blueprintjs/popover2'
import { useAtom, useAtomValue } from 'jotai'
import React from 'react'
import { ValueType, useCpp } from '../Cpp'

const ValueIcon = {
  [ValueType.Ap]: 'predictive-analysis',
  [ValueType.Diamond]: 'cube',
  [ValueType.Yuan]: (
    <span style={{ width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ fontSize: '150%' }}>￥</span>
    </span>
  ),
  [ValueType.Time]: 'time',
} satisfies Record<ValueType, IconName | MaybeElement>

const ValueName = {
  [ValueType.Ap]: 'AP',
  [ValueType.Diamond]: '源石',
  [ValueType.Yuan]: '人民币',
  [ValueType.Time]: '时间',
} satisfies Record<ValueType, string>

const ValueDescription = {
  [ValueType.Ap]: null,
  [ValueType.Diamond]: '(按 1 源石 = 135 AP)',
  [ValueType.Yuan]: '(按 648 元 = 185 源石)',
  [ValueType.Time]: '(按每小时回复 10 AP)',
} satisfies Record<ValueType, React.ReactNode>

function throwBad(p: never): never {
  throw new Error(`Missing switch coverage: ${p}`)
}

function hasValue(value: number | null | undefined): value is number {
  if (!Number.isFinite(value) || value == null) return false
  return true
}

function format(value: number | null | undefined, type: ValueType, single = false) {
  if (!hasValue(value)) return '?'

  switch (type) {
    case ValueType.Ap:
      return value.toFixed(single ? 4 : 0)
    case ValueType.Diamond:
      return (value / 135).toFixed(single ? 5 : 1)
    case ValueType.Yuan:
      return ((value / 135 / 185) * 648).toFixed(single ? 6 : 2)
    case ValueType.Time:
      return formatTime((value / 10) * 3600)
    default:
      throwBad(type)
  }
}

function formatTime(seconds: number) {
  if (seconds > 86400) {
    return `${(seconds / 86400).toFixed(2)}d`
  }
  if (seconds > 3600) {
    return `${(seconds / 3600).toFixed(2)}h`
  }
  if (seconds > 60) {
    return `${(seconds / 60).toFixed(2)}m`
  }
  if (seconds > 1) {
    return `${seconds.toFixed(2)}s`
  }
  return `${(seconds * 1000).toFixed(0)}ms`
}

function formatAll(value: number | null | undefined) {
  if (!hasValue(value)) return '暂无价值'

  return Object.values(ValueType)
    .map((x) => {
      return `${ValueName[x]} ${format(value, x, true)}`
    })
    .join('\n')
}

export function ValueTag({
  value,
  minimal,
  single,
  style,
}: {
  value: number | null | undefined
  minimal?: boolean
  single?: boolean
  style?: React.CSSProperties
}) {
  const cpp = useCpp()
  const type = useAtomValue(cpp.preferenceAtoms.valueTypeAtom)

  return (
    <Tag
      minimal={minimal}
      round={true}
      icon={<Icon color={minimal ? undefined : 'white'} icon={ValueIcon[type]} />}
      style={{
        paddingLeft: 4,
        paddingRight: 4,
        opacity: hasValue(value) ? 1 : 0.25,
        ...style,
      }}
      title={formatAll(value)}
    >
      {format(value, type, single)}
    </Tag>
  )
}

export function SampleTag({
  sample,
  minimal,
  style,
}: {
  sample: number | null | undefined
  minimal?: boolean
  style?: React.CSSProperties
}) {
  return Number.isFinite(sample) ? (
    <Tag
      minimal={minimal}
      round={true}
      icon={<Icon color={minimal ? undefined : 'white'} icon={'lab-test'} />}
      style={{
        paddingLeft: 4,
        paddingRight: 4,
        ...style,
      }}
      title={'样本数'}
    >
      {sample}
    </Tag>
  ) : null
}

export function ValueTagProgressBar({
  value,
  maxValue,
  minimal,
  style,
}: {
  value: number | null | undefined
  maxValue: number | null | undefined
  minimal?: boolean
  style?: React.CSSProperties
}) {
  const cpp = useCpp()
  const type = useAtomValue(cpp.preferenceAtoms.valueTypeAtom)

  const v = (value || 0) + 0.00000001
  const mv = (maxValue || 0) + 0.00000001
  const percent = (1 - v / mv) * 100
  const color = minimal ? '#215db044' : '#2d72d2'

  if ((maxValue || 0) === 0) {
    return (
      <Tag
        minimal={minimal}
        round={true}
        icon={<Icon color={minimal ? undefined : 'white'} icon={ValueIcon[type]} />}
        style={{
          paddingLeft: 4,
          paddingRight: 4,
          opacity: 0.25,
          ...style,
        }}
      >
        ?
      </Tag>
    )
  }

  return (
    <Tag
      minimal={minimal}
      round={true}
      icon={<Icon color={minimal ? undefined : 'white'} icon={ValueIcon[type]} />}
      style={{
        paddingLeft: 4,
        paddingRight: 4,
        opacity: hasValue(value) ? 1 : 0.25,
        backgroundImage: `linear-gradient(to left, ${color}, ${color} ${percent.toFixed(
          2,
        )}%, transparent ${percent.toFixed(2)}%, transparent)`,
        ...style,
      }}
      title={formatAll(value) + '\n\n/////\n\n' + formatAll(maxValue)}
    >
      {format(value, type)}
      {'/'}
      {format(maxValue, type)}
    </Tag>
  )
}

export function SetValueOptionMenuItem({ type }: { type: ValueType }) {
  const cpp = useCpp()
  const [ctype, setType] = useAtom(cpp.preferenceAtoms.valueTypeAtom)
  return (
    <MenuItem
      icon={ValueIcon[type]}
      text={
        <>
          {ValueName[type]} <span style={{ opacity: 0.75, fontWeight: 'normal' }}>{ValueDescription[type]}</span>
        </>
      }
      active={ctype === type}
      onClick={() => setType(type)}
    />
  )
}

export function ValueOptionButton() {
  const cpp = useCpp()
  const type = useAtomValue(cpp.preferenceAtoms.valueTypeAtom)

  return (
    <Popover2
      usePortal={true}
      minimal={true}
      content={
        <Menu>
          {Object.values(ValueType).map((x) => (
            <SetValueOptionMenuItem type={x} key={x} />
          ))}
        </Menu>
      }
      position="bottom-left"
    >
      <Button icon={ValueIcon[type]} minimal={true} rightIcon={'chevron-down'}>
        {ValueName[type]}
      </Button>
    </Popover2>
  )
}
