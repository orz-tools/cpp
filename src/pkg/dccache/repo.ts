import { IDataContainerHeader, IDataContainer } from './dc'
import { DataContainerObject } from './obj'

const REPO_ROOT = 'https://cpp.xivcdn.com/data'

export class CppRepoObject<T extends object> extends DataContainerObject<T> {
  public constructor(public readonly name: string) {
    super()
  }

  public async getData(header: IDataContainerHeader): Promise<IDataContainer<T>> {
    const res = await fetch(
      `${REPO_ROOT}/files/${encodeURIComponent(this.name)}.json?${new URLSearchParams({
        v: String(header.version.id),
        t: String(header.version.timestamp),
        s: String(header.version.schema),
      })}`,
    )
    if (!res.ok) {
      throw new Error(
        `Failed to fetch file ${encodeURIComponent(this.name)}.json from repo: ${res.status} ${res.statusText}`,
      )
    }
    return res.json()
  }

  public async getHeader(force?: boolean | undefined): Promise<IDataContainerHeader> {
    // DEBUG: return (await import(`../cpp-data-schemas/${encodeURIComponent(this.name)}.json`)).default

    const res = await fetch(
      `${REPO_ROOT}/versions/${encodeURIComponent(this.name)}.version.json` +
        (force
          ? `?${new URLSearchParams({
              r: String(Math.random()),
              t: String(Date.now()),
            })}`
          : ''),
    )
    if (!res.ok) {
      throw new Error(
        `Failed to fetch version ${encodeURIComponent(this.name)}.version.json from repo: ${res.status} ${
          res.statusText
        }`,
      )
    }
    return res.json()
  }
}
