import { GameName, gameAdapterLoaders } from './games'

export function getProfiles() {
  const profiles: [game: GameName, instanceName: string, notCreated?: true][] = []
  const len = localStorage.length
  for (let i = 0; i < len; i++) {
    const key = localStorage.key(i)
    if (!key) continue
    if (key === 'cpp_userdata') {
      profiles.push([GameName.Arknights, ''])
      continue
    }
    if (!key.endsWith(']userdata')) continue
    if (!key.startsWith('cpp[')) continue
    const sk = key.slice('cpp['.length, key.length - ']userdata'.length)
    const pos = sk.indexOf('][')
    if (pos < 0) continue
    const a = sk.substring(0, pos)
    if (!a) continue
    const b = sk.substring(pos + 2)
    profiles.push([decodeURIComponent(a) as GameName, decodeURIComponent(b)])
  }

  for (const i of Object.keys(gameAdapterLoaders)) {
    if (profiles.find((x) => x[0] === i && x[1] === '')) continue
    profiles.push([i as GameName, '', true])
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

export function getStoragePrefix(game: string, instanceName: string) {
  let storagePrefix = `cpp[${encodeURIComponent(game)}][${encodeURIComponent(instanceName)}]`
  if (game === 'arknights' && instanceName === '') storagePrefix = `cpp_`

  return storagePrefix
}
