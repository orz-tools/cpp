import type { UserData } from './UserData'

/** What 用户数据管理 exports (`@orz/cpp/dump` version 1). */
export interface CppDump {
  game: string
  instanceName: string
  exportedAt?: number
  userdata: Partial<UserData<any>>
  preference?: Record<string, any>
  region?: string
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
    },
  }
}

function isObject(v: unknown): v is Record<string, any> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}
