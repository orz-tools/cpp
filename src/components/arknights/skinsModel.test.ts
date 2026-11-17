import { atom, createStore } from 'jotai'
import { describe, expect, it, vi } from 'vitest'
import type { IGameAdapter } from '../../pkg/cpp-basic'
import type { Arknights } from '../../pkg/cpp-arknights/types'
import { UserData, UserDataAtomHolder, newUserData } from '../../pkg/cpp-core/UserData'
import { readSkinPrefs, setSkinOwned } from './skinsModel'

// 只测和 React 无关的部分
vi.mock('../../Cpp', () => ({}))

function setup(skins: Record<string, number>) {
  const store = createStore()
  const ga = {
    getUserDataAdapter: () => ({ getAllCharacterIds: () => [], rewriteCharacters: () => [] }),
  } as unknown as IGameAdapter<Arknights>
  const atoms = new UserDataAtomHolder(ga)
  atoms.setAtom(
    atom<UserData<Arknights> | undefined>({ ...newUserData<Arknights>(), skins }),
    atom<string[]>([]),
    atom(0),
  )
  const dataAtom = atoms.atoms.dataAtom
  return { store, atoms, skins: () => store.get(dataAtom).skins, undo: () => store.set(dataAtom, 'undo') }
}

describe('skin state', () => {
  it('marks skins in one undo step, and undoing brings the acquired time back', () => {
    const cpp = setup({ 'a@x#1': 1700000000 })
    setSkinOwned(cpp, ['a@x#1', 'b@x#1'], false)
    expect(cpp.skins()).toEqual({})
    cpp.undo()
    expect(cpp.skins()).toEqual({ 'a@x#1': 1700000000 })

    setSkinOwned(cpp, ['a@x#1', 'b@x#1'], true)
    expect(cpp.skins()).toEqual({ 'a@x#1': 1700000000, 'b@x#1': 0 })
    cpp.undo()
    expect(cpp.skins()).toEqual({ 'a@x#1': 1700000000 })
  })

  it('reads the stored preferences, or the defaults', () => {
    expect(readSkinPrefs({ timelineCollapsed: true })).toEqual({ timelineCollapsed: true })
    expect(readSkinPrefs({ timelineCollapsed: 'yes' })).toEqual({ timelineCollapsed: false })
    expect(readSkinPrefs(null)).toEqual({ timelineCollapsed: false })
  })
})
