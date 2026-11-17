import { atom, createStore } from 'jotai'
import { describe, expect, it, vi } from 'vitest'
import type { IGameAdapter } from '../../pkg/cpp-basic'
import type { Arknights } from '../../pkg/cpp-arknights/types'
import { UserData, UserDataAtomHolder, newUserData } from '../../pkg/cpp-core/UserData'
import {
  heldMissionsAtom,
  markRunDone,
  missionPrefsAtom,
  readMissionPrefs,
  releaseMissions,
  setMissionsDone,
  tidyMissions,
  toggleMission,
} from './moduleMissionState'

// 只测和 React 无关的部分
vi.mock('../../Cpp', () => ({}))

function setup(doneMissions: string[]) {
  const store = createStore()
  const ga = {
    getUserDataAdapter: () => ({ getAllCharacterIds: () => [], rewriteCharacters: () => [] }),
  } as unknown as IGameAdapter<Arknights>
  const atoms = new UserDataAtomHolder(ga)
  atoms.setAtom(
    atom<UserData<Arknights> | undefined>({ ...newUserData<Arknights>(), doneMissions }),
    atom<string[]>([]),
    atom(0),
  )
  return {
    store,
    atoms,
    done: () => store.get(atoms.atoms.dataAtom).doneMissions,
    held: () => [...store.get(heldMissionsAtom)].sort(),
  }
}

describe('module mission state', () => {
  it('marks a run done and reports only the ids it added', () => {
    const cpp = setup(['a'])
    expect(markRunDone(cpp, ['a', 'b', 'c'])).toEqual(['b', 'c'])
    expect(cpp.done()).toEqual(['a', 'b', 'c'])
    // 提示里的「撤销」只拿掉这次加的
    setMissionsDone(cpp, ['b', 'c'], false)
    expect(cpp.done()).toEqual(['a'])
    expect(markRunDone(cpp, ['a'])).toEqual([])
  })

  it('keeps what a checkbox ticks or unticks where it was', () => {
    const cpp = setup(['a'])
    toggleMission(cpp, 'b', true)
    expect(cpp.done()).toEqual(['a', 'b'])
    expect(cpp.held()).toEqual(['b'])
    toggleMission(cpp, 'a', false)
    expect(cpp.done()).toEqual(['b'])
    expect(cpp.held()).toEqual(['a', 'b'])
    // 再点一下还是留在原处
    toggleMission(cpp, 'b', false)
    expect(cpp.done()).toEqual([])
    expect(cpp.held()).toEqual(['a', 'b'])
    // 「打完了」的提示里的「撤销」不会让它们留下
    setMissionsDone(cpp, ['c'], true)
    expect(cpp.held()).toEqual(['a', 'b'])
  })

  it('lets go of one ticket, or of everything', () => {
    const cpp = setup([])
    for (const id of ['a', 'b', 'c']) toggleMission(cpp, id, true)
    releaseMissions(cpp, ['a', 'c', 'x'])
    expect(cpp.held()).toEqual(['b'])
    expect(cpp.done()).toEqual(['a', 'b', 'c'])
    toggleMission(cpp, 'a', false)
    tidyMissions(cpp)
    expect(cpp.held()).toEqual([])
    expect(cpp.done()).toEqual(['b', 'c'])
  })

  it('lets go of everything when the scope or rarities change', () => {
    const cpp = setup([])
    toggleMission(cpp, 'a', true)
    cpp.store.set(missionPrefsAtom, { scope: 'owned', rarities: [] })
    expect(cpp.held()).toEqual([])
    expect(cpp.store.get(missionPrefsAtom)).toEqual({ scope: 'owned', rarities: [] })
    toggleMission(cpp, 'b', true)
    cpp.store.set(missionPrefsAtom, { scope: 'owned', rarities: [6] })
    expect(cpp.held()).toEqual([])
  })

  it('reads the stored scope and rarities, or the defaults', () => {
    expect(readMissionPrefs({ scope: 'elite2', rarities: [6] })).toEqual({ scope: 'elite2', rarities: [6] })
    expect(readMissionPrefs({ scope: 'mine', rarities: [] })).toEqual({ scope: 'plan', rarities: [] })
    expect(readMissionPrefs({ scope: 'all', rarities: [3] })).toEqual({ scope: 'plan', rarities: [] })
    expect(readMissionPrefs(null)).toEqual({ scope: 'plan', rarities: [] })
  })
})
