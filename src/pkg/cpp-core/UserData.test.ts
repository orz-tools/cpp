import { atom, createStore } from 'jotai'
import { beforeEach, describe, expect, it } from 'vitest'
import { ExpItem, Formula, IGame, IGameAdapter, Task } from '../cpp-basic'
import { UserData, UserDataAtomHolder, newUserData } from './UserData'

let ids: string[]
let taskCost: number
let formulas: Formula[]
let expItems: Record<string, ExpItem>

const empty = Object.freeze({})

const ga = {
  getUserDataAdapter: () => ({
    getAllCharacterIds: () => [...ids],
    getFrozenEmptyCharacterStatus: () => empty,
    rewriteCharacters: (_: string, current: object, goal: object) => [current, goal] as const,
    finishedCharacterStatus: () => empty,
    generateTasksForCharacter: (charId: string): Task<IGame>[] => [
      { id: `${charId}-${taskCost}`, charId, type: 'x', requires: [{ itemId: 'x', quantity: taskCost }], depends: [] },
    ],
  }),
  getFormulas: () => formulas,
  getExpItems: () => expItems,
} as unknown as IGameAdapter<IGame>

function setup() {
  const store = createStore()
  const generation = atom(0)
  const holder = new UserDataAtomHolder(ga)
  holder.setAtom(
    atom<UserData<IGame> | undefined>({
      ...newUserData(),
      current: { a: {} },
      goal: { a: {} },
      goalOrder: ['a'],
      items: { b1: 2, b2: 1 },
    }),
    atom<string[]>([]),
    generation,
  )
  const nextGeneration = () => store.set(generation, (x) => x + 1)
  return { store, atoms: holder.atoms, nextGeneration }
}

describe('UserDataAtomHolder', () => {
  beforeEach(() => {
    ids = ['a']
    taskCost = 1
    formulas = [{ id: 'f', itemId: 'x', quantity: 1, costs: [{ itemId: 'y', quantity: 3 }], tags: [] }]
    expItems = { exp: { value: { b1: 100, b2: 1000 }, indirectStage: [] } }
  })

  it('reads the character list again only for a new generation', () => {
    const { store, atoms, nextGeneration } = setup()
    expect(store.get(atoms.allCharacterIds)).toEqual(['a'])
    ids = ['a', 'b']
    expect(store.get(atoms.allCharacterIds)).toEqual(['a'])
    nextGeneration()
    expect(store.get(atoms.allCharacterIds)).toEqual(['a', 'b'])
  })

  it('generates the tasks and their indirect requirements again only for a new generation', () => {
    const { store, atoms, nextGeneration } = setup()
    expect(store.get(atoms.goalTasks('a'))[0].requires).toEqual([{ itemId: 'x', quantity: 1 }])
    expect(store.get(atoms.allGoalIndirectsDetails).indirects).toEqual({ y: 3 })

    taskCost = 2
    formulas = [{ id: 'f', itemId: 'x', quantity: 1, costs: [{ itemId: 'y', quantity: 5 }], tags: [] }]
    expect(store.get(atoms.goalTasks('a'))[0].requires).toEqual([{ itemId: 'x', quantity: 1 }])
    expect(store.get(atoms.allGoalIndirectsDetails).indirects).toEqual({ y: 3 })

    nextGeneration()
    expect(store.get(atoms.goalTasks('a'))[0].requires).toEqual([{ itemId: 'x', quantity: 2 }])
    expect(store.get(atoms.allGoalIndirectsDetails).indirects).toEqual({ y: 10 })
  })

  it('totals the exp items by the exp table of the current generation and ignores writes to the total', () => {
    const { store, atoms, nextGeneration } = setup()
    expect(store.get(atoms.itemQuantity('exp'))).toBe(1200)
    store.set(atoms.itemQuantity('exp'), 5)
    expect(store.get(atoms.itemQuantity('exp'))).toBe(1200)
    expect(store.get(atoms.dataAtom).items).toEqual({ b1: 2, b2: 1 })

    expItems = { exp: { value: { b1: 200, b2: 1000 }, indirectStage: [] } }
    nextGeneration()
    expect(store.get(atoms.itemQuantity('exp'))).toBe(1400)

    store.set(atoms.itemQuantity('b1'), 3)
    expect(store.get(atoms.itemQuantity('exp'))).toBe(1600)
  })

  it('reads done module missions from data saved before them as none', () => {
    const store = createStore()
    const holder = new UserDataAtomHolder(ga)
    const { doneMissions: _, ...old } = newUserData()
    holder.setAtom(atom<UserData<IGame> | undefined>(old as UserData<IGame>), atom<string[]>([]), atom(0))
    expect(store.get(holder.atoms.dataAtom).doneMissions).toEqual([])
  })

  it('undoes and redoes marking module missions done', () => {
    const { store, atoms } = setup()
    store.set(atoms.dataAtom, 'modify', (d) => {
      d.doneMissions.push('uniequip_002_test_2')
    })
    expect(store.get(atoms.dataAtom).doneMissions).toEqual(['uniequip_002_test_2'])
    store.set(atoms.dataAtom, 'undo')
    expect(store.get(atoms.dataAtom).doneMissions).toEqual([])
    store.set(atoms.dataAtom, 'redo')
    expect(store.get(atoms.dataAtom).doneMissions).toEqual(['uniequip_002_test_2'])
  })

  it('reads owned skins from data saved before them as none', () => {
    const store = createStore()
    const holder = new UserDataAtomHolder(ga)
    const { skins: _, ...old } = newUserData()
    holder.setAtom(atom<UserData<IGame> | undefined>(old as UserData<IGame>), atom<string[]>([]), atom(0))
    expect(store.get(holder.atoms.dataAtom).skins).toEqual({})
  })

  it('undoes and redoes changing owned skins', () => {
    const { store, atoms } = setup()
    store.set(atoms.dataAtom, 'modify', (d) => {
      d.skins['char_002_amiya@winter#1'] = 1700000000
    })
    expect(store.get(atoms.dataAtom).skins).toEqual({ 'char_002_amiya@winter#1': 1700000000 })
    store.set(atoms.dataAtom, 'undo')
    expect(store.get(atoms.dataAtom).skins).toEqual({})
    store.set(atoms.dataAtom, 'redo')
    expect(store.get(atoms.dataAtom).skins).toEqual({ 'char_002_amiya@winter#1': 1700000000 })
  })
})
