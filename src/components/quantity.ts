import { gt } from '../pkg/gt'

// 物品列表、档案的养成成本页和关卡面板共用这条规则，同一个数在各处读起来一样。
// 一万起按界面语言缩写，用 Intl 的默认取舍（「9.3万」「4029万」「238K」「2M」）：最窄的是养成成本页 40px 的格子，
// 固定留小数时英文的「238.3K」「1.96M」会挤出格子。准确的数由调用处放进 title。
const COMPACT_FROM = 10000

const formatters = new Map<string, Intl.NumberFormat>()

/** `compact` 默认缩写，是给叠在图标上的数用的，那里放不下全数；其余地方传「选项」里的「缩写大数」（`compactQuantitiesAtom`） */
export function formatQuantity(value: number, compact = true): string {
  if (!Number.isFinite(value)) return '0'
  if (!compact || Math.abs(value) < COMPACT_FROM) return `${Math.trunc(value)}`
  // 用 gt.locale 而不是 locales.tsx 的 getLocale()：两者随界面语言一起切换，后者会把 React 组件带进来
  const locale = (gt.locale || 'zh_Hans').replace('_', '-')
  let formatter = formatters.get(locale)
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, { notation: 'compact' })
    formatters.set(locale, formatter)
  }
  return formatter.format(value)
}

/** 关卡的期望掉落：两位小数，去掉末尾的零 */
export function formatExpectedQuantity(value: number): string {
  return value.toFixed(2).replace(/\.?0+$/, '')
}

/**
 * 叠在 40px 物品格上的期望掉落：100 以下同 formatExpectedQuantity；100 起取整，一万起缩写。
 * 和养成成本页一样不看「缩写大数」：格子上放不下全数
 */
export function formatTileQuantity(value: number): string {
  return value < 100 ? formatExpectedQuantity(value) : formatQuantity(Math.round(value))
}

/**
 * 格子上的数里只有四位数带单位的（「1265万」，毕业规划的龙门币、经验）粗体 11px 宽过 40px 的格子，要小一号。
 * 英文的缩写到 999K 就换成 1M，带单位的最多三位数
 */
export function isWideTileQuantity(label: string): boolean {
  return /\d{4}\D/.test(label)
}
