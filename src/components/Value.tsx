import { Button, Icon, IconName, MaybeElement, Menu, MenuItem, Tag } from '@blueprintjs/core'
import { Popover2 } from '@blueprintjs/popover2'
import { atom, SetStateAction, useAtom, useAtomValue, useSetAtom, WritableAtom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'

enum ValueType {
  Ap = 'ap',
  Diamond = 'diamond',
  Yuan = 'yuan',
}

const ValueIcon = {
  [ValueType.Ap]: 'predictive-analysis',
  [ValueType.Diamond]: 'cube',
  [ValueType.Yuan]: (
    <span style={{ width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ fontSize: '150%' }}>￥</span>
    </span>
  ),
} satisfies Record<ValueType, IconName | MaybeElement>

const ValueName = {
  [ValueType.Ap]: 'AP',
  [ValueType.Diamond]: '源石',
  [ValueType.Yuan]: '人民币',
} satisfies Record<ValueType, string>

interface ValueParam {
  type: ValueType
}

const valueParamStorageAtom = atomWithStorage<ValueParam>('cpp_value_param', undefined as any)
const valueParamAtom: WritableAtom<ValueParam, [ValueParam | SetStateAction<ValueParam>], void> = atom<
  ValueParam,
  [ValueParam | SetStateAction<ValueParam>],
  void
>(
  (get) => {
    const value = Object.assign({}, get(valueParamStorageAtom) || {})
    if (value.type == null) value.type = ValueType.Ap
    return value
  },
  (get, set, value: ValueParam | SetStateAction<ValueParam>) =>
    set(valueParamStorageAtom, typeof value === 'function' ? value(get(valueParamAtom)) : value),
)

function throwBad(p: never): never {
  throw new Error(`Missing switch coverage: ${p}`)
}

function hasValue(value: number | null | undefined): value is number {
  if (!Number.isFinite(value) || value == null) return false
  return true
}

function format(value: number | null | undefined, param: ValueParam, single: boolean = false) {
  if (!hasValue(value)) return 'N/A'

  switch (param.type) {
    case ValueType.Ap:
      return value.toFixed(single ? 4 : 0)
    case ValueType.Diamond:
      return (value / 135).toFixed(single ? 5 : 1)
    case ValueType.Yuan:
      return ((value / 135 / 185) * 648).toFixed(single ? 6 : 2)
    default:
      throwBad(param.type)
  }
}

function formatAll(value: number | null | undefined) {
  if (!hasValue(value)) return '暂无价值'

  return [
    `${ValueName[ValueType.Ap]} ${format(value, { type: ValueType.Ap }, true)}`,
    `${ValueName[ValueType.Diamond]} ${format(value, { type: ValueType.Diamond }, true)}`,
    `${ValueName[ValueType.Yuan]} ${format(value, { type: ValueType.Yuan }, true)}`,
  ].join('\n')
}

export function ValueTag({
  value,
  minimal,
  single,
}: {
  value: number | null | undefined
  minimal?: boolean
  single?: boolean
}) {
  const param = useAtomValue(valueParamAtom)

  return (
    <Tag
      minimal={minimal}
      round={true}
      icon={<Icon color={minimal ? undefined : 'white'} icon={ValueIcon[param.type]} />}
      style={{ opacity: hasValue(value) ? 1 : 0.25 }}
      title={formatAll(value)}
    >
      {format(value, param, single)}
    </Tag>
  )
}

export function ValueTagProgressBar({
  value,
  maxValue,
  minimal,
}: {
  value: number | null | undefined
  maxValue: number | null | undefined
  minimal?: boolean
}) {
  const param = useAtomValue(valueParamAtom)

  const v = (value || 0) + 0.00000001
  const mv = (maxValue || 0) + 0.00000001
  const percent = (1 - v / mv) * 100
  const color = minimal ? '#215db044' : '#2d72d2'

  return (
    <Tag
      minimal={minimal}
      round={true}
      icon={<Icon color={minimal ? undefined : 'white'} icon={ValueIcon[param.type]} />}
      style={{
        opacity: hasValue(value) ? 1 : 0.25,
        backgroundImage: `linear-gradient(to right, ${color}, ${color} ${percent.toFixed(
          2,
        )}%, transparent ${percent.toFixed(2)}%, transparent)`,
      }}
      title={formatAll(value) + '\n\n/////\n\n' + formatAll(maxValue)}
    >
      {format(value, param)}
      {'/'}
      {format(maxValue, param)}
    </Tag>
  )
}

export function SetValueOptionMenuItem({ type }: { type: ValueType }) {
  const [param, setParam] = useAtom(valueParamAtom)
  return (
    <MenuItem
      icon={ValueIcon[type]}
      text={ValueName[type]}
      active={param.type === type}
      onClick={() => setParam((x) => ({ ...x, type: type }))}
    />
  )
}

export function ValueOptionButton() {
  const param = useAtomValue(valueParamAtom)

  return (
    <Popover2
      usePortal={true}
      minimal={true}
      content={
        <Menu>
          <SetValueOptionMenuItem type={ValueType.Ap} />
          <SetValueOptionMenuItem type={ValueType.Diamond} />
          <SetValueOptionMenuItem type={ValueType.Yuan} />
        </Menu>
      }
      position="bottom-left"
    >
      <Button icon={ValueIcon[param.type]} minimal={true} rightIcon={'chevron-down'}>
        {ValueName[param.type]}
      </Button>
    </Popover2>
  )
}
