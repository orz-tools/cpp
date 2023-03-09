import { Constructor } from "../types";
import { getMetaInInjectBrandObject, InjectContext, InjectMeta } from "./InjectBrand";

export class ContainerInstance {
  private _storage = new Map<Constructor<any>, any>();

  get<T extends object>(constructor: Constructor<T>, ctx: InjectContext): T {
    if (this._storage.has(constructor)) {
      return this._storage.get(constructor);
    }

    return this._createImpl(constructor, true, ctx);
  }

  set<T extends object>(constructor: Constructor<T>, value: T): this {
    this._storage.set(constructor, value);
    return this;
  }

  create<T extends object>(constructor: Constructor<T>, ctx: InjectContext): T {
    return this._createImpl(constructor, false, ctx);
  }

  private _creating = new Set<Constructor<any>>();
  private _createImpl<T extends object>(constructor: Constructor<T>, persistent: boolean, ctx: InjectContext): T {
    // console.log(`creating ${constructor.name} ${persistent}`, ctx.source?.constructor?.name)
    const object = new constructor();
    if (persistent) {
      if (this._creating.has(constructor)) {
        throw new Error(`Circular dependency detected for ${constructor.name}`)
      }
      this._creating.add(constructor);
    }

    try {
      this._initImpl(object, ctx);

      if (persistent) {
        this._storage.set(constructor, object);
        return object;
      }
      return object;
    } finally {
      if (persistent) {
        console.assert(this._creating.has(constructor));
        this._creating.delete(constructor);
      }
    }
  }

  private _resolveInject(meta: InjectMeta, ctx: InjectContext): any {
    if ('class' in meta) {
      let value = this.get(meta.class, ctx);
      if (meta.getter) value = meta.getter(value);
      return value;
    } else if ('factory' in meta) {
      return meta.factory.call(undefined, ctx)
    } else if ('error' in meta) {
      throw new Error(meta.error);
    }
    throw new Error(`Invalid inject meta with keys: ${Object.keys(meta).join(", ")}`);
  }

  init(instance: object, ctx: InjectContext) {
    this._initImpl(instance, ctx);
  }

  private _initImpl<T extends object>(object: T, ctx: InjectContext) {
    const keys = getObjectAllSimplePropertyKeys(object);
    const realCtx = { ...ctx, source: object };
    for (const key of keys) {
      const value = Reflect.get(object, key);
      const meta = getMetaInInjectBrandObject(value);
      if (!meta) continue;
      Reflect.set(object, key, this._resolveInject(meta, realCtx));
    }
    return object;
  }
}

function getObjectAllSimplePropertyKeys<T extends object>(o: T): Array<string | number | symbol> {
  const list = new Set<string | number | symbol>();
  const blacklist = new Set<string | number | symbol>();
  const process = (o: object) => {
    const ownPropertyNames = Reflect.ownKeys(o)
    for (const key of ownPropertyNames) {
      const descriptor = Reflect.getOwnPropertyDescriptor(o, key)
      if (!descriptor) continue;
      if (descriptor.get || descriptor.set || descriptor.writable == false) {
        blacklist.add(key);
        continue;
      }
      list.add(key);
    }
  }

  let target: object | null = o;
  while (target) {
    process(target)
    target = Reflect.getPrototypeOf(target!);
  }

  for (const item of blacklist) {
    list.delete(item)
  }
  return [...list];
}
