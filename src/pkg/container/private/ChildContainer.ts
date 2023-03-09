import { ContainerInstance } from "./ContainerInstance";
import { ContainerProxy } from "./ContainerProxy";
import { InjectContext } from "./InjectBrand";
import { magic, RootContainer } from "./RootContainer";

export class ChildContainer extends ContainerProxy {
  constructor(
    _m: any,
    _instance: ContainerInstance,
    protected _rootContainer: RootContainer,
    protected _source: any,
  ) {
    super(_instance)
    if (_m !== magic) throw new Error('This constructor is not for you.');
  }

  protected get context(): InjectContext {
    return {
      rootContainer: this._rootContainer,
      source: this._source
    }
  }
}
