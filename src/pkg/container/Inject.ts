import { createInjectBrandObject } from "./private/InjectBrand";
import { Constructor } from "./types";

export function Inject<T>(constructor: Constructor<T>): T {
  return createInjectBrandObject({
    class: constructor
  })
}
