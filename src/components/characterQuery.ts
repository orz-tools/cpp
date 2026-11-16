import type { Cpp } from '../Cpp'
import { SavedQueryPrefix } from '../Cpp'
import {
  Assertion,
  ExtraCharacterQuery,
  ICharacter,
  IGame,
  QBoolean,
  QNumber,
  QString,
  Querier,
  QueryParam,
} from '../pkg/cpp-basic'
import { gt, lpstr } from '../pkg/gt'

export { SavedQueryPrefix }

export const PredefinedQueryPrefix = '#!'
export const ListModeFav = PredefinedQueryPrefix + 'fav'
export const ListModeAll = PredefinedQueryPrefix + 'all'
export const ListModeWithGoal = PredefinedQueryPrefix + 'withGoal'
export const validPredefinedQueries = [ListModeFav, ListModeAll, ListModeWithGoal]

export const PredefinedGameQueryPrefix = '#?'

/** 快捷过滤「可练」「缺席」记在 quick.holding 里，可以同时选上 */
export const HoldingTrainable = 'trainable'
export const HoldingAbsent = 'absent'

const holdingAssertions: Record<string, Assertion> = {
  [HoldingTrainable]: {
    _: '&&',
    operand: [
      { _: 'field', field: 'own', op: '==', operand: true },
      { _: 'field', field: 'finished', op: '==', operand: false },
    ],
  },
  [HoldingAbsent]: { _: 'field', field: 'own', op: '==', operand: false },
}

/** 组内取并集：两个都选等于除了已练完以外的全部；都不选（或值无法识别）时不加条件 */
export function holdingAssertion(values: unknown): Assertion | undefined {
  const operand = (Array.isArray(values) ? values : []).flatMap((x) =>
    Object.prototype.hasOwnProperty.call(holdingAssertions, x) ? [holdingAssertions[x]] : [],
  )
  if (operand.length === 0) return undefined
  return operand.length === 1 ? operand[0] : { _: '||', operand }
}

/** query 不是任何引用，而是正在编辑的 JSON */
export function isCustomQuery(query: string) {
  return (
    !validPredefinedQueries.includes(query) &&
    !query.startsWith(PredefinedGameQueryPrefix) &&
    !query.startsWith(SavedQueryPrefix)
  )
}

export class CppCharacterListQuery extends ExtraCharacterQuery<IGame, ICharacter> {
  public constructor(private readonly cpp: Cpp<any>) {
    super()

    const uda = cpp.gameAdapter.getUserDataAdapter()
    const store = cpp.store
    const atoms = cpp.atoms.atoms
    const realOrder = store.get(atoms.goalOrder)

    this.addField(
      'id',
      lpstr(() => gt.pgettext('query field', '内部代号')),
      QString,
      ({ character }) => character.key,
    ).addAlias('key')

    this.addStatusField(
      'own',
      lpstr(() => gt.pgettext('query field', '持有')),
      QBoolean,
      ({ character, status }) => !uda.isAbsentCharacter(character, status),
    )

    this.addField(
      'goalOrder',
      lpstr(() => gt.pgettext('query field', '计划顺序')),
      QNumber,
      ({ character }) => {
        const o = realOrder.indexOf(character.key)
        if (o < 0) return Number.MAX_SAFE_INTEGER
        return o
      },
    )

    this.addField(
      'finished',
      lpstr(() => gt.pgettext('query field', '已全面养成')),
      QBoolean,
      ({ character }) => {
        return store.get(atoms.isCharacterFinished(character.key))
      },
    )
  }
}

export function stringifyQuery(query: QueryParam): string {
  return JSON.stringify(query, null)
}

export function defaultFavQuery(cpp: Cpp<any>): QueryParam {
  const fav = cpp.gameAdapter.getFavCharacterQueryWhere()
  return {
    where: {
      _: '||',
      operand: [
        { _: 'field', field: 'goal', op: '==', operand: true },
        {
          _: '&&',
          operand: [...(fav ? [fav] : []), { _: 'field', field: 'finished', op: '==', operand: false }],
        },
      ],
    },
    order: cpp.gameAdapter.getDefaultCharacterQueryOrder(),
  }
}

function withDefaultOrder(query: QueryParam, cpp: Cpp<any>): QueryParam {
  if (query.order) return query
  return { ...query, order: cpp.gameAdapter.getDefaultCharacterQueryOrder() }
}

export function getSavedQuery(cpp: Cpp<any>, ref: string) {
  if (!ref.startsWith(SavedQueryPrefix)) return undefined
  const id = ref.slice(SavedQueryPrefix.length)
  return cpp.store.get(cpp.atoms.atoms.dataAtom).savedQueries.find((x) => x.id === id)
}

export function compileQuery(query: string, cpp: Cpp<any>): QueryParam {
  const defaultQueryOrder = cpp.gameAdapter.getDefaultCharacterQueryOrder()
  if (query.startsWith(PredefinedQueryPrefix)) {
    if (query === ListModeFav) {
      const favQuery = cpp.store.get(cpp.atoms.atoms.dataAtom).favQuery
      return favQuery ? withDefaultOrder(favQuery, cpp) : defaultFavQuery(cpp)
    } else if (query === ListModeAll) {
      return {
        order: defaultQueryOrder,
      }
    } else if (query === ListModeWithGoal) {
      return {
        where: {
          _: '&&',
          operand: [{ _: 'field', field: 'goal', op: '==', operand: true }],
        },
        order: [['goalOrder', 'ASC']],
      }
    }
    throw new Error('Invalid predefined query')
  }

  if (query.startsWith(PredefinedGameQueryPrefix)) {
    const pgq = cpp.gameAdapter.getPredefinedQueries()
    const k = query.slice(PredefinedGameQueryPrefix.length)
    if (pgq[k]) return pgq[k].query
    throw new Error('Invalid predefined game query')
  }

  if (query.startsWith(SavedQueryPrefix)) {
    const saved = getSavedQuery(cpp, query)
    if (saved) return withDefaultOrder(saved.query, cpp)
    throw new Error('Saved query not found')
  }

  const r = JSON.parse(query)
  if (!r.order) r.order = defaultQueryOrder
  return r
}

export function createListQuerier<G extends IGame>(cpp: Cpp<G>, param: QueryParam) {
  const querier = new Querier<G, ICharacter>(cpp.gameAdapter.getRootCharacterQuery(), param)
  querier.addQuery(new CppCharacterListQuery(cpp))
  return querier
}
