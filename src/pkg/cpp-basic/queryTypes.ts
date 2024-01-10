export interface QueryValueBinaryOp<T, A, R> {
  type: QueryValueType<A>
  result: QueryValueType<R>
  name: string
  body: (self: T, arg: A) => R
  aliases: string[]
}

const generalizeAliases: Record<string, string[]> = {
  eq: ['=', '==', '==='],
  ne: ['!=', '!==', '<>', 'neq'],
  lt: ['<'],
  le: ['<=', 'lte'],
  gt: ['>'],
  ge: ['>=', 'gte'],
}

export class QueryValueType<T> {
  public readonly ops: Map<string, QueryValueBinaryOp<T, any, any>> = new Map()
  public constructor(
    public readonly name: string,
    public readonly parse: (input: any) => T,
    public readonly compare: (a: T, b: T) => -1 | 0 | 1 = (a, b) => {
      if (a < b) return -1
      if (a > b) return 1
      return 0
    },
  ) {}

  public addOp<A, R>(
    name: string,
    argType: QueryValueType<A>,
    resultType: QueryValueType<R>,
    body: QueryValueBinaryOp<T, A, R>['body'],
  ) {
    const aliases: string[] = []
    const op: QueryValueBinaryOp<T, A, R> = { type: argType, result: resultType, name, body, aliases }
    this.ops.set(name, op)
    const r = {
      addAlias: (alias: string) => {
        this.ops.set(alias, op)
        aliases.push(alias)
        return r
      },

      addDefaultAliases: () => {
        const defaultAliases = generalizeAliases[name]
        if (defaultAliases == null) throw new Error('No default aliases for ' + name)
        for (const alias of defaultAliases) {
          this.ops.set(alias, op)
          aliases.push(alias)
        }
        return r
      },
    }
    return r
  }

  public addBasicValueOps() {
    this.addOp('eq', this, QBoolean, (self, arg) => self === arg).addDefaultAliases()
    this.addOp('ne', this, QBoolean, (self, arg) => self !== arg).addDefaultAliases()
    this.addOp('lt', this, QBoolean, (self, arg) => self < arg).addDefaultAliases()
    this.addOp('le', this, QBoolean, (self, arg) => self <= arg).addDefaultAliases()
    this.addOp('gt', this, QBoolean, (self, arg) => self > arg).addDefaultAliases()
    this.addOp('ge', this, QBoolean, (self, arg) => self >= arg).addDefaultAliases()
    return this
  }
}

export const QBoolean = new QueryValueType<boolean>('QBoolean', (input) => {
  if (input == null) return false
  if (typeof input !== 'boolean') throw new Error('Expected boolean')
  return input
})

export const QNumber = new QueryValueType<number>(
  'QNumber',
  (input) => {
    if (input == null) return NaN
    if (typeof input !== 'number') throw new Error('Expected number')
    return input
  },
  (a, b) => {
    if (isNaN(a) && isNaN(b)) return 0
    if (isNaN(a)) return -1 // NaN < any number
    if (isNaN(b)) return 1 // any number > NaN
    if (a < b) return -1
    if (a > b) return 1
    return 0
  },
).addBasicValueOps()

export const QString = new QueryValueType<string>('QString', (input) => {
  if (input == null) return ''
  if (typeof input !== 'string') throw new Error('Expected string')
  return input
}).addBasicValueOps()

export const QStrings = new QueryValueType<string[]>('QStrings', (input) => {
  if (input == null) return []
  if (!Array.isArray(input)) throw new Error('Expected string array')
  return input.map(QString.parse)
}).addBasicValueOps()

QBoolean.addBasicValueOps()

export const QRegExp = new QueryValueType<RegExp>('QRegExp', (input) => {
  if (input == null) throw new Error('Expected RegExp')
  if (input instanceof RegExp) return input
  if (Array.isArray(input) && input.length === 2 && typeof input[0] === 'string' && typeof input[1] === 'string') {
    return new RegExp(input[0], input[1])
  }
  if (typeof input === 'string') return new RegExp(input)
  throw new Error('Expected RegExp or string or [string, string]')
}).addBasicValueOps()

QString.addOp('in', QStrings, QBoolean, (self, arg) => arg.includes(self))
QString.addOp('notIn', QStrings, QBoolean, (self, arg) => !arg.includes(self))
QString.addOp('startsWith', QString, QBoolean, (self, arg) => self.startsWith(arg)).addAlias('^=')
QString.addOp('endsWith', QString, QBoolean, (self, arg) => self.endsWith(arg)).addAlias('$=')
QString.addOp('contains', QString, QBoolean, (self, arg) => self.includes(arg)).addAlias('*=')
QString.addOp('matches', QRegExp, QBoolean, (self, arg) => !!self.match(arg)).addAlias('~=')
