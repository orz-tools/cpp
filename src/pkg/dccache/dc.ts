export const CONTAINER_TYPE = '@orz/cpp/data-container' as const
export const CONTAINER_VERSION = 1 as const

export interface IDataContainerHeader {
  '@type': typeof CONTAINER_TYPE
  '@version': typeof CONTAINER_VERSION
  name: string
  version: {
    id: string
    text: string
    timestamp: number
    sources: string[]
    schema: number
  }
}

export interface IDataContainer<Data = object> extends IDataContainerHeader {
  data: Data
}
