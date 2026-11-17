import { describe, expect, it, vi } from 'vitest'
import type { DataContainerObject, IDataContainer } from '../dccache'
import { ArknightsPrtsSkinsObject } from './DataObjects'
import { PrtsSkinsData, PrtsSkinsLoader } from './prtsSkins'

vi.mock('localforage', () => ({
  default: {
    dropInstance: () => Promise.resolve(),
    createInstance: () => ({ removeItem: () => Promise.resolve() }),
  },
}))

const HOUR = 3600_000

function container(id: string): IDataContainer<PrtsSkinsData> {
  return {
    '@type': '@orz/cpp/data-container',
    '@version': 1,
    name: 'arknights-prts-skins',
    version: { id, text: id, timestamp: 1, sources: [], schema: 1 },
    data: { skins: { [id]: { windows: [], noVoucher: false, dynamic: false } } },
  }
}

/** Each load takes the next answer: a version id, or null for a failed request */
function fakeDeps(answers: (string | null)[], checkedAt: number) {
  const calls: (boolean | undefined)[] = []
  const load = vi.fn((_: DataContainerObject<any>, refresh?: boolean) => {
    calls.push(refresh)
    const next = answers.shift()
    return next ? Promise.resolve(container(next)) : Promise.reject(new Error('offline'))
  })
  return {
    deps: { load: load as any, getLastCheckedAt: () => Promise.resolve(checkedAt), now: () => 10 * HOUR },
    calls,
  }
}

describe('PrtsSkinsLoader', () => {
  const obj = new ArknightsPrtsSkinsObject()

  it('reads once in a session', async () => {
    const { deps, calls } = fakeDeps(['a'], 9 * HOUR)
    const loader = new PrtsSkinsLoader(deps)
    const a = await loader.get(obj)
    const b = await loader.get(obj)
    expect(Object.keys(a.skins)).toEqual(['a'])
    expect(b).toBe(a)
    expect(calls).toEqual([undefined])
  })

  it('asks the repo again when the stored copy was checked more than 8 hours ago', async () => {
    const { deps, calls } = fakeDeps(['a', 'b'], 1 * HOUR)
    const d = await new PrtsSkinsLoader(deps).get(obj)
    expect(Object.keys(d.skins)).toEqual(['b'])
    expect(calls).toEqual([undefined, false])
  })

  it('keeps the stored copy when asking again fails', async () => {
    const { deps, calls } = fakeDeps(['a', null], 1 * HOUR)
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const d = await new PrtsSkinsLoader(deps).get(obj)
    expect(Object.keys(d.skins)).toEqual(['a'])
    expect(calls).toEqual([undefined, false])
  })

  it('downloads again on 重试 after a first failure', async () => {
    const { deps, calls } = fakeDeps([null, 'a'], 9 * HOUR)
    const loader = new PrtsSkinsLoader(deps)
    await expect(loader.get(obj)).rejects.toThrow('offline')
    const d = await loader.get(obj)
    expect(Object.keys(d.skins)).toEqual(['a'])
    expect(calls).toEqual([undefined, undefined])
  })
})
