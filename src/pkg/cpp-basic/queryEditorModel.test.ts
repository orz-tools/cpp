import deepEqual from 'deep-equal'
import { describe, expect, it, vi } from 'vitest'
import { ArknightsAdapter } from '../cpp-arknights/GameAdapter'
import { Assertion, FieldAssertion, QueryFieldEntry } from './queries'
import {
  canonicalOpName,
  convertOperand,
  defaultConditionFor,
  fromDisplay,
  readBooleanRow,
  readRegexOperand,
  toDisplay,
  treeToWhere,
  whereToTree,
  writeRegexOperand,
} from './queryEditorModel'
import { QBoolean, QNumber, QString, QStrings } from './queryTypes'

// 预设取自 ArknightsAdapter；导入它会顺带初始化 localforage，测试环境里没有存储后端
vi.mock('localforage', () => {
  const noop = new Proxy({}, { get: () => () => Promise.resolve(null) })
  return { default: { createInstance: () => noop, dropInstance: () => Promise.resolve() } }
})

const a: FieldAssertion = { _: 'field', field: 'rarity', op: '==', operand: 6 }
const b: FieldAssertion = { _: 'field', field: 'elite', op: '<', operand: 2 }
const c: FieldAssertion = { _: 'field', field: 'own', op: '==', operand: true }

function roundTrip(where: Assertion | undefined) {
  return treeToWhere(whereToTree(where))
}

function entry(type: any, extra: Partial<QueryFieldEntry['config']> = {}): QueryFieldEntry {
  return {
    id: 'f',
    group: 'character',
    config: { id: 'f', name: 'f', type, getter: () => undefined, aliases: [], ...extra },
  }
}

describe('where ⇄ tree', () => {
  it('maps the four group modes', () => {
    expect(whereToTree({ _: '&&', operand: [a, b] }).mode).toBe('all')
    expect(whereToTree({ _: '||', operand: [a, b] }).mode).toBe('any')
    expect(whereToTree({ _: '!', operand: { _: '||', operand: [a, b] } }).mode).toBe('none')
    expect(whereToTree({ _: '!', operand: { _: '&&', operand: [a, b] } }).mode).toBe('notAll')
    for (const w of [
      { _: '&&', operand: [a, b] },
      { _: '||', operand: [a, b] },
      { _: '!', operand: { _: '||', operand: [a, b] } },
      { _: '!', operand: { _: '&&', operand: [a, b] } },
    ] as Assertion[]) {
      expect(roundTrip(w)).toEqual(w)
    }
  })

  it('reads a ! around a single condition as a none group', () => {
    const w: Assertion = { _: '!', operand: a }
    const tree = whereToTree(w)
    expect(tree).toEqual({ kind: 'group', mode: 'none', children: [{ kind: 'field', assertion: a }] })
    expect(roundTrip(w)).toEqual(w)
  })

  it('keeps a double !', () => {
    const w: Assertion = { _: '!', operand: { _: '!', operand: a } }
    const tree = whereToTree(w)
    expect(tree.mode).toBe('none')
    expect(tree.children[0]).toMatchObject({ kind: 'group', mode: 'none' })
    expect(roundTrip(w)).toEqual(w)
  })

  it('keeps nested groups', () => {
    const w: Assertion = { _: '&&', operand: [{ _: '||', operand: [c, a] }, b] }
    expect(roundTrip(w)).toEqual(w)
  })

  it('treats an empty where as an empty root group', () => {
    expect(whereToTree(undefined)).toEqual({ kind: 'group', mode: 'all', children: [] })
    expect(whereToTree(null).children).toEqual([])
    expect(treeToWhere(whereToTree(undefined))).toBeUndefined()
    expect(roundTrip(a)).toEqual(a)
  })

  it('round-trips every predefined game query', () => {
    const presets = ArknightsAdapter.prototype.getPredefinedQueries.call(undefined)
    expect(Object.keys(presets).length).toBe(10)
    for (const [k, v] of Object.entries(presets)) {
      expect(deepEqual(roundTrip(v.query.where ?? undefined), v.query.where, { strict: true }), k).toBe(true)
    }
  })
})

describe('operators and values', () => {
  it('resolves operator aliases', () => {
    expect(canonicalOpName(QNumber, '==')).toBe('eq')
    expect(canonicalOpName(QNumber, '<=')).toBe('le')
    expect(canonicalOpName(QString, '~=')).toBe('matches')
    expect(canonicalOpName(QStrings, 'has')).toBe('contains')
    expect(canonicalOpName(QNumber, 'nope')).toBeUndefined()
  })

  it('reads boolean rows in both directions', () => {
    expect(readBooleanRow({ _: 'field', field: 'own', op: '==', operand: true })).toBe(true)
    expect(readBooleanRow({ _: 'field', field: 'own', op: '==', operand: false })).toBe(false)
    expect(readBooleanRow({ _: 'field', field: 'own', op: '!=', operand: true })).toBe(false)
    expect(readBooleanRow({ _: 'field', field: 'own', op: '!=', operand: false })).toBe(true)
  })

  it('reads and writes both matches operands', () => {
    expect(readRegexOperand('^Si')).toEqual({ pattern: '^Si', ignoreCase: false, otherFlags: '' })
    expect(readRegexOperand(['^Si', 'i'])).toEqual({ pattern: '^Si', ignoreCase: true, otherFlags: '' })
    expect(readRegexOperand(['^Si', 'iu'])).toEqual({ pattern: '^Si', ignoreCase: true, otherFlags: 'u' })
    expect(writeRegexOperand({ pattern: '^Si', ignoreCase: false, otherFlags: '' })).toBe('^Si')
    expect(writeRegexOperand({ pattern: '^Si', ignoreCase: true, otherFlags: '' })).toEqual(['^Si', 'i'])
    expect(writeRegexOperand({ pattern: '^Si', ignoreCase: false, otherFlags: 'u' })).toEqual(['^Si', 'u'])
  })

  it('converts percentages', () => {
    const e = entry(QNumber, { format: 'percent' })
    expect(fromDisplay(e, 42.5)).toBe(0.425)
    expect(toDisplay(e, 0.425)).toBe(42.5)
    expect(toDisplay(e, 0.07)).toBe(7)
    expect(toDisplay(entry(QNumber), 3)).toBe(3)
  })

  it('builds complete default conditions', () => {
    expect(defaultConditionFor(entry(QNumber))).toEqual({ _: 'field', field: 'f', op: 'eq', operand: 0 })
    expect(defaultConditionFor(entry(QString))).toEqual({ _: 'field', field: 'f', op: 'eq', operand: '' })
    expect(defaultConditionFor(entry(QBoolean))).toEqual({ _: 'field', field: 'f', op: '==', operand: true })
    expect(defaultConditionFor(entry(QStrings, { options: () => [{ value: 'CASTER', label: '术师' }] }))).toEqual({
      _: 'field',
      field: 'f',
      op: 'contains',
      operand: 'CASTER',
    })
    expect(defaultConditionFor(entry(QNumber, { options: () => [{ value: 1, label: '1' }] })).operand).toBe(1)
  })

  it('keeps values across operator changes where it can', () => {
    const e = entry(QString)
    expect(convertOperand(e, 'eq', 'in', 'CASTER')).toEqual(['CASTER'])
    expect(convertOperand(e, 'eq', 'in', '')).toEqual([])
    expect(convertOperand(e, 'in', 'ne', ['A', 'B'])).toBe('A')
    expect(convertOperand(e, 'eq', 'contains', 'x')).toBe('x')
    expect(convertOperand(e, 'eq', 'matches', 'x')).toBe('')
  })
})
