import { beforeAll, describe, expect, it } from 'vitest'
import { gt } from '../pkg/gt'
import { formatQuantity } from './quantity'

beforeAll(() => {
  gt.addTranslations('zh_Hans', 'messages', { translations: {} } as any)
  gt.addTranslations('en_US', 'messages', { translations: {} } as any)
  gt.setLocale('zh_Hans')
})

describe('formatQuantity', () => {
  it('keeps small quantities as exact integers', () => {
    expect(formatQuantity(0)).toBe('0')
    expect(formatQuantity(99999)).toBe('99999')
    expect(formatQuantity(-12345)).toBe('-12345')
  })

  it('compacts large quantities with Chinese units', () => {
    expect(formatQuantity(100000)).toBe('10万')
    expect(formatQuantity(1964400)).toBe('196万')
    expect(formatQuantity(40288589)).toBe('4029万')
    expect(formatQuantity(-40288589)).toBe('-4029万')
    expect(formatQuantity(123456789)).toBe('1.23亿')
  })

  it('compacts large quantities with English units', () => {
    gt.setLocale('en_US')
    expect(formatQuantity(1964400)).toBe('1.96M')
    expect(formatQuantity(123456789)).toBe('123.46M')
  })
})
