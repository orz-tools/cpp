import { describe, expect, it } from 'vitest'
import type { ArknightsDataManager } from '../pkg/cpp-arknights/DataManager'
import type { ArknightsCharacterStatus } from '../pkg/cpp-arknights/types'
import { ArknightsUserDataAdapter } from '../pkg/cpp-arknights/UserDataAdapter'
import { statusDiffs } from './importDiff'

const status = (s: Partial<ArknightsCharacterStatus> = {}): ArknightsCharacterStatus => ({
  elite: 2,
  level: 90,
  skillLevel: 7,
  skillMaster: {},
  modLevel: {},
  ...s,
})

// statusForImportDiff reads no game data
const uda = new ArknightsUserDataAdapter({} as ArknightsDataManager)
const empty = uda.getFrozenEmptyCharacterStatus()
const compared = uda.statusForImportDiff.bind(uda)

describe('statusDiffs', () => {
  it('lists characters that were added, removed or changed', () => {
    const before = { kept: status(), changed: status({ level: 80 }), removed: status() }
    const after = { kept: status(), changed: status(), added: status() }
    expect(statusDiffs(before, after, empty).map((x) => x.key)).toEqual(['changed', 'removed', 'added'])
  })

  it('does not count a field that data saved before it existed lacks, when the import writes its empty value', () => {
    const { potentialRank: _, ...old } = status()
    expect(statusDiffs({ a: old as ArknightsCharacterStatus }, { a: status({ potentialRank: 0 }) }, empty)).toEqual([])
  })

  it('compares only what compared returns, and hands back the statuses themselves', () => {
    const before = { a: status({ level: 80 }), b: status({ skillLevel: 6 }) }
    const after = { a: status(), b: status() }
    expect(statusDiffs(before, after, empty, (s) => s.level)).toEqual([{ key: 'a', before: before.a, after: after.a }])
  })
})

describe('Arknights statusForImportDiff', () => {
  it('lists no operator whose potential alone changed, in the roster or in the plan', () => {
    const before = { a: status(), b: status({ potentialRank: 2 }) }
    const after = { a: status({ potentialRank: 5 }), b: status({ potentialRank: 3 }) }
    expect(statusDiffs(before, after, empty, compared)).toEqual([])
  })

  it('still lists an operator whose potential changed along with something else', () => {
    const before = { a: status({ elite: 1, level: 70 }) }
    const after = { a: status({ level: 80, potentialRank: 5 }) }
    expect(statusDiffs(before, after, empty, compared)).toEqual([{ key: 'a', before: before.a, after: after.a }])
  })

  it('still lists an operator the import adds, whatever its potential', () => {
    const after = { a: status({ elite: 0, level: 1, skillLevel: 1, potentialRank: 5 }) }
    expect(statusDiffs({}, after, empty, compared).map((x) => x.key)).toEqual(['a'])
  })
})
