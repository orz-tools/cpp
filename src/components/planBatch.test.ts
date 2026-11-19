import { atom, createStore } from 'jotai'
import { describe, expect, it } from 'vitest'
import { txatom } from '../pkg/txatom'
import { listRequeryAtom, requeryList, undoIfUnchanged } from './planBatch'

function setup() {
  const store = createStore()
  const atoms = txatom(atom({ n: 0 }))
  const step = (n: number) =>
    store.set(atoms.dataAtom, 'modify', (d) => {
      d.n = n
    })
  return { store, atoms, step }
}

describe('undoIfUnchanged', () => {
  it('undoes the step it was offered for', () => {
    const { store, atoms, step } = setup()
    step(1)
    const head = store.get(atoms.dataAtom)
    expect(undoIfUnchanged(store, atoms, head)).toBe(true)
    expect(store.get(atoms.dataAtom)).toEqual({ n: 0 })
  })

  it('leaves the data alone once it changed again', () => {
    const { store, atoms, step } = setup()
    step(1)
    const head = store.get(atoms.dataAtom)
    step(2)
    expect(undoIfUnchanged(store, atoms, head)).toBe(false)
    expect(store.get(atoms.dataAtom)).toEqual({ n: 2 })
  })

  it('does nothing without an undo step', () => {
    const { store, atoms } = setup()
    expect(undoIfUnchanged(store, atoms, store.get(atoms.dataAtom))).toBe(false)
  })
})

describe('requeryList', () => {
  it('counts up', () => {
    const store = createStore()
    requeryList(store)
    requeryList(store)
    expect(store.get(listRequeryAtom)).toBe(2)
  })
})
