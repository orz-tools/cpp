import { Constructor } from '../types'

export interface IContainer {
  get<T extends object>(constructor: Constructor<T>): T
  set<T extends object>(constructor: Constructor<T>, value: T): this
  create<T extends object>(constructor: Constructor<T>): T
  init(instance: object): void
}
