type AsyncFunction = (...args: any[]) => PromiseLike<unknown>

type PromiseValue<PromiseType, Otherwise = PromiseType> = PromiseType extends PromiseLike<infer Value>
  ? { 0: PromiseValue<Value>; 1: Value }[PromiseType extends PromiseLike<unknown> ? 0 : 1]
  : Otherwise

type AsyncReturnType<Target extends AsyncFunction> = PromiseValue<ReturnType<Target>>

export class DedupPool<K> {
  pool = new Map<K, PromiseLike<any>>()

  async run<F extends (...args: any[]) => PromiseLike<any>>(
    key: K,
    generator: F,
    ...args: Parameters<F>
  ): Promise<AsyncReturnType<F>> {
    let pending = this.pool.get(key)

    if (!pending) {
      pending = generator(...args)
      this.pool.set(key, pending)
      try {
        return await pending
      } finally {
        if (this.pool.get(key) === pending) {
          this.pool.delete(key)
        } else {
          // tslint:disable-next-line: no-unsafe-finally
          throw new Error('WTF? This should never happen')
        }
      }
    }

    return await pending
  }

  async wait(key: K): Promise<void> {
    const pending = this.pool.get(key)
    if (pending) {
      await pending
    }
  }
}

export function dedup<F extends (key?: any) => PromiseLike<any>>(generator: F): F {
  const pool = new DedupPool<void>()
  return (async (key?: any) => {
    if (arguments.length === 0) {
      return pool.run<any>(undefined, generator)
    } else {
      return pool.run<any>(key, generator, key)
    }
  }) as any
}
