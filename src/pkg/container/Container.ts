import { IContainer } from './private/IContainer'
import { createInjectBrandObject, InjectContext } from './private/InjectBrand'
import { RootContainer } from './private/RootContainer'

type ContainerConstructor = {
  (): IContainer
  new (): IContainer
}

const containerFactory = (ctx: InjectContext) => {
  return (ctx.rootContainer as RootContainer).from(ctx.source)
}

export const Container: ContainerConstructor = function Container(this: any) {
  if (this && this instanceof Container) {
    const result = RootContainer.create()
    result.set(Container as ContainerConstructor, result)
    return result as IContainer
  }

  return createInjectBrandObject({
    factory: containerFactory,
  })
} as any

export type Container = IContainer
