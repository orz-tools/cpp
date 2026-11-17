import {
  Button,
  Icon,
  IconName,
  Intent,
  MaybeElement,
  Menu,
  MenuDivider,
  MenuItem,
  Popover,
  Tag,
} from '@blueprintjs/core'
import { useAtom, useAtomValue } from 'jotai'
import React, { memo } from 'react'
import { ValueType, useCpp } from '../Cpp'
import { useComponents } from '../hooks/useComponents'
import { PSTR, gt, lpstr } from '../pkg/gt'

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
  [ValueType.Ap]: lpstr(() => 'AP'),
  [ValueType.Diamond]: lpstr(() => gt.pgettext('value type', '源石')),
  [ValueType.Yuan]: lpstr(() => gt.pgettext('value type', '人民币')),
  [ValueType.Time]: lpstr(() => gt.pgettext('value type', '时间')),
} satisfies Record<ValueType, PSTR>

const ValueDescription = {
  [ValueType.Ap]: null,
  [ValueType.Diamond]: lpstr(() => gt.pgettext('value type', '(按 1 源石 = 135 AP)')),
  [ValueType.Yuan]: lpstr(() => gt.pgettext('value type', '(按 648 元 = 185 源石)')),
  [ValueType.Time]: lpstr(() => gt.pgettext('value type', '(按每小时回复 10 AP)')),
} satisfies Record<ValueType, PSTR | null>

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

function formatTime(seconds: number): string {
  if (seconds < 0) {
    return `-${formatTime(-seconds)}`
  }
  if (seconds === 0) {
    return '0'
  }
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
  if (!hasValue(value)) return gt.pgettext('value type', '暂无价值')

  return Object.values(ValueType)
    .map((x) => {
      return `${ValueName[x]} ${format(value, x, true)}`
    })
    .join('\n')
}

export const ValueTag = memo(
  ({
    value,
    minimal,
    single,
    style,
    textStyle,
    intent,
    title,
  }: {
    value: number | null | undefined
    minimal?: boolean
    single?: boolean
    style?: React.CSSProperties
    textStyle?: React.CSSProperties
    intent?: Intent
    /** 悬停说明的第一行，下面接各种单位的数 */
    title?: string
  }) => {
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
          whiteSpace: 'nowrap',
          ...style,
        }}
        title={title ? `${title}\n${formatAll(value)}` : formatAll(value)}
        intent={intent}
      >
        {/* {intent ? undefined : '约 '} */}
        <span style={textStyle}>{format(value, type, single)}</span>
      </Tag>
    )
  },
)

/** 按用户选的价值单位写的数，不带图标；悬停是各种单位的数 */
export const ValueText = memo(({ value }: { value: number | null | undefined }) => {
  const type = useAtomValue(useCpp().preferenceAtoms.valueTypeAtom)
  return <span title={formatAll(value)}>{format(value, type)}</span>
})

/** 用户选的价值单位的图标，悬停是单位名 */
export const ValueUnitIcon = memo(() => {
  const type = useAtomValue(useCpp().preferenceAtoms.valueTypeAtom)
  return (
    <span title={ValueName[type].toString()} style={{ display: 'inline-flex', verticalAlign: 'middle' }}>
      <Icon icon={ValueIcon[type]} />
    </span>
  )
})

export const SampleTag = memo(
  ({
    sample,
    minimal,
    style,
  }: {
    sample: number | null | undefined
    minimal?: boolean
    style?: React.CSSProperties
  }) => {
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
        title={gt.gettext('样本数')}
      >
        {sample}
      </Tag>
    ) : null
  },
)

export const ValueTagProgressBar = memo(
  ({
    value,
    maxValue,
    minimal,
    style,
  }: {
    value: number | null | undefined
    maxValue: number | null | undefined
    minimal?: boolean
    style?: React.CSSProperties
  }) => {
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
            filter: 'grayscale(0.5)',
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
          filter: 'grayscale(0.5)',
          ...style,
        }}
        title={formatAll(value) + '\n\n/////\n\n' + formatAll(maxValue)}
      >
        {/* {'约 '} */}
        {format(value, type)}
        {'/'}
        {format(maxValue, type)}
      </Tag>
    )
  },
)

export const SetValueOptionMenuItem = memo(({ type }: { type: ValueType }) => {
  const cpp = useCpp()
  const [ctype, setType] = useAtom(cpp.preferenceAtoms.valueTypeAtom)
  return (
    <MenuItem
      icon={ValueIcon[type]}
      text={
        <>
          {ValueName[type].toString()}{' '}
          <span style={{ opacity: 0.75, fontWeight: 'normal' }}>{ValueDescription[type]?.toString()}</span>
        </>
      }
      active={ctype === type}
      onClick={() => setType(type)}
    />
  )
})

export const ValueOptionButton = memo(() => {
  const cpp = useCpp()
  const type = useAtomValue(cpp.preferenceAtoms.valueTypeAtom)
  const { ValueConfigMenu } = useComponents()

  return (
    <Popover
      usePortal={true}
      minimal={true}
      content={
        <Menu>
          {Object.values(ValueType).map((x) => (
            <SetValueOptionMenuItem type={x} key={x} />
          ))}
          {ValueConfigMenu ? (
            <>
              <MenuDivider title={gt.pgettext('value config', '价值计算')} />
              <ValueConfigMenu />
            </>
          ) : null}
        </Menu>
      }
      position="bottom-left"
    >
      <Button icon={ValueIcon[type]} variant="minimal" endIcon={'chevron-down'}>
        {<span className={'cpp-very-compact'}>{ValueName[type].toString()}</span>}
      </Button>
    </Popover>
  )
})
