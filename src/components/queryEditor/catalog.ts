import type { Cpp } from '../../Cpp'
import { FieldAssertion, Querier, QueryFieldEntry, listQueryFields, resolveField } from '../../pkg/cpp-basic'
import { canonicalOpName, fieldLabel } from '../../pkg/cpp-basic/queryEditorModel'
import { gt } from '../../pkg/gt'
import { createListQuerier } from '../characterQuery'

export interface FieldCatalog {
  join: string | undefined
  querier: Querier<any, any>
  entries: QueryFieldEntry[]
  resolve(idOrAlias: string): QueryFieldEntry | undefined
  /** 字段在当前“每行”下不可用、或不存在时的说明 */
  explainMissing(idOrAlias: string): string
}

export function createFieldCatalog(cpp: Cpp<any>, join: string | undefined): FieldCatalog {
  const querier = createListQuerier(cpp, { join })
  const entries = listQueryFields(querier)
  const rootQuery = cpp.gameAdapter.getRootCharacterQuery()
  return {
    join,
    querier,
    entries,
    resolve: (id) => resolveField(entries, querier, id),
    explainMissing: (id) => {
      for (const [subId, sub] of rootQuery.subQueries) {
        if (subId === join || !id.startsWith(subId + '.')) continue
        const other = createListQuerier(cpp, { join: subId })
        const entry = resolveField(listQueryFields(other), other, id)
        if (!entry) continue
        return gt
          .pgettext('query editor', '「%1」只在「每行：%2」时可用。改回%2，或删掉这一条。')
          .replace('%1', fieldLabel(entry))
          .replaceAll('%2', String(sub.name))
      }
      return gt.pgettext('query editor', '没有「%1」这个字段。换一个字段，或删掉这一条。').replace('%1', id)
    },
  }
}

/** 与 Querier.validate 相同的检查，只针对一行，返回给用户看的说明 */
export function explainConditionError(catalog: FieldCatalog, a: FieldAssertion): string | undefined {
  const entry = catalog.resolve(a.field)
  if (!entry) return catalog.explainMissing(a.field)
  const type = entry.config.type
  const op = type.ops.get(a.op)
  if (!op) {
    return gt
      .pgettext('query editor', '「%1」不支持运算符「%2」。换一个运算符。')
      .replace('%1', fieldLabel(entry))
      .replace('%2', a.op)
  }
  try {
    op.type.parse(a.operand)
  } catch {
    if (canonicalOpName(type, a.op) === 'matches') {
      return gt.pgettext('query editor', '正则表达式写错了。检查括号与转义。')
    }
    return gt
      .pgettext('query editor', '这一条的值不是「%1」能比较的类型。重新填写值。')
      .replace('%1', fieldLabel(entry))
  }
  return undefined
}
