import { PSTR, gt, lpstr } from '../gt'
import { QBoolean, QueryValueType } from './queryTypes'
import { ICharacter, IGame } from './types'

export interface QueryInput<G extends IGame, C extends ICharacter> {
  character: C
  current: G['characterStatus']
  goal: G['characterStatus'] | undefined
}

export interface FieldContext<G extends IGame, C extends ICharacter, Args extends readonly any[]> {
  key: string
  character: C
  current: G['characterStatus']
  goal: G['characterStatus'] | undefined
  args: Args
}

export interface StatusFieldContext<G extends IGame, C extends ICharacter, Args extends readonly any[]> {
  character: C
  status: G['characterStatus']
  args: Args
}

export interface FieldOption {
  value: any
  label: PSTR
}

export type FieldFormat = 'percent'

export interface FieldConfiguration<G extends IGame, C extends ICharacter, Args extends readonly any[], T> {
  id: string
  name: PSTR
  type: QueryValueType<T>
  getter: (context: FieldContext<G, C, Args>) => T
  aliases: string[]
  options?: () => FieldOption[]
  format?: FieldFormat
}

export interface FieldBuilder {
  addAlias(alias: string): FieldBuilder
  withOptions(options: () => FieldOption[]): FieldBuilder
  withFormat(format: FieldFormat): FieldBuilder
}

export interface StatusFieldBuilder {
  withOptions(options: () => FieldOption[]): StatusFieldBuilder
  withFormat(format: FieldFormat): StatusFieldBuilder
}

export abstract class FieldHolder<G extends IGame, C extends ICharacter, Args extends readonly any[]> {
  public readonly fields = new Map<string, FieldConfiguration<G, C, Args, any>>()

  public addField<T>(
    id: string,
    name: PSTR,
    type: QueryValueType<T>,
    getter: (context: FieldContext<G, C, Args>) => T,
  ): FieldBuilder {
    const field: FieldConfiguration<G, C, Args, T> = {
      id,
      name,
      type,
      getter,
      aliases: [],
    }
    this.fields.set(id, field)

    const result: FieldBuilder = {
      addAlias: (alias: string) => {
        this.fields.set(alias, field)
        field.aliases.push(alias)
        return result
      },
      withOptions: (options) => {
        field.options = options
        return result
      },
      withFormat: (format) => {
        field.format = format
        return result
      },
    }

    return result
  }

  public addStatusField<T>(
    id: string,
    name: PSTR,
    type: QueryValueType<T>,
    getter: (context: StatusFieldContext<G, C, Args>) => T,
  ): StatusFieldBuilder {
    const current = this.addField('current.' + id, name, type, ({ character, current, args }) => {
      return getter({ character, status: current, args })
    }).addAlias(id)

    const goal = this.addField('goal.' + id, name, type, ({ character, goal, args }) => {
      if (goal === undefined) return type.parse(undefined)
      return getter({ character, status: goal, args })
    })

    const result: StatusFieldBuilder = {
      withOptions: (options) => {
        current.withOptions(options)
        goal.withOptions(options)
        return result
      },
      withFormat: (format) => {
        current.withFormat(format)
        goal.withFormat(format)
        return result
      },
    }
    return result
  }

  public tap(callback: (self: this) => void) {
    callback(this)
    return this
  }
}

export class RootCharacterQuery<G extends IGame, C extends ICharacter> extends FieldHolder<G, C, []> {
  public constructor() {
    super()

    this.addField(
      'goal',
      lpstr(() => gt.pgettext('query field', '有计划')),
      QBoolean,
      ({ goal }) => {
        return !!goal
      },
    )
  }

  public readonly subQueries = new Map<
    string,
    {
      id: string
      name: PSTR
      query: SubCharacterQuery<G, C, any>
    }
  >()

  public addSubQuery<Args extends readonly any[]>(id: string, name: PSTR, query: SubCharacterQuery<G, C, Args>) {
    this.subQueries.set(id, {
      id,
      name,
      query,
    })
  }

  public createSubQuery<Args extends readonly any[]>(
    id: string,
    name: PSTR,
    execute: (character: C) => Array<Readonly<Args>>,
    getKey: (...args: Args) => string,
  ) {
    const scq = new SubCharacterQuery<G, C, Args>(execute, getKey)
    this.subQueries.set(id, {
      id,
      name,
      query: scq,
    })
    return scq
  }
}

export class SubCharacterQuery<G extends IGame, C extends ICharacter, Args extends readonly any[]> extends FieldHolder<
  G,
  C,
  Args
> {
  public constructor(
    public readonly execute: (character: C) => Array<Readonly<Args>>,
    public readonly getKey: (...args: Args) => string,
  ) {
    super()
  }
}

export class ExtraCharacterQuery<G extends IGame, C extends ICharacter> extends FieldHolder<G, C, []> {}

export type Assertion = FieldAssertion | AndAssertion | OrAssertion | NotAssertion
export type FieldAssertion = { _: 'field'; field: string; op: string; operand: any }
export type AndAssertion = { _: '&&'; operand: Assertion[] }
export type OrAssertion = { _: '||'; operand: Assertion[] }
export type NotAssertion = { _: '!'; operand: Assertion }

export interface QueryParam {
  select?: string[] | undefined | null
  join?: string | undefined | null
  where?: Assertion | undefined | null
  order?: [string, 'ASC' | 'DESC'][] | undefined | null
  group?: string[] | undefined | null
  /** 附加列（select 与 join 的列）改过的宽度，以 px 计；查询本身不用它 */
  widths?: Record<string, number> | undefined | null
}

export class Querier<G extends IGame, C extends ICharacter> {
  private executed = false
  public readonly fields = new Map<string, FieldConfiguration<G, C, any, any>>()
  public readonly result: FieldContext<G, C, any>[] = []

  public readonly subQueryId?: string
  public readonly subQuery?: SubCharacterQuery<G, C, any>
  public constructor(
    public readonly rootQuery: RootCharacterQuery<G, C>,
    public readonly param: QueryParam,
  ) {
    for (const [id, field] of rootQuery.fields) {
      this.fields.set(id, field)
    }

    if (param.join != null) {
      const subQuery = rootQuery.subQueries.get(param.join)
      if (subQuery === undefined) throw new Error(`Sub query ${param.join} not found`)
      this.subQuery = subQuery.query
      this.subQueryId = param.join
    }

    if (this.subQuery !== undefined) {
      for (const [id, field] of this.subQuery.fields) {
        this.fields.set(`${this.subQueryId}.${id}`, field)
      }
    }
  }

  public addQuery(query: ExtraCharacterQuery<IGame, ICharacter>) {
    for (const [id, field] of query.fields) {
      this.fields.set(id, field)
    }
  }

  /** 编译 where/order 并检查 select 与 widths，只报错不执行 */
  public validate(): void {
    this.compileAssertion(this.param.where)
    if (this.param.order != null) this.compileComparatorList(this.param.order)
    if (this.param.select != null) {
      for (const id of this.param.select) this.getField(id)
    }
    const widths = this.param.widths
    if (widths != null) {
      if (typeof widths !== 'object' || Array.isArray(widths)) throw new Error('Expected widths to be an object')
      for (const [id, width] of Object.entries(widths)) {
        if (typeof width !== 'number' || !Number.isFinite(width)) throw new Error(`Invalid width for column ${id}`)
      }
    }
  }

  public execute(input: Generator<QueryInput<G, C>>) {
    if (this.executed) throw new Error('Already executed')
    this.executed = true

    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this
    const generator: Generator<FieldContext<G, C, any>> = this.subQuery
      ? (function* () {
          for (const ctx of input) {
            for (const args of self.subQuery!.execute(ctx.character)) {
              yield { ...ctx, key: `${ctx.character.key}:${self.subQueryId}:${self.subQuery!.getKey(args)}`, args }
            }
          }
        })()
      : (function* () {
          for (const ctx of input) {
            yield { ...ctx, key: ctx.character.key, args: [] }
          }
        })()

    const filter = this.compileAssertion(this.param.where)
    for (const ctx of generator) {
      if (!filter(ctx)) continue
      this.result.push(ctx)
    }

    if (this.param.order != null) {
      this.result.sort(this.compileComparatorList(this.param.order))
    }
  }

  private getField(id: string): FieldConfiguration<G, C, any, any> {
    const field = this.fields.get(id)
    if (field === undefined) throw new Error(`Field ${id} not found`)
    return field
  }

  public getFieldValue(id: string, item: FieldContext<G, C, any>): any {
    const field = this.getField(id)
    return field.getter(item)
  }

  private compileFieldGetter(field: string): (item: FieldContext<G, C, any>) => any {
    return this.getField(field).getter
  }

  private compileFieldAssertion(a: FieldAssertion): (item: FieldContext<G, C, any>) => boolean {
    const field = this.getField(a.field)

    const getter = this.compileFieldGetter(a.field)

    const op = field.type.ops.get(a.op)
    if (op === undefined) throw new Error(`Unknown operator ${a.op} for field ${a.field} (${field.type.name})`)

    let operand: any
    try {
      operand = op.type.parse(a.operand)
    } catch (e) {
      throw new Error(`Invalid operand for ${a.field} ${a.op}: ${(e as Error).message}`)
    }
    return (item) => op.result.parse(op.body(field.type.parse(getter(item)), operand))
  }

  private compileAndAssertion(a: AndAssertion): (item: FieldContext<G, C, any>) => boolean {
    const operands = a.operand.map((op) => this.compileAssertion(op))
    return (item) => operands.every((op) => op(item))
  }

  private compileOrAssertion(a: OrAssertion): (item: FieldContext<G, C, any>) => boolean {
    const operands = a.operand.map((op) => this.compileAssertion(op))
    return (item) => operands.some((op) => op(item))
  }

  private compileNotAssertion(a: NotAssertion): (item: FieldContext<G, C, any>) => boolean {
    const operand = this.compileAssertion(a.operand)
    return (item) => !operand(item)
  }

  private compileAssertion(a: Assertion | null | undefined): (item: FieldContext<G, C, any>) => boolean {
    if (a === undefined || a === null) {
      return () => true
    }
    switch (a._) {
      case 'field':
        return this.compileFieldAssertion(a)
      case '&&':
        return this.compileAndAssertion(a)
      case '||':
        return this.compileOrAssertion(a)
      case '!':
        return this.compileNotAssertion(a)
      default:
        throw new Error(`Unknown assertion ${JSON.stringify((a as any)?._)}`)
    }
  }

  private compileComparator(
    comparator: [string, 'ASC' | 'DESC'],
  ): (a: FieldContext<G, C, any>, b: FieldContext<G, C, any>) => number {
    const field = this.getField(comparator[0])
    const type = field.type
    const getter = this.compileFieldGetter(comparator[0])

    const order = comparator[1]
    if (order !== 'ASC' && order !== 'DESC') throw new Error(`Unknown order ${order} for field ${comparator[0]}`)

    return (a, b) => {
      const va = getter(a)
      const vb = getter(b)
      if (va === vb) return 0
      if (order === 'ASC') return type.compare(va, vb)
      else return -type.compare(va, vb)
    }
  }

  private compileComparatorList(
    comparators: [string, 'ASC' | 'DESC'][],
  ): (a: FieldContext<G, C, any>, b: FieldContext<G, C, any>) => number {
    const compiledComparators = comparators.map((c) => this.compileComparator(c))
    return (a, b) => {
      for (const comparator of compiledComparators) {
        const result = comparator(a, b)
        if (result !== 0) return result
      }
      return 0
    }
  }
}

export type QueryFieldGroup = 'character' | 'current' | 'goal' | 'sub'

export interface QueryFieldEntry {
  id: string
  config: FieldConfiguration<any, any, any, any>
  group: QueryFieldGroup
  subName?: PSTR
}

export function listQueryFields(querier: Querier<any, any>): QueryFieldEntry[] {
  const subConfigs = new Set(querier.subQuery ? querier.subQuery.fields.values() : [])
  const subName = querier.subQueryId ? querier.rootQuery.subQueries.get(querier.subQueryId)?.name : undefined
  const seen = new Set<FieldConfiguration<any, any, any, any>>()
  const entries: QueryFieldEntry[] = []
  for (const config of querier.fields.values()) {
    if (seen.has(config)) continue
    seen.add(config)
    if (subConfigs.has(config)) {
      entries.push({ id: `${querier.subQueryId}.${config.id}`, config, group: 'sub', subName })
      continue
    }
    const group = config.id.startsWith('current.') ? 'current' : config.id.startsWith('goal.') ? 'goal' : 'character'
    entries.push({ id: config.id, config, group })
  }
  const order: QueryFieldGroup[] = ['character', 'current', 'goal', 'sub']
  return order.flatMap((g) => entries.filter((x) => x.group === g))
}

export function resolveField(entries: QueryFieldEntry[], querier: Querier<any, any>, idOrAlias: string) {
  const config = querier.fields.get(idOrAlias)
  if (config === undefined) return undefined
  return entries.find((x) => x.config === config)
}
