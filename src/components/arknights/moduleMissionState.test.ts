import { atom, createStore } from 'jotai'
import { describe, expect, it, vi } from 'vitest'
import type { IGameAdapter } from '../../pkg/cpp-basic'
import type { Arknights } from '../../pkg/cpp-arknights/types'
import { UserData, UserDataAtomHolder, newUserData } from '../../pkg/cpp-core/UserData'
import { markRunDone, readMissionPrefs, setMissionsDone } from './moduleMissionState'

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
  return { store, atoms, done: () => store.get(atoms.atoms.dataAtom).doneMissions }
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

  it('reads the stored scope and rarities, or the defaults', () => {
    expect(readMissionPrefs({ scope: 'elite2', rarities: [6] })).toEqual({ scope: 'elite2', rarities: [6] })
    expect(readMissionPrefs({ scope: 'mine', rarities: [] })).toEqual({ scope: 'plan', rarities: [] })
    expect(readMissionPrefs({ scope: 'all', rarities: [3] })).toEqual({ scope: 'plan', rarities: [] })
    expect(readMissionPrefs(null)).toEqual({ scope: 'plan', rarities: [] })
  })
})
