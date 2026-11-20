import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { gt } from '../pkg/gt'
import { formatExpectedQuantity, formatQuantity, formatTileQuantity, isWideTileQuantity } from './quantity'

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

describe('formatExpectedQuantity', () => {
  it('keeps two decimals and drops trailing zeros', () => {
    expect(formatExpectedQuantity(1.46)).toBe('1.46')
    expect(formatExpectedQuantity(0.3)).toBe('0.3')
    expect(formatExpectedQuantity(756)).toBe('756')
    expect(formatExpectedQuantity(100)).toBe('100')
    expect(formatExpectedQuantity(0.004)).toBe('0')
  })
})

describe('formatTileQuantity', () => {
  it('keeps decimals below 100', () => {
    gt.setLocale('zh_Hans')
    expect(formatTileQuantity(0.05)).toBe('0.05')
    expect(formatTileQuantity(22.8)).toBe('22.8')
    expect(formatTileQuantity(99.996)).toBe('100')
  })

  it('rounds from 100 and abbreviates from ten thousand', () => {
    gt.setLocale('zh_Hans')
    expect(formatTileQuantity(756)).toBe('756')
    expect(formatTileQuantity(1440.4)).toBe('1440')
    expect(formatTileQuantity(75600)).toBe('7.6万')
    gt.setLocale('en_US')
    expect(formatTileQuantity(75600)).toBe('76K')
  })
})

describe('isWideTileQuantity', () => {
  it('picks out four digits with a unit after them', () => {
    gt.setLocale('zh_Hans')
    expect(isWideTileQuantity(formatTileQuantity(12650000))).toBe(true)
    expect(isWideTileQuantity(formatQuantity(99990000))).toBe(true)
    expect(isWideTileQuantity(formatQuantity(1110000))).toBe(false)
    expect(isWideTileQuantity(formatQuantity(420000000))).toBe(false)
  })

  it('leaves plain numbers, decimals and English abbreviations alone', () => {
    gt.setLocale('zh_Hans')
    expect(isWideTileQuantity(formatTileQuantity(9999))).toBe(false)
    expect(isWideTileQuantity(formatTileQuantity(95.31))).toBe(false)
    gt.setLocale('en_US')
    expect(isWideTileQuantity(formatTileQuantity(12650000))).toBe(false)
    expect(isWideTileQuantity(formatTileQuantity(999400))).toBe(false)
  })
})
