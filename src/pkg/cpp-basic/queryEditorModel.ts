import { PSTR, gt } from '../gt'
import { Assertion, FieldAssertion, QueryFieldEntry, QueryFieldGroup, QueryParam } from './queries'
import { QBoolean, QueryValueType } from './queryTypes'

export type GroupMode = 'all' | 'any' | 'none' | 'notAll'
export type EditorGroup = { kind: 'group'; mode: GroupMode; children: EditorNode[] }
export type EditorField = { kind: 'field'; assertion: FieldAssertion }
export type EditorNode = EditorGroup | EditorField

export const groupModes: GroupMode[] = ['all', 'any', 'none', 'notAll']

export function groupModeLabel(mode: GroupMode): string {
  switch (mode) {
    case 'all':
      return gt.pgettext('query group mode', '全部')
    case 'any':
      return gt.pgettext('query group mode', '任一')
    case 'none':
      return gt.pgettext('query group mode', '都不满足')
    case 'notAll':
      return gt.pgettext('query group mode', '不全满足')
  }
}

function nodeOf(a: Assertion): EditorNode {
  if (a._ === 'field') return { kind: 'field', assertion: a }
  return groupOf(a)
}

function groupOf(a: Assertion): EditorGroup {
  switch (a._) {
    case '&&':
      return { kind: 'group', mode: 'all', children: a.operand.map(nodeOf) }
    case '||':
      return { kind: 'group', mode: 'any', children: a.operand.map(nodeOf) }
    case '!': {
      const inner = a.operand
      if (inner._ === '||') return { kind: 'group', mode: 'none', children: inner.operand.map(nodeOf) }
      if (inner._ === '&&') return { kind: 'group', mode: 'notAll', children: inner.operand.map(nodeOf) }
      return { kind: 'group', mode: 'none', children: [nodeOf(inner)] }
    }
    case 'field':
      return { kind: 'group', mode: 'all', children: [nodeOf(a)] }
    default:
      throw new Error(`Unknown assertion ${JSON.stringify((a as any)?._)}`)
  }
}

export function whereToTree(where: QueryParam['where']): EditorGroup {
  if (where == null) return { kind: 'group', mode: 'all', children: [] }
  return groupOf(where)
}

function writeNode(node: EditorNode): Assertion {
  return node.kind === 'field' ? node.assertion : writeGroup(node)
}

function writeGroup(group: EditorGroup): Assertion {
  const operand = group.children.map(writeNode)
  switch (group.mode) {
    case 'all':
      return { _: '&&', operand }
    case 'any':
      return { _: '||', operand }
    case 'none':
      // 单个条件或另一个 ! 直接包，读回来仍是同一个“都不满足”分组
      if (operand.length === 1 && (operand[0]._ === 'field' || operand[0]._ === '!')) {
        return { _: '!', operand: operand[0] }
      }
      return { _: '!', operand: { _: '||', operand } }
    case 'notAll':
      return { _: '!', operand: { _: '&&', operand } }
  }
}

export function treeToWhere(group: EditorGroup): Assertion | undefined {
  if (group.children.length === 0) return undefined
  // 根分组只有一个条件时写成裸条件，与预设的写法一致
  if (group.mode === 'all' && group.children.length === 1 && group.children[0].kind === 'field') {
    return group.children[0].assertion
  }
  return writeGroup(group)
}

/** 结构比较前的规整：经编辑器树往返一次，去掉 null 的键 */
export function normalizeQuery(param: QueryParam): QueryParam {
  const result: QueryParam = {}
  if (param.join != null) result.join = param.join
  const where = treeToWhere(whereToTree(param.where))
  if (where !== undefined) result.where = where
  if (param.order != null && param.order.length > 0) result.order = param.order
  if (param.select != null && param.select.length > 0) result.select = param.select
  if (param.group != null) result.group = param.group
  return result
}

export interface EditorOp {
  name: string
  label: PSTR
}

export function editorOpsFor(type: QueryValueType<any>): EditorOp[] {
  switch (type.name) {
    case 'QNumber':
      return [
        { name: 'eq', label: '=' },
        { name: 'ne', label: '≠' },
        { name: 'lt', label: '<' },
        { name: 'le', label: '≤' },
        { name: 'gt', label: '>' },
        { name: 'ge', label: '≥' },
      ]
    case 'QString':
      return [
        { name: 'eq', label: gt.pgettext('query operator', '是') },
        { name: 'ne', label: gt.pgettext('query operator', '不是') },
        { name: 'in', label: gt.pgettext('query operator', '是其中之一') },
        { name: 'notIn', label: gt.pgettext('query operator', '不是其中之一') },
        { name: 'contains', label: gt.pgettext('query operator', '包含') },
        { name: 'startsWith', label: gt.pgettext('query operator', '开头是') },
        { name: 'endsWith', label: gt.pgettext('query operator', '结尾是') },
        { name: 'matches', label: gt.pgettext('query operator', '匹配正则') },
      ]
    case 'QStrings':
      return [{ name: 'contains', label: gt.pgettext('query operator', '包含') }]
    default:
      return []
  }
}

export function canonicalOpName(type: QueryValueType<any>, nameOrAlias: string): string | undefined {
  return type.ops.get(nameOrAlias)?.name
}

export function isListOp(op: string | undefined) {
  return op === 'in' || op === 'notIn'
}

export function readBooleanRow(a: FieldAssertion): boolean {
  const op = canonicalOpName(QBoolean, a.op)
  if (op === 'eq') return a.operand === true
  if (op === 'ne') return a.operand === false
  return true
}

export function writeBooleanRow(field: string, value: boolean): FieldAssertion {
  return { _: 'field', field, op: '==', operand: value }
}

function firstOptionValue(entry: QueryFieldEntry) {
  const options = entry.config.options?.()
  return options && options.length > 0 ? options[0].value : undefined
}

export function defaultOperandFor(entry: QueryFieldEntry, op: string): any {
  if (isListOp(op)) return []
  if (op === 'matches') return ''
  const option = firstOptionValue(entry)
  if (option !== undefined) return option
  switch (entry.config.type.name) {
    case 'QNumber':
      return 0
    case 'QBoolean':
      return true
    default:
      return ''
  }
}

export function defaultConditionFor(entry: QueryFieldEntry): FieldAssertion {
  const type = entry.config.type
  if (type === QBoolean) return writeBooleanRow(entry.id, true)
  const op = editorOpsFor(type)[0]?.name ?? type.ops.keys().next().value!
  return { _: 'field', field: entry.id, op, operand: defaultOperandFor(entry, op) }
}

/** 换运算符时尽量保留已填的值 */
export function convertOperand(entry: QueryFieldEntry, fromOp: string | undefined, toOp: string, operand: any): any {
  if (fromOp === toOp) return operand
  if (isListOp(toOp)) {
    if (isListOp(fromOp)) return operand
    return operand === '' || operand == null || fromOp === 'matches' ? [] : [operand]
  }
  if (isListOp(fromOp)) {
    return Array.isArray(operand) && operand.length > 0 ? operand[0] : defaultOperandFor(entry, toOp)
  }
  if (toOp === 'matches' || fromOp === 'matches') return defaultOperandFor(entry, toOp)
  return operand
}

export function toDisplay(entry: QueryFieldEntry, v: number): number {
  if (entry.config.format === 'percent') return Number((v * 100).toPrecision(12))
  return v
}

export function fromDisplay(entry: QueryFieldEntry, v: number): number {
  if (entry.config.format === 'percent') return Number((v / 100).toPrecision(12))
  return v
}

export interface RegexOperand {
  pattern: string
  ignoreCase: boolean
  /** i 以外的标志，原样保留 */
  otherFlags: string
}

export function readRegexOperand(operand: any): RegexOperand {
  if (Array.isArray(operand)) {
    const flags = String(operand[1] ?? '')
    return { pattern: String(operand[0] ?? ''), ignoreCase: flags.includes('i'), otherFlags: flags.replace('i', '') }
  }
  return { pattern: typeof operand === 'string' ? operand : '', ignoreCase: false, otherFlags: '' }
}

export function writeRegexOperand(r: RegexOperand): string | [string, string] {
  const flags = (r.ignoreCase ? 'i' : '') + r.otherFlags
  return flags ? [r.pattern, flags] : r.pattern
}

export function groupLabel(group: QueryFieldGroup, subName?: PSTR): string {
  switch (group) {
    case 'character':
      return gt.pgettext('query field group', '干员')
    case 'current':
      return gt.pgettext('query field group', '当前状态')
    case 'goal':
      return gt.pgettext('query field group', '目标状态')
    case 'sub':
      return String(subName ?? '')
  }
}

export function fieldLabel(entry: QueryFieldEntry): string {
  let label = String(entry.config.name)
  const id = entry.config.id
  if (id.startsWith('current.')) label = gt.pgettext('query field', '%s（当前）').replaceAll('%s', label)
  else if (id.startsWith('goal.')) label = gt.pgettext('query field', '%s（目标）').replaceAll('%s', label)
  if (entry.group === 'sub')
    label = gt.pgettext('query field', '%1 · %2').replace('%1', String(entry.subName)).replace('%2', label)
  return label
}
