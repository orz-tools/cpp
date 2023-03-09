import { ChildContainer } from "./ChildContainer";
import { ContainerInstance } from "./ContainerInstance";
import { ContainerProxy } from "./ContainerProxy";
import { IContainer } from "./IContainer";
import { InjectContext } from "./InjectBrand";

export const magic = Symbol()

export class RootContainer extends ContainerProxy {
  static create() {
    const instance = new ContainerInstance();
    return new RootContainer(magic, instance);
  }

  constructor(
    _m: any,
    private instance: ContainerInstance,
  ) {
    super(instance);
    if (_m !== magic) throw new Error('This constructor is not for you.');
  }

  protected get context(): InjectContext {
    return {
      rootContainer: this,
      source: null
    }
  }

  protected childMap = new WeakMap<any, ChildContainer>();
  from(source: any): IContainer {
    if (source == null) return this;
    if (!canBeWeakMapKey(source)) throw new Error('Cannot create child container for non-object source');

    const existing = this.childMap.get(source);
    if (existing) return existing;

    const child = new ChildContainer(magic, this.instance, this, source);
    this.childMap.set(source, child);
    return child;
  }
}

function canBeWeakMapKey(t: any): boolean {
  return t && (typeof t === 'object' || typeof t === 'function')
}
