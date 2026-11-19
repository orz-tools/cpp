import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { gt } from '../pkg/gt'
import { formatQuantity } from './quantity'

beforeAll(() => {
  gt.addTranslations('zh_Hans', 'messages', { translations: {} } as any)
  gt.addTranslations('en_US', 'messages', { translations: {} } as any)
})

afterEach(() => {
  gt.setLocale('zh_Hans')
})

describe('formatQuantity', () => {
  it('keeps quantities below ten thousand exact', () => {
    gt.setLocale('zh_Hans')
    expect(formatQuantity(0)).toBe('0')
    expect(formatQuantity(9999)).toBe('9999')
    expect(formatQuantity(-9999)).toBe('-9999')
  })

  it('abbreviates from ten thousand with Chinese units', () => {
    gt.setLocale('zh_Hans')
    expect(formatQuantity(10000)).toBe('1万')
    expect(formatQuantity(93000)).toBe('9.3万')
    expect(formatQuantity(238300)).toBe('24万')
    expect(formatQuantity(40288589)).toBe('4029万')
    expect(formatQuantity(-40288589)).toBe('-4029万')
    expect(formatQuantity(123456789)).toBe('1.2亿')
  })

  it('abbreviates from ten thousand with English units, short enough for a 40px tile', () => {
    gt.setLocale('en_US')
    expect(formatQuantity(9999)).toBe('9999')
    expect(formatQuantity(238300)).toBe('238K')
    expect(formatQuantity(1964400)).toBe('2M')
    expect(formatQuantity(123456789)).toBe('123M')
  })

  it('writes every digit when not compact', () => {
    gt.setLocale('zh_Hans')
    expect(formatQuantity(9999, false)).toBe('9999')
    expect(formatQuantity(40288589, false)).toBe('40288589')
    expect(formatQuantity(-40288589, false)).toBe('-40288589')
    gt.setLocale('en_US')
    expect(formatQuantity(123456789, false)).toBe('123456789')
  })
})
