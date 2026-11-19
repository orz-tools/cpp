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
  header: IDataContainerHeader
}

function headerOf(c: IDataContainerHeader): IDataContainerHeader {
  return Object.assign({}, c, { data: undefined })
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
 * Without refresh, a copy in hand that passes verification is returned as it is, so opening the page does not wait on
 * the network; the update check brings it up to date. The repo is asked only when there is no such copy.
 *
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

    // What is held in memory speaks for this session, whatever the meta says.
    if (current) return current

    const data = await loadData<T>(obj.name)
    const meta = await loadMeta(obj.name)
    if (data && !obj.safeVerify(data)) {
      if (!meta || !deepEqual(meta.header.version, data.version, { strict: true })) {
        // Earlier builds wrote the meta before downloading, so a download cut short left it naming another version;
        // a page closed between storing the data and writing the meta leaves it behind too. Make it describe the
        // copy, never checked, so the next update check asks the repo at once.
        await saveMeta(obj.name, { lastCheckedAt: 0, header: headerOf(data) })
      }
      return data
    }

    // A higher requiredSchema fails the stored version too; force past the version file a CDN may still serve.
    return await fetch(obj, meta && obj.safeVerify(meta.header) ? true : undefined, onRefreshed)
  })
}

/** The meta is written only once the data it names is stored, so a download cut short leaves the copy in hand. */
async function fetch<T extends object>(
  obj: DataContainerObject<T>,
  force?: boolean,
  onRefreshed?: () => any,
  current?: IDataContainer<T>,
): Promise<IDataContainer<T>> {
  const header = await obj.getHeader(force)
  obj.verify(header)
  const now = Date.now()

  const previousData = current || (await loadData<T>(obj.name))
  if (previousData && previousData.version && !obj.safeVerify(previousData)) {
    if (deepEqual(header.version, previousData.version, { strict: true })) {
      await saveMeta(obj.name, { lastCheckedAt: now, header: headerOf(header) })
      return previousData
    }
    const mismatch = mismatches.get(obj.name)
    if (
      mismatch &&
      deepEqual(header.version, mismatch.named, { strict: true }) &&
      deepEqual(previousData.version, mismatch.carried, { strict: true })
    ) {
      await saveMeta(obj.name, { lastCheckedAt: now, header: headerOf(previousData) })
      return previousData
    }
  }

  const data = 'data' in header ? header : await obj.getData(header)
  // Verified before it is stored, so a download that fails it does not replace a copy that works.
  obj.verify(data)
  await saveData(obj.name, data)

  if (deepEqual(header.version, data.version, { strict: true })) {
    await saveMeta(obj.name, { lastCheckedAt: now, header: headerOf(header) })
  } else {
    console.warn('Remote version and data mismatch.')
    mismatches.set(obj.name, { named: header.version, carried: data.version })
    await saveMeta(obj.name, { lastCheckedAt: now, header: headerOf(data) })
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
