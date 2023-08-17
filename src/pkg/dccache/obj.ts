import { CONTAINER_TYPE, CONTAINER_VERSION, IDataContainer, IDataContainerHeader } from './dc'

export abstract class DataContainerObject<T extends object> {
  public abstract readonly name: string
  public requiredSchema = 0
  public autoUpdateThreshold = 86400_000 / 3
  public autoUpdateNotificationThreshold = 0

  public verify(o: IDataContainerHeader) {
    if (o.name !== this.name) {
      throw new Error(`DataContainer name mismatch (expected=${this.name}, actual=${o.name}).`)
    }
    if (o['@type'] !== CONTAINER_TYPE || o['@version'] !== CONTAINER_VERSION) {
      throw new Error(`DataContainer ${this.name} version not supported.`)
    }
    if (o.version.schema && this.requiredSchema && o.version.schema < this.requiredSchema) {
      throw new Error(
        `DataContainer ${this.name} schema not supported (expected=${this.requiredSchema}, actual=${o.version.schema}).`,
      )
    }
  }

  public safeVerify(o: IDataContainerHeader): Error | undefined {
    try {
      this.verify(o)
      return undefined
    } catch (e) {
      return e as Error
    }
  }

  public abstract getData(header: IDataContainerHeader): Promise<IDataContainer<T>>
  public abstract getHeader(force?: boolean | undefined): Promise<IDataContainerHeader | IDataContainer<T>>
}
