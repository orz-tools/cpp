import { IDataContainer, IDataContainerHeader } from './dc'
import { DataContainerObject } from './obj'

// GitHub raw is the fallback, not the primary: it caches for ~5 minutes and is rate limited.
const REPO_ROOTS = ['https://cpp.xivcdn.com/data', 'https://raw.githubusercontent.com/SaionjiReisaki/cpp-data/master']

// Once a root fails, later requests in this session start from the one that worked, so a blocked CDN
// costs one failed request rather than one per container.
let preferredRoot = 0

async function fetchFromRepo(path: string, kind: string): Promise<Response> {
  let lastError: unknown
  for (let i = 0; i < REPO_ROOTS.length; i++) {
    const index = (preferredRoot + i) % REPO_ROOTS.length
    try {
      const res = await fetch(`${REPO_ROOTS[index]}/${path}`)
      if (!res.ok) {
        throw new Error(`Failed to fetch ${kind} ${path} from repo: ${res.status} ${res.statusText}`)
      }
      preferredRoot = index
      return res
    } catch (e) {
      if (i < REPO_ROOTS.length - 1) {
        console.warn(`Failed to fetch ${kind} ${path} from ${REPO_ROOTS[index]}, trying the next repo root.`, e)
      }
      lastError = e
    }
  }
  throw lastError
}

export class CppRepoObject<T extends object> extends DataContainerObject<T> {
  public constructor(public readonly name: string) {
    super()
  }

  public async getData(header: IDataContainerHeader): Promise<IDataContainer<T>> {
    const res = await fetchFromRepo(
      `files/${encodeURIComponent(this.name)}.json?${new URLSearchParams({
        v: String(header.version.id),
        t: String(header.version.timestamp),
        ss: String(header.version.schema),
      })}`,
      'file',
    )
    return res.json()
  }

  public async getHeader(force?: boolean): Promise<IDataContainerHeader> {
    // DEBUG: return (await import(`../cpp-data-schemas/${encodeURIComponent(this.name)}.json`)).default

    const res = await fetchFromRepo(
      `versions/${encodeURIComponent(this.name)}.version.json` +
        (force
          ? `?${new URLSearchParams({
              r: String(Math.random()),
              t: String(Date.now()),
            })}`
          : ''),
      'version',
    )
    return res.json()
  }
}
