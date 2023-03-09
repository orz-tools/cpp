import { createInjectBrandObject } from "./private/InjectBrand"
import { Constructor } from "./types"

const InjectMethod = `inject$` as const
type InjectMethod<T extends string = string> = `${typeof InjectMethod}${T}`

export function InjectX<T>(constructor: Constructor<T>): { [K in Extract<keyof T, InjectMethod> as (K extends InjectMethod<infer R> ? R : never)]: T[K] } {
  const box = createInjectBrandObject({
    error: `A method on InjectX<${constructor.name}> must be invoked.`
  })

  return new Proxy(box, {
    get(target, name) {
      if (typeof name !== 'string') return target[name];

      return (...args: any[]) => {
        return createInjectBrandObject({
          class: constructor,
          getter: (r) => {
            const fnName = `${InjectMethod}${name}`;
            if (typeof r[fnName] !== 'function') {
              throw new Error(`\`InjectX<${constructor.name}>.${name}' (\`${constructor.name}.prototype.${fnName}') doesn't exist.`)
            }
            return r[fnName].apply(r, args);
          }
        })
      }
    }
  })
}
