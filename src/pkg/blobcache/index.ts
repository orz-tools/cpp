import localForage from 'localforage'
import { DedupPool } from '../dedup'
import pLimit from 'p-limit'

const blobStore = localForage.createInstance({
  name: 'cpp_blob',
})

const blobMap = new Map<string, string>()
const pool = new DedupPool<string>()
export const badUrl = 'data:image/webp,'

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

const limit = pLimit(8)

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
        const res = await superfetch(url)
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

async function superfetch(url: string) {
  const github = parseGitHubRawUrl(url)
  if (!github) return fetch(url)

  let originalError: any = null
  try {
    const res = await fetch(url)
    if (res.status === 404) return res
    if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`, { cause: res })
    return res
  } catch (e) {
    originalError = e
  }

  for (const v of Object.values(githubRawTargets)) {
    try {
      const res = await fetch(v(github))
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`, { cause: res })
      return res
    } catch (e) {
      continue
    }
  }

  throw originalError
}

const githubRawTargets = {
  'cdn.jsdelivr.net': (c) =>
    `https://cdn.jsdelivr.net/gh/${encodeURIComponent(c.owner)}/${encodeURIComponent(c.repo)}@${encodeURIComponent(
      c.ref,
    )}/${c.path}`,

  'ghproxy.com': (c) =>
    `https://ghproxy.com/https://raw.githubusercontent.com/${encodeURIComponent(c.owner)}/${encodeURIComponent(
      c.repo,
    )}/${encodeURIComponent(c.ref)}/${c.path}`,

  'raw.gitmirror.com': (c) =>
    `https://raw.gitmirror.com/${encodeURIComponent(c.owner)}/${encodeURIComponent(c.repo)}/${encodeURIComponent(
      c.ref,
    )}/${c.path}`,
} satisfies Record<string, (c: Exclude<ReturnType<typeof parseGitHubRawUrl>, undefined>) => string>

function parseGitHubRawUrl(url: string): { owner: string; repo: string; ref: string; path: string } | undefined {
  // url is https://raw.githubusercontent.com/Aceship/Arknight-Images/main/equip/type/bom-x.png
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return undefined
  }
  if (u.host.toLowerCase() !== 'raw.githubusercontent.com') return
  const parts = u.pathname.split('/')
  if (parts[0]) return
  const owner = decodeURIComponent(parts[1])
  const repo = decodeURIComponent(parts[2])
  const ref = decodeURIComponent(parts[3])
  const path = parts.slice(4).join('/')
  return { owner, repo, ref, path }
}
