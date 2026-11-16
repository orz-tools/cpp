import { describe, expect, it } from 'vitest'
import { buildCppDump, parseCppDump } from './dump'

const dump = (v: Record<string, unknown>) =>
  JSON.stringify({
    '@type': '@orz/cpp/dump',
    '@version': 1,
    game: 'arknights',
    instanceName: 'alt',
    exportedAt: 1763290000000,
    userdata: { current: {}, goal: {}, items: { '4001': 1 } },
    preference: { valueType: 'ap' },
    region: 'zh_CN',
    ...v,
  })

describe('parseCppDump', () => {
  it('reads a dump of this game', () => {
    expect(parseCppDump(dump({}), 'arknights')).toEqual({
      dump: {
        game: 'arknights',
        instanceName: 'alt',
        exportedAt: 1763290000000,
        userdata: { current: {}, goal: {}, items: { '4001': 1 } },
        preference: { valueType: 'ap' },
        region: 'zh_CN',
      },
    })
  })

  it('leaves out preference and region that are missing or of another type', () => {
    const result = parseCppDump(dump({ preference: undefined, region: '' }), 'arknights')
    expect(result).toMatchObject({ dump: { preference: undefined, region: undefined } })
    expect(parseCppDump(dump({ preference: 'x', region: 1 }), 'arknights')).toMatchObject({
      dump: { preference: undefined, region: undefined },
    })
  })

  it('rejects a dump of another game', () => {
    expect(parseCppDump(dump({ game: 're1999' }), 'arknights')).toEqual({ rejected: 'game', game: 're1999' })
  })

  it('rejects a dump of another version, or one without userdata', () => {
    expect(parseCppDump(dump({ '@version': 2 }), 'arknights')).toEqual({ rejected: 'version' })
    expect(parseCppDump(dump({ '@version': 2, game: 're1999' }), 'arknights')).toEqual({ rejected: 'version' })
    expect(parseCppDump(dump({ userdata: null }), 'arknights')).toEqual({ rejected: 'version' })
  })

  it('carries the profile extras, and ignores extras that are not an object', () => {
    const extras = { skland: { receivedAt: 1, data: { skins: [] } } }
    expect(parseCppDump(dump({ extras }), 'arknights')).toMatchObject({ dump: { extras } })
    expect(parseCppDump(dump({ extras: [] }), 'arknights')).toMatchObject({ dump: { extras: undefined } })
    expect(parseCppDump(dump({ extras: 'x' }), 'arknights')).toMatchObject({ dump: { extras: undefined } })
  })

  it('does not recognise other JSON or text', () => {
    expect(parseCppDump('{"4001":10836}', 'arknights')).toBeUndefined()
    expect(parseCppDump('[{"@type":"@orz/cpp/dump"}]', 'arknights')).toBeUndefined()
    expect(parseCppDump('{"@type":"@penguin-statistics/depot","items":[]}', 'arknights')).toBeUndefined()
    expect(parseCppDump('这不是 JSON', 'arknights')).toBeUndefined()
    expect(parseCppDump('', 'arknights')).toBeUndefined()
  })
})

describe('buildCppDump', () => {
  const base = {
    game: 'arknights',
    instanceName: 'alt',
    exportedAt: 1763290000000,
    userdata: { current: {}, goal: {}, items: { '4001': 1 } },
    preference: { valueType: 'ap' },
    region: 'zh_CN',
  }

  it('writes the keys in the order the save manager always has, extras last', () => {
    const extras = { skland: { receivedAt: 1, uid: '10000001', data: { skins: [] } } }
    const built = buildCppDump({ ...base, extras })
    expect(Object.keys(built)).toEqual([
      '@type',
      '@version',
      'game',
      'instanceName',
      'exportedAt',
      'userdata',
      'preference',
      'region',
      'extras',
    ])
    expect(parseCppDump(JSON.stringify(built), 'arknights')).toEqual({ dump: { ...base, extras } })
  })

  it('leaves out empty extras', () => {
    expect(buildCppDump({ ...base, extras: {} })).not.toHaveProperty('extras')
    expect(buildCppDump(base)).not.toHaveProperty('extras')
  })
})
