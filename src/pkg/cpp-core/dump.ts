import type { UserData } from './UserData'

/** What 用户数据管理 exports (`@orz/cpp/dump` version 1). */
export interface CppDump {
  game: string
  instanceName: string
  exportedAt?: number
  userdata: Partial<UserData<any>>
  preference?: Record<string, any>
  region?: string
  /** The profile's extras (profileExtras.ts), such as the Skland snapshot. Older dumps have none. */
  extras?: Record<string, unknown>
}

/** The exported object; key order follows what 用户数据管理 has always written, extras last and only when present. */
export function buildCppDump(dump: CppDump) {
  return {
    '@type': '@orz/cpp/dump',
    '@version': 1,
    game: dump.game,
    instanceName: dump.instanceName,
    exportedAt: dump.exportedAt,
    userdata: dump.userdata,
    preference: dump.preference,
    region: dump.region,
    ...(dump.extras && Object.keys(dump.extras).length > 0 ? { extras: dump.extras } : {}),
  }
}

export type CppDumpParseResult = { dump: CppDump } | { rejected: 'game'; game: string } | { rejected: 'version' }

/** undefined: not a dump at all. A dump that cannot go into this game is rejected rather than undefined. */
export function parseCppDump(text: string, game: string): CppDumpParseResult | undefined {
  let v: unknown
  try {
    v = JSON.parse(text)
  } catch {
    return undefined
  }
  if (!isObject(v) || v['@type'] !== '@orz/cpp/dump') return undefined
  // A version-1 dump always has a userdata object; one without it has a layout this code does not know.
  if (v['@version'] !== 1 || !isObject(v.userdata)) return { rejected: 'version' }
  if (v.game !== game) return { rejected: 'game', game: String(v.game) }
  return {
    dump: {
      game: v.game,
      instanceName: typeof v.instanceName === 'string' ? v.instanceName : '',
      exportedAt: typeof v.exportedAt === 'number' ? v.exportedAt : undefined,
      userdata: v.userdata,
      preference: isObject(v.preference) ? v.preference : undefined,
      region: typeof v.region === 'string' && v.region ? v.region : undefined,
      extras: isObject(v.extras) ? v.extras : undefined,
    },
  }
}

function isObject(v: unknown): v is Record<string, any> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}
