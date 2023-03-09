import { Constructor } from "../types";
import { ContainerInstance } from "./ContainerInstance";
import { IContainer } from "./IContainer";
import { InjectContext } from "./InjectBrand";

const InstanceBrand = Symbol.for("@orz/container/instanceBrand");

export abstract class ContainerProxy implements IContainer {
  constructor(
    instance: ContainerInstance
  ) {
    this[InstanceBrand] = instance;
  }

  private [InstanceBrand]: ContainerInstance

  protected abstract get context(): InjectContext

  get<T extends object>(constructor: Constructor<T>): T {
    return this[InstanceBrand].get(constructor, this.context)
  }

  set<T extends object>(constructor: Constructor<T>, value: T): this {
    this[InstanceBrand].set(constructor, value);
    return this;
  }

  create<T extends object>(constructor: Constructor<T>): T {
    return this[InstanceBrand].create(constructor, this.context);
  }

  init(instance: object): void {
    return this[InstanceBrand].init(instance, this.context);
  }

}
