import { ArknightsAdapter } from './pkg/cpp-arknights/GameAdapter'
import { IGameAdapter, IGame } from './pkg/cpp-basic'

export const games = {
  arknights: () => new ArknightsAdapter(),
} satisfies Record<string, () => IGameAdapter<IGame>>

export function getProfiles() {
  const profiles: [game: string, instanceName: string, notCreated?: true][] = []
  const len = localStorage.length
  for (let i = 0; i < len; i++) {
    const key = localStorage.key(i)
    if (!key) continue
    if (key === 'cpp_userdata') {
      profiles.push(['arknights', ''])
      continue
    }
    if (!key.endsWith(']userdata')) continue
    if (!key.startsWith('cpp[')) continue
    const sk = key.substring('cpp['.length, key.length - 'cpp['.length - ']userdata'.length)
    const pos = sk.indexOf('][')
    if (pos < 0) continue
    const a = sk.substring(0, pos)
    if (!a) continue
    const b = sk.substring(pos + 2)
    profiles.push([decodeURIComponent(a), decodeURIComponent(b)])
  }

  for (const i of Object.keys(games)) {
    if (profiles.find((x) => x[0] === i && x[1] === '')) continue
    profiles.push([i, '', true])
  }

  return profiles.sort(([a1, a2], [b1, b2]) => {
    if (a1 > b1) return 1
    if (a1 < b1) return -1
    if (a2 > b2) return 1
    if (a2 < b2) return -1
    return 0
  })
}

export function formatProfileName(game: string, instanceName: string) {
  return `[${game.toUpperCase()}][${JSON.stringify(instanceName)}]`
}
