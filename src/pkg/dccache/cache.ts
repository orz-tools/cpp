import deepEqual from 'deep-equal'
import localForage from 'localforage'
import { DedupPool } from '../dedup'
import { IDataContainer, IDataContainerHeader } from './dc'
import { DataContainerObject } from './obj'

const store = localForage.createInstance({
  name: 'cpp_dc',
})

const pool = new DedupPool<string>()

type Version = IDataContainerHeader['version']

/**
 * Per container, a version named by the version file whose download carried another version, and the version it carried.
 * While the version file keeps naming it, getData() would be asked for the same version and bring back what it did
 * last time, so it is not downloaded again in this session.
 */
const mismatches = new Map<string, { named: Version; carried: Version }>()

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

/**
 * current: the container already held in memory. It stands in for the copy stored in IndexedDB, so an unchanged
 * version is neither downloaded again nor read back from storage.
 */
export function load<T extends object>(
  obj: DataContainerObject<T>,
  refresh?: boolean,
  onRefreshed?: () => any,
  current?: IDataContainer<T>,
): Promise<IDataContainer<T>> {
  if (current && obj.safeVerify(current)) current = undefined
  return pool.run(obj.name, async () => {
    if (refresh !== undefined) {
      return await fetch(obj, refresh, onRefreshed, current)
    }

    const meta = await loadMeta(obj.name)
    const data = current || (await loadData<T>(obj.name))
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

    return await fetch(obj, undefined, onRefreshed, current)
  })
}

async function fetch<T extends object>(
  obj: DataContainerObject<T>,
  force?: boolean,
  onRefreshed?: () => any,
  current?: IDataContainer<T>,
): Promise<IDataContainer<T>> {
  const header = await obj.getHeader(force)
  const now = Date.now()
  await saveMeta(obj.name, { lastCheckedAt: now, header: Object.assign({}, header, { data: undefined }) })
  obj.verify(header)

  const previousData = current || (await loadData<T>(obj.name))
  if (previousData && previousData.version && !obj.safeVerify(previousData)) {
    if (deepEqual(header.version, previousData.version, { strict: true })) {
      return previousData
    }
    const mismatch = mismatches.get(obj.name)
    if (
      mismatch &&
      deepEqual(header.version, mismatch.named, { strict: true }) &&
      deepEqual(previousData.version, mismatch.carried, { strict: true })
    ) {
      await saveMeta(obj.name, { lastCheckedAt: now, header: Object.assign({}, previousData, { data: undefined }) })
      return previousData
    }
  }

  const data = 'data' in header ? header : await obj.getData(header)
  await saveData(obj.name, data)
  obj.verify(data)

  if (!deepEqual(header.version, data.version, { strict: true })) {
    console.warn('Remote version and data mismatch.')
    mismatches.set(obj.name, { named: header.version, carried: data.version })
    await saveMeta(obj.name, { lastCheckedAt: now, header: Object.assign({}, data, { data: undefined }) })
  }

  // deep-equal spent 1.3 s in a single task on the 1 MB penguin matrix; key order changes only cost an extra rebuild.
  if (
    previousData &&
    previousData.data &&
    data &&
    data.data &&
    JSON.stringify(previousData.data) === JSON.stringify(data.data)
  ) {
    // treat as not refreshed
  } else {
    onRefreshed?.()
  }

  return data
}
