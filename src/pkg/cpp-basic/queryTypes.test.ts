import { describe, expect, it } from 'vitest'
import { QBoolean, QNumber, QRegExp, QString, QStrings, QueryValueType } from './queryTypes'

describe('QNumber', () => {
  it('parses numbers and normalizes null to NaN', () => {
    expect(QNumber.parse(null)).toBeNaN()
    expect(() => QNumber.parse('1')).toThrow(/Expected number/)
  })

  it('orders NaN before numbers', () => {
    expect(QNumber.compare(NaN, 5)).toBe(-1)
    expect(QNumber.compare(5, NaN)).toBe(1)
    expect(QNumber.compare(NaN, NaN)).toBe(0)
    expect(QNumber.compare(1, 2)).toBe(-1)
    expect(QNumber.compare(2, 1)).toBe(1)
  })

  it('registers default comparison operators and aliases', () => {
    expect(QNumber.ops.get('eq')!.body(1, 1)).toBe(true)
    expect(QNumber.ops.get('==')!.body(1, 1)).toBe(true)
    expect(QNumber.ops.get('lt')!.body(1, 2)).toBe(true)
    expect(QNumber.ops.get('>=')!.body(2, 1)).toBe(true)
  })
})

describe('QString', () => {
  it('parses strings and normalizes null to empty', () => {
    expect(QString.parse(null)).toBe('')
    expect(() => QString.parse(1)).toThrow(/Expected string/)
  })

  it('supports membership and substring operators', () => {
    expect(QString.ops.get('in')!.body('a', ['a', 'b'])).toBe(true)
    expect(QString.ops.get('notIn')!.body('c', ['a', 'b'])).toBe(true)
    expect(QString.ops.get('startsWith')!.body('abc', 'ab')).toBe(true)
    expect(QString.ops.get('^=')!.body('abc', 'ab')).toBe(true)
    expect(QString.ops.get('endsWith')!.body('abc', 'bc')).toBe(true)
    expect(QString.ops.get('$=')!.body('abc', 'bc')).toBe(true)
    expect(QString.ops.get('contains')!.body('abc', 'b')).toBe(true)
    expect(QString.ops.get('*=')!.body('abc', 'b')).toBe(true)
  })

  it('supports regex matching', () => {
    expect(QString.ops.get('matches')!.body('abc123', /[0-9]+/)).toBe(true)
    expect(QString.ops.get('~=')!.body('abc123', /[0-9]+/)).toBe(true)
  })
})

describe('QRegExp', () => {
  it('accepts RegExp, strings and tuple inputs', () => {
    expect(QRegExp.parse(/x/)).toEqual(/x/)
    expect(QRegExp.parse('x')).toEqual(/x/)
    expect(QRegExp.parse(['x', 'i']).flags).toBe('i')
    expect(() => QRegExp.parse(1)).toThrow(/Expected RegExp/)
  })
})

describe('QStrings', () => {
  it('parses arrays of strings', () => {
    expect(QStrings.parse(null)).toEqual([])
    expect(() => QStrings.parse('x')).toThrow(/Expected string array/)
    expect(QStrings.ops.get('contains')!.body(['a', 'b'], 'a')).toBe(true)
  })
})

describe('QBoolean', () => {
  it('parses booleans and normalizes null to false', () => {
    expect(QBoolean.parse(null)).toBe(false)
    expect(QBoolean.parse(true)).toBe(true)
    expect(() => QBoolean.parse('true')).toThrow(/Expected boolean/)
  })
})

describe('QueryValueType', () => {
  it('throws when adding default aliases for unknown operators', () => {
    const t = new QueryValueType<number>('T', (x) => x as number)
    expect(() => t.addOp('zz', t, QBoolean, () => true).addDefaultAliases()).toThrow(/No default aliases/)
  })
})
