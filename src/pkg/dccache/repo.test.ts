import { afterEach, describe, expect, it, vi } from 'vitest'

const header = { name: 'x', version: { id: 'v1', timestamp: 1, schema: 1 } }

async function freshRepo() {
  vi.resetModules()
  return (await import('./repo')).CppRepoObject
}

function stubFetch(handler: (url: string) => Response) {
  const calls: string[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      calls.push(url)
      try {
        return Promise.resolve(handler(url))
      } catch (e) {
        return Promise.reject(e)
      }
    }),
  )
  return calls
}

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 })

describe('CppRepoObject', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('uses xivcdn when it answers', async () => {
    const CppRepoObject = await freshRepo()
    const calls = stubFetch(() => json(header))
    expect(await new CppRepoObject('x').getHeader()).toEqual(header)
    expect(calls).toEqual(['https://cpp.xivcdn.com/data/versions/x.version.json'])
  })

  it('falls back to GitHub raw on a network (CORS) error and sticks to it', async () => {
    const CppRepoObject = await freshRepo()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const calls = stubFetch((url) => {
      if (url.startsWith('https://cpp.xivcdn.com/')) throw new TypeError('Failed to fetch')
      return json(header)
    })
    const obj = new CppRepoObject('x')
    expect(await obj.getHeader()).toEqual(header)
    await obj.getData(header as any)
    expect(calls).toEqual([
      'https://cpp.xivcdn.com/data/versions/x.version.json',
      'https://raw.githubusercontent.com/SaionjiReisaki/cpp-data/master/versions/x.version.json',
      'https://raw.githubusercontent.com/SaionjiReisaki/cpp-data/master/files/x.json?v=v1&t=1&ss=1',
    ])
  })

  it('falls back on an HTTP error and rethrows when every root fails', async () => {
    const CppRepoObject = await freshRepo()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const calls = stubFetch(() => new Response('', { status: 503, statusText: 'Service Unavailable' }))
    await expect(new CppRepoObject('x').getHeader()).rejects.toThrow(/503 Service Unavailable/)
    expect(calls).toHaveLength(2)
  })
})
