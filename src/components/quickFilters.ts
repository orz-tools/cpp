import { Assertion, QueryParam } from '../pkg/cpp-basic'
import { holdingAssertion } from './characterQuery'
import type { IGameComponent, QuickFilterOp } from './types'

/** 查询展开了 quickFiltersByJoin 里的某一项时用那一组，否则用 quickFilters */
export function quickFiltersFor(
  component: Pick<IGameComponent, 'quickFilters' | 'quickFiltersByJoin'>,
  join: string | null | undefined,
): Record<string, QuickFilterOp> | undefined {
  const byJoin = component.quickFiltersByJoin
  if (join != null && byJoin && Object.hasOwn(byJoin, join)) return byJoin[join]
  return component.quickFilters
}

/**
 * 把快捷过滤的值并进查询的条件。不在 valids 里的值不生效，但留在 field 里：
 * 换到别的展开时按钮不在，条件也不能藏在看不到的地方；换回来又生效。
 */
export function wrapQueryWithQuickFilter(
  query: QueryParam,
  field?: Record<string, any>,
  valids?: Record<string, QuickFilterOp>,
) {
  if (!field) return query
  const keys = Object.keys(field)
  if (keys.length === 0) return query

  if (!valids) valids = {}
  const extra: Assertion[] = []
  const holding = holdingAssertion(field.holding)
  if (holding) extra.push(holding)
  for (const [k, v] of Object.entries(field)) {
    const op = Object.prototype.hasOwnProperty.call(valids, k) ? valids[k] : null
    if (op == null) continue
    if (typeof op === 'function') {
      const assertion = op(v)
      if (assertion) extra.push(assertion)
      continue
    }
    extra.push({ _: 'field', field: k, op: op, operand: v })
  }
  if (extra.length === 0) return query

  // 已保存的过滤器来自 immer 冻结的用户数据，不能就地改
  const base = !query.where ? [] : query.where._ === '&&' ? query.where.operand : [query.where]
  return { ...query, where: { _: '&&', operand: [...base, ...extra] } } satisfies QueryParam
}
