import { atom, createStore } from 'jotai'
import { describe, expect, it, vi } from 'vitest'
import type { ListCharactersQueryParam } from '../Cpp'
import { activeRosterPin, clearRosterPin, rosterPinAtom, setRosterPin } from './rosterPin'

vi.mock('../Cpp', () => ({}))

function setup() {
  const store = createStore()
  const queryParamAtom = atom<ListCharactersQueryParam>({ v: 1, search: '', query: '#!all', quick: {} })
  return { store, queryParamAtom }
}

describe('roster pin', () => {
  it('holds while the list keeps the same query param object', () => {
    const cpp = setup()
    setRosterPin(cpp as any, '模组任务 · 4-3', ['char_a', 'char_b'])
    const pin = cpp.store.get(rosterPinAtom)
    expect(activeRosterPin(pin, cpp.store.get(cpp.queryParamAtom))).toEqual({
      label: '模组任务 · 4-3',
      charIds: ['char_a', 'char_b'],
      param: cpp.store.get(cpp.queryParamAtom),
    })
  })

  it('lapses once the query param changes, even to an equal one', () => {
    const cpp = setup()
    setRosterPin(cpp as any, '模组任务 · 4-3', ['char_a'])
    const pin = cpp.store.get(rosterPinAtom)
    cpp.store.set(cpp.queryParamAtom, { ...cpp.store.get(cpp.queryParamAtom) })
    expect(activeRosterPin(pin, cpp.store.get(cpp.queryParamAtom))).toBeNull()
  })

  it('clears', () => {
    const cpp = setup()
    setRosterPin(cpp as any, 'x', ['char_a'])
    clearRosterPin(cpp as any)
    expect(cpp.store.get(rosterPinAtom)).toBeNull()
  })
})
