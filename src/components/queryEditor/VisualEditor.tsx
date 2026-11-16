import {
  Button,
  HTMLSelect,
  Icon,
  Menu,
  MenuDivider,
  MenuItem,
  Popover,
  SegmentedControl,
  Tag,
} from '@blueprintjs/core'
import { Fragment, memo, useMemo } from 'react'
import { useCpp } from '../../Cpp'
import { FieldAssertion, QBoolean, QNumber, QueryFieldEntry, QueryParam } from '../../pkg/cpp-basic'
import {
  EditorGroup,
  EditorNode,
  GroupMode,
  canonicalOpName,
  convertOperand,
  defaultConditionFor,
  editorOpsFor,
  fieldLabel,
  groupLabel,
  groupModeLabel,
  groupModes,
  readBooleanRow,
  shownColumnWidths,
  treeToWhere,
  whereToTree,
  writeBooleanRow,
} from '../../pkg/cpp-basic/queryEditorModel'
import { gt } from '../../pkg/gt'
import { ValueInput } from './ValueInput'
import { FieldCatalog, explainConditionError } from './catalog'

const RootJoin = '\u0000'

/** 去掉空的部分和已经不显示的列的宽度，写出的 JSON 与手写的一样干净 */
export function cleanQuery(q: QueryParam): QueryParam {
  const result: QueryParam = {}
  if (q.select != null && q.select.length > 0) result.select = q.select
  if (q.join != null) result.join = q.join
  if (q.where != null) result.where = q.where
  if (q.order != null && q.order.length > 0) result.order = q.order
  if (q.group != null) result.group = q.group
  const widths = shownColumnWidths(q)
  if (widths) result.widths = widths
  return result
}

export const VisualEditor = memo(
  ({ draft, catalog, onApply }: { draft: QueryParam; catalog: FieldCatalog; onApply: (q: QueryParam) => void }) => {
    const cpp = useCpp()
    const subQueries = cpp.gameAdapter.getRootCharacterQuery().subQueries
    const tree = useMemo(() => whereToTree(draft.where), [draft.where])
    const update = (patch: Partial<QueryParam>) => onApply(cleanQuery({ ...draft, ...patch }))

    return (
      <div className="cpp-qe-body">
        <div className="cpp-qe-label">{gt.pgettext('query editor', '每行')}</div>
        <div>
          <SegmentedControl
            aria-label={gt.pgettext('query editor', '每行')}
            value={draft.join ?? RootJoin}
            onValueChange={(v) => update({ join: v === RootJoin ? undefined : v })}
            options={[
              { label: gt.pgettext('query editor', '干员'), value: RootJoin },
              ...[...subQueries.values()].map((x) => ({ label: String(x.name), value: x.id })),
              ...(draft.join != null && !subQueries.has(draft.join) ? [{ label: draft.join, value: draft.join }] : []),
            ]}
          />
        </div>

        <div className="cpp-qe-label">{gt.pgettext('query editor', '条件')}</div>
        <GroupEditor group={tree} catalog={catalog} onChange={(g) => update({ where: treeToWhere(g) })} root={true} />

        <div className="cpp-qe-label">{gt.pgettext('query editor', '排序')}</div>
        <SortEditor order={draft.order ?? []} catalog={catalog} onChange={(order) => update({ order })} />

        <div className="cpp-qe-label">{gt.pgettext('query editor', '附加列')}</div>
        <SelectEditor select={draft.select ?? []} catalog={catalog} onChange={(select) => update({ select })} />
      </div>
    )
  },
)

const FieldSelect = memo(
  ({
    catalog,
    value,
    onChange,
    invalid,
  }: {
    catalog: FieldCatalog
    value: string
    onChange: (entry: QueryFieldEntry) => void
    invalid?: boolean
  }) => {
    const resolved = catalog.resolve(value)
    const groups = useMemo(() => {
      const result: { key: string; label: string; entries: QueryFieldEntry[] }[] = []
      for (const entry of catalog.entries) {
        const last = result[result.length - 1]
        if (last && last.key === entry.group) last.entries.push(entry)
        else result.push({ key: entry.group, label: groupLabel(entry.group, entry.subName), entries: [entry] })
      }
      return result
    }, [catalog])

    return (
      <HTMLSelect
        className={`cpp-qe-field${invalid || !resolved ? ' cpp-qe-invalid' : ''}`}
        aria-label={gt.pgettext('query editor', '字段')}
        aria-invalid={invalid || !resolved}
        value={resolved?.id ?? value}
        onChange={(e) => {
          const entry = catalog.entries.find((x) => x.id === e.currentTarget.value)
          if (entry) onChange(entry)
        }}
      >
        {resolved ? null : <option value={value}>{value}</option>}
        {groups.map((g) => (
          <optgroup key={g.key} label={g.label}>
            {g.entries.map((x) => (
              <option key={x.id} value={x.id}>
                {fieldLabel(x)}
              </option>
            ))}
          </optgroup>
        ))}
      </HTMLSelect>
    )
  },
)

function newCondition(catalog: FieldCatalog): EditorNode {
  return { kind: 'field', assertion: defaultConditionFor(catalog.entries[0]) }
}

const GroupEditor = memo(
  ({
    group,
    catalog,
    onChange,
    onRemove,
    root,
  }: {
    group: EditorGroup
    catalog: FieldCatalog
    onChange: (g: EditorGroup) => void
    onRemove?: () => void
    root?: boolean
  }) => {
    const setChild = (i: number, node: EditorNode | undefined) => {
      const children = [...group.children]
      if (node) children[i] = node
      else children.splice(i, 1)
      onChange({ ...group, children })
    }

    return (
      <div className={root ? 'cpp-qe-group cpp-qe-group-root' : 'cpp-qe-group'}>
        <div className="cpp-qe-group-head">
          <span>{gt.pgettext('query editor', '满足')}</span>
          <HTMLSelect
            aria-label={gt.pgettext('query editor', '分组方式')}
            value={group.mode}
            onChange={(e) => onChange({ ...group, mode: e.currentTarget.value as GroupMode })}
          >
            {groupModes.map((m) => (
              <option key={m} value={m}>
                {groupModeLabel(m)}
              </option>
            ))}
          </HTMLSelect>
          <span>{gt.pgettext('query editor', '以下条件')}</span>
          {onRemove ? (
            <Button
              className="cpp-qe-remove"
              variant="minimal"
              icon="cross"
              title={gt.pgettext('query editor', '删除这个条件组')}
              aria-label={gt.pgettext('query editor', '删除这个条件组')}
              onClick={onRemove}
            />
          ) : null}
        </div>
        {group.children.map((child, i) =>
          child.kind === 'group' ? (
            <GroupEditor
              key={i}
              group={child}
              catalog={catalog}
              onChange={(g) => setChild(i, g)}
              onRemove={() => setChild(i, undefined)}
            />
          ) : (
            <ConditionRow
              key={i}
              assertion={child.assertion}
              catalog={catalog}
              onChange={(a) => setChild(i, { kind: 'field', assertion: a })}
              onRemove={() => setChild(i, undefined)}
            />
          ),
        )}
        <div className="cpp-qe-actions">
          <Button
            variant="minimal"
            icon="plus"
            text={gt.pgettext('query editor add', '条件')}
            onClick={() => onChange({ ...group, children: [...group.children, newCondition(catalog)] })}
          />
          <Button
            variant="minimal"
            icon="plus"
            text={gt.pgettext('query editor add', '条件组')}
            onClick={() =>
              onChange({
                ...group,
                children: [...group.children, { kind: 'group', mode: 'any', children: [newCondition(catalog)] }],
              })
            }
          />
        </div>
      </div>
    )
  },
)

const ConditionRow = memo(
  ({
    assertion: a,
    catalog,
    onChange,
    onRemove,
  }: {
    assertion: FieldAssertion
    catalog: FieldCatalog
    onChange: (a: FieldAssertion) => void
    onRemove: () => void
  }) => {
    const entry = catalog.resolve(a.field)
    const error = explainConditionError(catalog, a)
    const fieldName = entry ? fieldLabel(entry) : a.field

    let opControl: React.ReactNode
    let valueControl: React.ReactNode
    if (!entry) {
      opControl = (
        <HTMLSelect className="cpp-qe-op" disabled={true} value={a.op}>
          <option value={a.op}>{a.op}</option>
        </HTMLSelect>
      )
      valueControl = <span className="cpp-qe-value cpp-qe-raw">{JSON.stringify(a.operand)}</span>
    } else if (entry.config.type === QBoolean) {
      opControl = (
        <HTMLSelect
          className="cpp-qe-op"
          aria-label={fieldName}
          value={readBooleanRow(a) ? 'true' : 'false'}
          onChange={(e) => onChange(writeBooleanRow(a.field, e.currentTarget.value === 'true'))}
        >
          <option value="true">{gt.pgettext('query value', '是')}</option>
          <option value="false">{gt.pgettext('query value', '否')}</option>
        </HTMLSelect>
      )
      valueControl = <span className="cpp-qe-value" />
    } else {
      const ops = editorOpsFor(entry.config.type)
      const canonical = canonicalOpName(entry.config.type, a.op)
      const listed = ops.some((x) => x.name === canonical)
      opControl = (
        <HTMLSelect
          className={`cpp-qe-op${canonical ? '' : ' cpp-qe-invalid'}`}
          aria-label={gt.pgettext('query editor', '运算符')}
          value={canonical ?? a.op}
          onChange={(e) => {
            const op = e.currentTarget.value
            onChange({ ...a, op, operand: convertOperand(entry, canonical, op, a.operand) })
          }}
        >
          {listed ? null : <option value={canonical ?? a.op}>{a.op}</option>}
          {ops.map((x) => (
            <option key={x.name} value={x.name}>
              {String(x.label)}
            </option>
          ))}
        </HTMLSelect>
      )
      valueControl = canonical ? (
        <ValueInput
          entry={entry}
          op={canonical}
          operand={a.operand}
          onChange={(operand) => onChange({ ...a, operand })}
          label={gt.pgettext('query editor', '「%s」的值').replace('%s', fieldName)}
        />
      ) : (
        <span className="cpp-qe-value cpp-qe-raw">{JSON.stringify(a.operand)}</span>
      )
    }

    return (
      <>
        <div className={`cpp-qe-row${error ? ' cpp-qe-row-invalid' : ''}`}>
          <FieldSelect
            catalog={catalog}
            value={a.field}
            invalid={!entry}
            onChange={(e) => onChange(defaultConditionFor(e))}
          />
          {opControl}
          {valueControl}
          <Button
            className="cpp-qe-remove"
            variant="minimal"
            icon="cross"
            title={gt.pgettext('query editor', '删除这一条')}
            aria-label={gt.pgettext('query editor', '删除这一条')}
            onClick={onRemove}
          />
        </div>
        {error ? (
          <div className="cpp-qe-row-message" role="alert">
            <Icon icon="error" size={12} />
            <span>{error}</span>
          </div>
        ) : null}
      </>
    )
  },
)

type Order = NonNullable<QueryParam['order']>

const SortEditor = memo(
  ({ order, catalog, onChange }: { order: Order; catalog: FieldCatalog; onChange: (o: Order) => void }) => {
    const cpp = useCpp()
    const defaultHint = useMemo(() => {
      const items = (cpp.gameAdapter.getDefaultCharacterQueryOrder() ?? []).map(([id, dir]) => {
        const entry = catalog.resolve(id)
        return `${entry ? String(entry.config.name) : id} ${dir === 'DESC' ? '↓' : '↑'}`
      })
      return gt
        .pgettext('query editor', '未设置时按默认排序：%s')
        .replace('%s', items.join(gt.pgettext('list separator', '、')))
    }, [cpp, catalog])

    const move = (i: number, d: number) => {
      const next = [...order]
      ;[next[i], next[i + d]] = [next[i + d], next[i]]
      onChange(next)
    }

    return (
      <div className="cpp-qe-group">
        {order.map(([field, dir], i) => {
          const entry = catalog.resolve(field)
          return (
            <Fragment key={i}>
              <div className={`cpp-qe-row cpp-qe-sort-row${entry ? '' : ' cpp-qe-row-invalid'}`}>
                <FieldSelect
                  catalog={catalog}
                  value={field}
                  onChange={(e) => onChange(order.map((x, j) => (j === i ? [e.id, x[1]] : x)))}
                />
                <SegmentedControl
                  aria-label={gt.pgettext('query editor', '排序方向')}
                  value={dir}
                  onValueChange={(v) => onChange(order.map((x, j) => (j === i ? [x[0], v as 'ASC' | 'DESC'] : x)))}
                  options={[
                    { label: gt.pgettext('query editor', '升序'), value: 'ASC' },
                    { label: gt.pgettext('query editor', '降序'), value: 'DESC' },
                  ]}
                />
                <Button
                  variant="minimal"
                  icon="arrow-up"
                  disabled={i === 0}
                  title={gt.pgettext('query editor', '上移')}
                  aria-label={gt.pgettext('query editor', '上移')}
                  onClick={() => move(i, -1)}
                />
                <Button
                  variant="minimal"
                  icon="arrow-down"
                  disabled={i === order.length - 1}
                  title={gt.pgettext('query editor', '下移')}
                  aria-label={gt.pgettext('query editor', '下移')}
                  onClick={() => move(i, 1)}
                />
                <Button
                  className="cpp-qe-remove"
                  variant="minimal"
                  icon="cross"
                  title={gt.pgettext('query editor', '删除这一条')}
                  aria-label={gt.pgettext('query editor', '删除这一条')}
                  onClick={() => onChange(order.filter((_, j) => j !== i))}
                />
              </div>
              {entry ? null : (
                <div className="cpp-qe-row-message" role="alert">
                  <Icon icon="error" size={12} />
                  <span>{catalog.explainMissing(field)}</span>
                </div>
              )}
            </Fragment>
          )
        })}
        <div className="cpp-qe-actions">
          <Button
            variant="minimal"
            icon="plus"
            text={gt.pgettext('query editor add', '排序依据')}
            onClick={() => {
              // 先给一个还没用过的数值字段，排序多半按数值
              const used = new Set(order.map(([id]) => catalog.resolve(id)))
              const entry = catalog.entries.find((x) => x.config.type === QNumber && !used.has(x)) ?? catalog.entries[0]
              onChange([...order, [entry.id, 'DESC']])
            }}
          />
        </div>
        {order.length === 0 ? <div className="cpp-qe-note">{defaultHint}</div> : null}
      </div>
    )
  },
)

const SelectEditor = memo(
  ({ select, catalog, onChange }: { select: string[]; catalog: FieldCatalog; onChange: (s: string[]) => void }) => {
    const selectedEntries = select.map((id) => catalog.resolve(id))
    const toggle = (entry: QueryFieldEntry) => {
      const i = selectedEntries.findIndex((x) => x === entry)
      onChange(i >= 0 ? select.filter((_, j) => j !== i) : [...select, entry.id])
    }

    const menu = (
      <Menu className="cpp-qe-menu" aria-label={gt.pgettext('query editor', '附加列')}>
        {catalog.entries.map((entry, i) => (
          <Fragment key={entry.id}>
            {i === 0 || catalog.entries[i - 1].group !== entry.group ? (
              <MenuDivider title={groupLabel(entry.group, entry.subName)} />
            ) : null}
            <MenuItem
              roleStructure="listoption"
              selected={selectedEntries.includes(entry)}
              text={fieldLabel(entry)}
              shouldDismissPopover={false}
              onClick={() => toggle(entry)}
            />
          </Fragment>
        ))}
      </Menu>
    )

    return (
      <div className="cpp-qe-group">
        <div className="cpp-qe-columns">
          {select.map((id, i) => {
            const entry = selectedEntries[i]
            return (
              <Tag
                key={`${i}:${id}`}
                minimal={true}
                intent={entry ? 'none' : 'danger'}
                title={entry ? undefined : catalog.explainMissing(id)}
                onRemove={() => onChange(select.filter((_, j) => j !== i))}
              >
                {entry ? fieldLabel(entry) : id}
              </Tag>
            )
          })}
          <Popover content={menu} minimal={true} placement="bottom-start">
            <Button variant="minimal" icon="plus" text={gt.pgettext('query editor', '添加列…')} />
          </Popover>
        </div>
        {selectedEntries.some((x) => !x) ? (
          <div className="cpp-qe-row-message" role="alert">
            <Icon icon="error" size={12} />
            <span>
              {select
                .filter((_, i) => !selectedEntries[i])
                .map((id) => catalog.explainMissing(id))
                .join(' ')}
            </span>
          </div>
        ) : null}
      </div>
    )
  },
)
