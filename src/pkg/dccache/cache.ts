import deepEqual from 'deep-equal'
import localForage from 'localforage'
import { DedupPool } from '../dedup'
import { IDataContainer, IDataContainerHeader } from './dc'
import { DataContainerObject } from './obj'

const store = localForage.createInstance({
  name: 'cpp_dc',
})

const pool = new DedupPool<string>()

interface Meta {
  lastCheckedAt: number
  error?: string
  header: IDataContainerHeader
}

async function loadMeta(name: string) {
  return (await store.getItem(`meta:${name}`)) as Meta | undefined
}

async function saveMeta(name: string, meta: Meta) {
  await store.setItem(`meta:${name}`, meta)
}

async function loadData<T extends object>(name: string) {
  return (await store.getItem(`data:${name}`)) as IDataContainer<T> | undefined
}

async function saveData<T extends object>(name: string, data: IDataContainer<T>) {
  await store.setItem(`data:${name}`, data)
}

async function clearData(name: string) {
  await store.removeItem(`data:${name}`)
}

export async function getLastCheckedAt(obj: DataContainerObject<any>) {
  return (await loadMeta(obj.name))?.lastCheckedAt || 0
}

export async function reset(obj: DataContainerObject<any>) {
  await clearData(obj.name)
}

export async function destroy(name: string) {
  await clearData(name)
  await store.removeItem(`meta:${name}`)
}

export function load<T extends object>(
  obj: DataContainerObject<T>,
  refresh?: boolean | undefined,
  onRefreshed?: () => any,
): Promise<IDataContainer<T>> {
  return pool.run(obj.name, async () => {
    if (refresh !== undefined) {
      return await fetch(obj, refresh, onRefreshed)
    }

    const meta = await loadMeta(obj.name)
    const data = await loadData<T>(obj.name)
    const metaVerify = meta ? obj.safeVerify(meta.header) : null
    const dataVerify = data ? obj.safeVerify(data) : null

    if (metaVerify) {
      return await fetch(obj, true, onRefreshed)
    }

    if (meta) {
      if (data) {
        if (!deepEqual(meta.header.version, data.version, { strict: true })) {
          // break
        } else if (!metaVerify && !dataVerify) {
          return data
        } else if (meta.error) {
          throw new Error(meta.error)
        }
      } else {
        if (meta.error) {
          throw new Error(meta.error)
        }
      }
    } else {
      // break
    }

    return await fetch(obj, undefined, onRefreshed)
  })
}

async function fetch<T extends object>(
  obj: DataContainerObject<T>,
  force?: boolean | undefined,
  onRefreshed?: () => any,
): Promise<IDataContainer<T>> {
  const header = await obj.getHeader(force)
  const now = Date.now()
  await saveMeta(obj.name, { lastCheckedAt: now, header: Object.assign({}, header, { data: undefined }) })
  obj.verify(header)

  const previousData = await loadData<T>(obj.name)
  if (
    previousData &&
    previousData.version &&
    deepEqual(header.version, previousData.version, { strict: true }) &&
    !obj.safeVerify(previousData)
  ) {
    return previousData
  }

  const data = 'data' in header ? header : await obj.getData(header)
  await saveData(obj.name, data)
  obj.verify(data)

  if (!deepEqual(header.version, data.version, { strict: true })) {
    console.warn('Remote version and data mismatch.')
    await saveMeta(obj.name, { lastCheckedAt: now, header: Object.assign({}, data, { data: undefined }) })
  }

  if (
    previousData &&
    previousData.data &&
    data &&
    data.data &&
    deepEqual(previousData.data, data.data, { strict: true })
  ) {
    // treat as not refreshed
  } else {
    onRefreshed && onRefreshed()
  }

  return data
}
