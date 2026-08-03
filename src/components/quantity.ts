import { gt } from '../pkg/gt'

/** 数量达到该值后改用单位缩写显示（普通材料最多 5 位数，不会触发）。 */
export const QUANTITY_COMPACT_THRESHOLD = 100000

const compactFormatterCache = new Map<string, Intl.NumberFormat>()

function getCompactFormatter(maximumFractionDigits: number): Intl.NumberFormat {
  const locale = gt.locale === 'en_US' ? 'en-US' : 'zh-Hans'
  const key = `${locale}:${maximumFractionDigits}`
  let formatter = compactFormatterCache.get(key)
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      notation: 'compact',
      maximumFractionDigits,
    })
    compactFormatterCache.set(key, formatter)
  }
  return formatter
}

/** 大数量使用单位缩写显示（如 196万 / 1.96M），小数量保持原样。 */
export function formatQuantity(value: number): string {
  if (!Number.isFinite(value)) return '0'
  if (Math.abs(value) < QUANTITY_COMPACT_THRESHOLD) return Math.trunc(value).toString()
  // 万级数字只保留整数位，亿级数字保留两位小数，尽量缩短显示宽度避免溢出
  const maximumFractionDigits = gt.locale === 'en_US' || Math.abs(value) >= 1e8 ? 2 : 0
  return getCompactFormatter(maximumFractionDigits).format(value)
}
