import { Constructor } from '../types'
import { IContainer } from './IContainer'

const InjectBrand = Symbol.for('@orz/container/injectBrand')
export type InjectMeta =
  | { class: Constructor<any>; getter?: (target: any) => any }
  | { factory: (ctx: InjectContext) => any }
  | { error: string }

export type InjectContext = {
  source: any
  rootContainer: IContainer
}

export function createInjectBrandObject(meta: InjectMeta) {
  return Object.assign(Object.create(null), {
    [InjectBrand]: meta,
  }) as any
}

export function getMetaInInjectBrandObject(value: any) {
  if (!value) return
  if (typeof value !== 'object') return
  if (!(InjectBrand in value)) return
  if (!value[InjectBrand]) return

  const meta: InjectMeta = value[InjectBrand]
  return meta
}
