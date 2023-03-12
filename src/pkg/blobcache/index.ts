import localForage from 'localforage'
import { DedupPool } from '../dedup'
import pLimit from 'p-limit'

const blobStore = localForage.createInstance({
  name: 'cpp_blob',
})

const blobMap = new Map<string, string>()
const pool = new DedupPool<string>()
const badUrl = 'data:image/webp,'

function mime(url: string) {
  try {
    const p = new URL(url).pathname.toLowerCase()
    if (p.endsWith('.png')) return 'image/png'
    return undefined
  } catch {
    return undefined
  }
}

function commit(url: string, blobUrl: string) {
  blobMap.set(url, blobUrl)
  return blobUrl
}

const limit = pLimit(4)

export function load(url: string): string | Promise<string> {
  if (blobMap.has(url)) {
    return blobMap.get(url)!
  }

  return pool.run(url, () =>
    limit(async () => {
      const existing = (await blobStore.getItem(url)) as ArrayBuffer
      if (existing) {
        const blobUrl = URL.createObjectURL(new Blob([existing], { type: mime(url) }))
        return commit(url, blobUrl)
      }

      try {
        const res = await fetch(url)
        if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`, { cause: res })
        const ab = await res.arrayBuffer()
        await blobStore.setItem(url, ab)
        const blobUrl = URL.createObjectURL(new Blob([ab], { type: mime(url) }))
        return commit(url, blobUrl)
      } catch (e) {
        console.error(`Cannot cache ${url}.`, e)
        return commit(url, badUrl)
      }
    }),
  )
}
