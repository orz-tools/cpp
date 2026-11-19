import { gt } from '../pkg/gt'

// 物品列表、档案的养成成本页和关卡面板共用这条规则，同一个数在各处读起来一样。
// 一万起按界面语言缩写，用 Intl 的默认取舍（「9.3万」「4029万」「238K」「2M」）：最窄的是养成成本页 40px 的格子，
// 固定留小数时英文的「238.3K」「1.96M」会挤出格子。准确的数由调用处放进 title。
const COMPACT_FROM = 10000

const formatters = new Map<string, Intl.NumberFormat>()

export function formatQuantity(value: number): string {
  if (!Number.isFinite(value)) return '0'
  if (Math.abs(value) < COMPACT_FROM) return `${Math.trunc(value)}`
  // 用 gt.locale 而不是 locales.tsx 的 getLocale()：两者随界面语言一起切换，后者会把 React 组件带进来
  const locale = (gt.locale || 'zh_Hans').replace('_', '-')
  let formatter = formatters.get(locale)
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, { notation: 'compact' })
    formatters.set(locale, formatter)
  }
  return formatter.format(value)
}
