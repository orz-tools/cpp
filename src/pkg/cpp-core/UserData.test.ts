import deepEqual from 'deep-equal'
import { atom, createStore } from 'jotai'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ExpItem, Formula, IGame, IGameAdapter, Task } from '../cpp-basic'
import { orderGroups } from '../cpp-basic/groupOrder'
import '../testing/mockLocalforage'
import { TaskStatus } from './Task'
import { UserData, UserDataAtomHolder, generateIndirects, newUserData } from './UserData'

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

describe('plan order', () => {
  // 三项整组任务，每项依赖排在它前面的那项：顺序不同，同一项的 depends 就不同
  const grouped = {
    getUserDataAdapter: () => ({
      getAllCharacterIds: () => ['a', 'b'],
      getFrozenEmptyCharacterStatus: () => empty,
      rewriteCharacters: (_: string, current: object, goal: object) => [current, goal] as const,
      finishedCharacterStatus: () => empty,
      generateTasksForCharacter: (charId: string, _c: object, _g: object, groupOrder?: readonly string[]) => {
        const tasks: Task<IGame>[] = []
        for (const group of orderGroups(['g1', 'g2', 'g3'], groupOrder)) {
          tasks.push({
            id: `${charId}-${group}`,
            charId,
            type: group,
            requires: [],
            depends: tasks.slice(-1),
            group,
          })
        }
        return tasks
      },
    }),
    getFormulas: () => [],
    getExpItems: () => ({}),
  } as unknown as IGameAdapter<IGame>

  function setup(data: Partial<UserData<IGame>> = {}) {
    const store = createStore()
    const holder = new UserDataAtomHolder(grouped)
    holder.setAtom(
      atom<UserData<IGame> | undefined>({
        ...newUserData(),
        current: { a: {} },
        goal: { a: {} },
        goalOrder: ['a'],
        ...data,
      }),
      atom<string[]>([]),
      atom(0),
    )
    return { store, atoms: holder.atoms }
  }

  it("generates an operator's tasks in its stored group order", () => {
    const { store, atoms } = setup({ taskGroupOrder: { a: ['g3'] } })
    expect(store.get(atoms.goalTasks('a')).map((x) => x.group)).toEqual(['g3', 'g1', 'g2'])
    expect(store.get(atoms.finishedTasks('a')).map((x) => x.group)).toEqual(['g3', 'g1', 'g2'])
  })

  it('counts each task once when finishing everything', () => {
    const { store, atoms } = setup({ taskGroupOrder: { a: ['g3'] } })
    const ids = store.get(atoms.sortedFinishedTasks).map((x) => x.id)
    expect(ids).toEqual([...new Set(ids)])
  })

  it("writes the operator's whole group order in one undo step", () => {
    const { store, atoms } = setup()
    store.set(atoms.moveTaskGroup, { charId: 'a', group: 'g1', target: { after: 'g3' } })
    expect(store.get(atoms.dataAtom).taskGroupOrder?.a).toEqual(['g2', 'g3', 'g1'])
    store.set(atoms.dataAtom, 'undo')
    expect('taskGroupOrder' in store.get(atoms.dataAtom)).toBe(false)
  })

  it('writes nothing when a group lands where it was', () => {
    const { store, atoms } = setup()
    const before = store.get(atoms.dataAtom)
    store.set(atoms.moveTaskGroup, { charId: 'a', group: 'g1', target: { before: 'g2' } })
    store.set(atoms.moveInPlan, { charIds: ['a'], target: { before: 'a' } })
    expect(store.get(atoms.dataAtom)).toBe(before)
  })

  it('moves in the plan order with the planned operators the stored order misses', () => {
    const { store, atoms } = setup({ current: { a: {}, b: {} }, goal: { a: {}, b: {} } })
    store.set(atoms.moveInPlan, { charIds: ['b'], target: { before: 'a' } })
    expect(store.get(atoms.dataAtom).goalOrder).toEqual(['b', 'a'])
  })

  it('moves several operators together in one undo step', () => {
    const three = { a: {}, b: {}, c: {} }
    const { store, atoms } = setup({ current: three, goal: three, goalOrder: ['a', 'b', 'c'] })
    store.set(atoms.moveInPlan, { charIds: ['c', 'a'], target: { after: 'b' } })
    expect(store.get(atoms.dataAtom).goalOrder).toEqual(['b', 'a', 'c'])
    store.set(atoms.dataAtom, 'undo')
    expect(store.get(atoms.dataAtom).goalOrder).toEqual(['a', 'b', 'c'])
  })

  it('writes nothing when several operators land where they are', () => {
    const three = { a: {}, b: {}, c: {} }
    const { store, atoms } = setup({ current: three, goal: three, goalOrder: ['a', 'b', 'c'] })
    const before = store.get(atoms.dataAtom)
    store.set(atoms.moveInPlan, { charIds: ['a', 'b'], target: { before: 'c' } })
    expect(store.get(atoms.dataAtom)).toBe(before)
  })

  it("drops an operator's group order with its plan", () => {
    const { store, atoms } = setup({ taskGroupOrder: { a: ['g3'] } })
    store.set(atoms.allDataAtom, (d) => {
      delete d.goal.a
    })
    expect(store.get(atoms.dataAtom).taskGroupOrder).toEqual({})
  })
})

interface MiniGame extends IGame {
  characterStatus: { elite: number; level: number }
  characterTaskType: { _: 'test' }
  preferences: Record<string, never>
}

function makeGa() {
  const adapter: any = {
    getFrozenEmptyCharacterStatus: () => ({ elite: 0, level: 0 }),
    rewriteCharacters: vi.fn((_charId: string, current: any, goal: any) => {
      if (current && current.elite === 0 && current.level === 0) current = undefined
      if (goal && goal.elite === 0 && goal.level === 0) goal = undefined
      if (current && goal && current.elite === goal.elite && current.level === goal.level) goal = undefined
      return [current, goal]
    }),
    getAllCharacterIds: () => ['char_1'],
    finishedCharacterStatus: () => ({ elite: 2, level: 90 }),
    generateTasksForCharacter: () => [],
    isManuallyTask: () => false,
  }
  const ga = {
    getUserDataAdapter: () => adapter,
    getExpItems: () => ({ '##EXP': { value: { e: 2 }, indirectStage: [] } }),
    getFormulas: () => [],
    getItem: () => ({ valueAsAp: 1 }),
  } as unknown as IGameAdapter<MiniGame>
  return { ga, adapter }
}

function makeIndirectGa(options: { formulas?: Formula[]; expItems?: Record<string, ExpItem> } = {}) {
  return {
    getFormulas: () => options.formulas ?? [],
    getExpItems: () => options.expItems ?? {},
  } as unknown as IGameAdapter<MiniGame>
}

function env() {
  const { ga, adapter } = makeGa()
  const holder = new UserDataAtomHolder<MiniGame>(ga)
  const baseAtom = atom<UserData<MiniGame> | undefined>(undefined)
  const forbiddenFormulaTagsAtom = atom<string[]>([])
  holder.setAtom(baseAtom, forbiddenFormulaTagsAtom, atom(0))
  const store = createStore()
  return { ga, adapter, holder, baseAtom, store, atoms: holder.atoms }
}

describe('newUserData', () => {
  it('returns an empty user data shape', () => {
    expect(newUserData()).toEqual({
      current: {},
      goal: {},
      items: {},
      goalOrder: [],
      starredTasks: [],
      doneMissions: [],
      skins: {},
      savedQueries: [],
    })
  })
})

describe('generateIndirects', () => {
  it('returns no indirects when quantities are sufficient', () => {
    const ga = makeIndirectGa()
    const result = generateIndirects(ga, { a: 2 }, { a: 5 }, [])
    expect(result).toEqual({
      indirects: {},
      unsatisfiedRequirements: {},
      synthisisedRequirements: {},
      unsatisfiedRequirementsDueToFormulaUses: null,
    })
  })

  it('synthesizes missing amounts through formulas and reports material costs', () => {
    const ga = makeIndirectGa({
      formulas: [{ id: 'f', itemId: 'b', quantity: 1, costs: [{ itemId: 'a', quantity: 2 }], tags: [] }],
    })
    const result = generateIndirects(ga, { b: 3 }, { a: 4 }, [])

    expect(result.indirects).toEqual({ a: 6 })
    expect(result.unsatisfiedRequirements).toEqual({ a: 2 })
    expect(result.synthisisedRequirements).toEqual({ b: 3 })
  })

  it('recurses through formula chains', () => {
    const ga = makeIndirectGa({
      formulas: [
        { id: 'fb', itemId: 'b', quantity: 1, costs: [{ itemId: 'a', quantity: 1 }], tags: [] },
        { id: 'fa', itemId: 'a', quantity: 1, costs: [{ itemId: 'c', quantity: 1 }], tags: [] },
      ],
    })
    const result = generateIndirects(ga, { b: 1 }, { c: 2 }, [])

    expect(result.indirects).toEqual({ a: 1, c: 1 })
    expect(result.unsatisfiedRequirements).toEqual({})
    expect(result.synthisisedRequirements).toEqual({ a: 1, b: 1 })
  })

  it('limits synthesis when formulaUses is exhausted', () => {
    const ga = makeIndirectGa({
      formulas: [{ id: 'f', itemId: 'b', quantity: 1, costs: [{ itemId: 'a', quantity: 1 }], tags: [] }],
    })
    const result = generateIndirects(ga, { b: 3 }, {}, [], { f: 1 })

    expect(result.unsatisfiedRequirements).toEqual({ b: 2, a: 1 })
    expect(result.unsatisfiedRequirementsDueToFormulaUses).toEqual({ b: 2 })
    expect(result.synthisisedRequirements).toEqual({ b: 1 })
    expect(result.indirects).toEqual({ a: 1 })
  })

  it('consumes exp items and records indirect usage', () => {
    const ga = makeIndirectGa({
      expItems: { '##EXP': { value: { e1: 100 }, indirectStage: [{ itemId: 'e1', quantity: 1 }] } },
    })
    const result = generateIndirects(ga, { '##EXP': 250 }, { e1: 5 }, [])

    expect(result.indirects).toEqual({ e1: 3 })
    expect(result.unsatisfiedRequirements).toEqual({})
    expect(result.synthisisedRequirements).toEqual({ '##EXP': 300 })
  })

  it('falls back to indirect stages when exp items run out', () => {
    const ga = makeIndirectGa({
      expItems: { '##EXP': { value: { e1: 100 }, indirectStage: [{ itemId: 'e1', quantity: 1 }] } },
    })
    const result = generateIndirects(ga, { '##EXP': 350 }, { e1: 2 }, [])

    expect(result.indirects).toEqual({ e1: 4 })
    expect(result.unsatisfiedRequirements).toEqual({})
    // 库存吸收 200 经验后记账；剩余部分走 indirectStage，只计入 indirects
    expect(result.synthisisedRequirements).toEqual({ '##EXP': 200 })
  })

  it('respects forbidden formula tags', () => {
    const ga = makeIndirectGa({
      formulas: [{ id: 'f', itemId: 'b', quantity: 1, costs: [{ itemId: 'a', quantity: 1 }], tags: ['x'] }],
    })
    const result = generateIndirects(ga, { b: 1 }, { a: 1 }, ['x'])

    expect(result.unsatisfiedRequirements).toEqual({ b: 1 })
    expect(result.indirects).toEqual({})
  })

  it('reports unsatisfied requirements when no formula exists', () => {
    const ga = makeGa().ga
    const result = generateIndirects(ga, { b: 1 }, {}, [])
    expect(result.unsatisfiedRequirements).toEqual({ b: 1 })
    expect(result.synthisisedRequirements).toEqual({})
  })
})

describe('UserDataAtomHolder', () => {
  it('defaults missing user data through rootAtom', () => {
    const { store, atoms } = env()
    expect(store.get(atoms.rootAtom)).toEqual(newUserData())
  })

  it('supports transactional edits through allDataAtom with undo/redo', () => {
    const { store, baseAtom, atoms } = env()
    store.set(atoms.allDataAtom, (data) => {
      data.items.x = 3
    })
    expect(store.get(baseAtom)!.items.x).toBe(3)

    store.set(atoms.dataAtom, 'undo')
    expect(store.get(baseAtom)!.items).toEqual({})

    store.set(atoms.dataAtom, 'redo')
    expect(store.get(baseAtom)!.items.x).toBe(3)
  })

  it('writes current character status and drops an equal goal', () => {
    const { store, baseAtom, atoms, adapter } = env()
    store.set(atoms.currentCharacter('char_1'), (d) => {
      d.elite = 1
      d.level = 30
    })

    const data = store.get(baseAtom)!
    expect(data.current.char_1).toEqual({ elite: 1, level: 30 })
    expect(data.goal.char_1).toBeUndefined()
    expect(store.get(atoms.goalOrder)).toEqual([])
    expect(adapter.rewriteCharacters).toHaveBeenCalled()
  })

  it('writes goal character status and registers it in goalOrder', () => {
    const { store, baseAtom, atoms } = env()
    store.set(atoms.goalCharacter('char_2'), (d) => {
      d.elite = 2
      d.level = 80
    })

    const data = store.get(baseAtom)!
    expect(data.goal.char_2).toEqual({ elite: 2, level: 80 })
    expect(data.current.char_2).toBeUndefined()
    expect(store.get(atoms.goalOrder)).toEqual(['char_2'])
  })

  it('computes exp item quantities from underlying items', () => {
    const { store, atoms } = env()
    store.set(atoms.itemQuantity('e'), 5)
    expect(store.get(atoms.itemQuantity('e'))).toBe(5)
    expect(store.get(atoms.itemQuantity('##EXP'))).toBe(10)
  })

  it('keeps freshly starred ids and cleans stale ones on the next edit', () => {
    const { store, baseAtom, atoms } = env()
    store.set(atoms.stars, (d) => {
      d.push('t1')
    })
    expect(store.get(baseAtom)!.starredTasks).toEqual(['t1'])

    store.set(atoms.currentCharacter('char_1'), (d) => {
      d.elite = 1
    })
    expect(store.get(baseAtom)!.starredTasks).toEqual([])
  })

  it('orders starred tasks with their indirect dependencies first', () => {
    const { store, atoms, adapter } = env()
    const t1: Task<MiniGame> = { id: 't1', charId: 'char_1', type: { _: 'test' }, requires: [], depends: [] }
    const t2: Task<MiniGame> = { id: 't2', charId: 'char_1', type: { _: 'test' }, requires: [], depends: [t1] }
    adapter.generateTasksForCharacter = () => [t1, t2]
    store.set(atoms.baseAtom, {
      ...newUserData(),
      goalOrder: ['char_1'],
      goal: { char_1: { elite: 2, level: 90 } },
      current: { char_1: { elite: 1, level: 30 } },
      starredTasks: ['t2'],
    })

    const details = store.get(atoms.allStarredTasksDetails)
    expect(details.untouched).toEqual(new Set())
    expect(details.directStars.has(t2)).toBe(true)
    expect(details.indirectStars.has(t1)).toBe(true)
    expect(details.sortedStarredTasks).toEqual([t1, t2])
    expect(details.sortedGoalTasks).toEqual([t1, t2])
    expect(store.get(atoms.allStarredTasks).map((x) => x.id)).toEqual(['t1', 't2'])
  })

  it('aggregates requirements and computes task extras for starred, goal and finished tasks', () => {
    const { store, atoms, adapter } = env()
    adapter.generateTasksForCharacter = () => [
      { id: 't1', charId: 'char_1', type: { _: 'test' }, requires: [{ itemId: 'a', quantity: 1 }], depends: [] },
    ]
    store.set(atoms.baseAtom, {
      ...newUserData(),
      goalOrder: ['char_1'],
      goal: { char_1: { elite: 2, level: 90 } },
      current: { char_1: { elite: 1, level: 30 } },
      starredTasks: ['t1'],
    })

    expect(store.get(atoms.allStarredTaskRequirements)).toEqual({ a: 1 })
    expect(store.get(atoms.allGoalTaskRequirements)).toEqual({ a: 1 })
    expect(store.get(atoms.starredTasksWithExtra)[0][1].status).toBe(TaskStatus.AllUnmet)
    expect(store.get(atoms.goalTasksWithExtra)[0][1].status).toBe(TaskStatus.AllUnmet)
    expect(store.get(atoms.finishedTasksWithExtra)).toHaveLength(1)
    expect(store.get(atoms.allFinishedIndirects)).toEqual({})
  })

  it('keeps unstarred tasks after starred tasks in goal order', () => {
    const { store, atoms, adapter } = env()
    const t1: Task<MiniGame> = { id: 't1', charId: 'char_1', type: { _: 'test' }, requires: [], depends: [] }
    const t2: Task<MiniGame> = { id: 't2', charId: 'char_1', type: { _: 'test' }, requires: [], depends: [t1] }
    const t3: Task<MiniGame> = { id: 't3', charId: 'char_1', type: { _: 'test' }, requires: [], depends: [] }
    adapter.generateTasksForCharacter = () => [t1, t2, t3]
    store.set(atoms.baseAtom, {
      ...newUserData(),
      goalOrder: ['char_1'],
      goal: { char_1: { elite: 2, level: 90 } },
      current: { char_1: { elite: 1, level: 30 } },
      starredTasks: ['t2'],
    })

    expect(store.get(atoms.allStarredTasksDetails).sortedGoalTasks).toEqual([t1, t2, t3])
  })

  it('detects finished characters by comparing current and finished status', () => {
    const { store, atoms, adapter } = env()
    adapter.finishedCharacterStatus = () => ({ elite: 2, level: 90 })
    expect(store.get(atoms.isCharacterFinished('char_1'))).toBe(false)

    store.set(atoms.baseAtom, { ...newUserData(), current: { char_1: { elite: 2, level: 90 } } })
    expect(store.get(atoms.isCharacterFinished('char_1'))).toBe(true)
  })
})

describe('plan actions', () => {
  type Status = { lv: number }
  const zero: Status = Object.freeze({ lv: 0 })
  // 和明日方舟一样：培养目标和当前状态相同时丢掉培养目标，没持有（lv 0）时丢掉当前状态
  const leveled = {
    getUserDataAdapter: () => ({
      getAllCharacterIds: () => ['a', 'b', 'c'],
      getFrozenEmptyCharacterStatus: () => zero,
      rewriteCharacters: (_: string, current?: Status, goal?: Status) => {
        if (current && goal && deepEqual(current, goal)) goal = undefined
        if (current && current.lv === 0) current = undefined
        return [current, goal] as const
      },
      finishedCharacterStatus: () => ({ lv: 3 }),
      generateTasksForCharacter: (charId: string, c: Status, g: Status): Task<IGame>[] =>
        g.lv > c.lv ? [{ id: `${charId}->${g.lv}`, charId, type: 'lv', requires: [], depends: [] }] : [],
    }),
    getFormulas: () => [],
    getExpItems: () => ({}),
  } as unknown as IGameAdapter<IGame>

  function setup(data: Partial<UserData<IGame>> = {}) {
    const store = createStore()
    const holder = new UserDataAtomHolder(leveled)
    holder.setAtom(
      atom<UserData<IGame> | undefined>({
        ...newUserData(),
        current: { a: { lv: 1 }, b: { lv: 1 } },
        goal: { a: { lv: 2 } },
        goalOrder: ['a'],
        taskGroupOrder: { a: ['g'] },
        starredTasks: ['a->2'],
        ...data,
      }),
      atom<string[]>([]),
      atom(0),
    )
    return { store, atoms: holder.atoms }
  }

  it('maxes an owned operator out of the plan and appends them to the plan order', () => {
    const { store, atoms } = setup()
    store.set(atoms.maxGoals, ['b'])
    const data = store.get(atoms.dataAtom)
    expect(data.goal.b).toEqual({ lv: 3 })
    expect(data.goalOrder).toEqual(['a', 'b'])
  })

  it('maxes an operator without a current status', () => {
    const { store, atoms } = setup()
    store.set(atoms.maxGoals, ['c'])
    const data = store.get(atoms.dataAtom)
    expect(data.goal.c).toEqual({ lv: 3 })
    expect('c' in data.current).toBe(false)
    expect(data.goalOrder.at(-1)).toBe('c')
  })

  it('maxes several operators in one undo step', () => {
    const { store, atoms } = setup()
    const before = store.get(atoms.dataAtom)
    store.set(atoms.maxGoals, ['a', 'b'])
    store.set(atoms.dataAtom, 'undo')
    expect(store.get(atoms.dataAtom)).toEqual(before)
  })

  it("clears an operator's goal, group order and stars in one undo step", () => {
    const { store, atoms } = setup({
      goal: { a: { lv: 2 }, b: { lv: 3 } },
      goalOrder: ['a', 'b'],
      starredTasks: ['a->2', 'b->3'],
    })
    const before = store.get(atoms.dataAtom)
    store.set(atoms.clearGoals, ['a'])
    const data = store.get(atoms.dataAtom)
    expect('a' in data.goal).toBe(false)
    expect(data.taskGroupOrder && 'a' in data.taskGroupOrder).toBe(false)
    expect(data.goalOrder).toEqual(['b'])
    expect(data.starredTasks).toEqual(['b->3'])
    store.set(atoms.dataAtom, 'undo')
    expect(store.get(atoms.dataAtom)).toEqual(before)
  })

  it('writes nothing when clearing an operator out of the plan', () => {
    const { store, atoms } = setup()
    const before = store.get(atoms.dataAtom)
    store.set(atoms.clearGoals, ['b'])
    expect(store.get(atoms.dataAtom)).toEqual(before)
    expect(() => store.set(atoms.dataAtom, 'undo')).toThrow('no undo history')
  })

  it('tells a maxed goal by its task ids, not their count', () => {
    const { store, atoms } = setup()
    // a 的培养目标 a->2 和拉满的 a->3 都是一项任务
    expect(store.get(atoms.goalMaxed('a'))).toBe(false)
    expect(store.get(atoms.goalMaxed('b'))).toBe(false)
    store.set(atoms.maxGoals, ['a'])
    expect(store.get(atoms.goalMaxed('a'))).toBe(true)
  })

  describe('planTargets', () => {
    // d 当前已经练满
    const current = { a: { lv: 1 }, b: { lv: 1 }, d: { lv: 3 } }

    it('maxes the unfinished operators in the order given, owned or not', () => {
      const { store, atoms } = setup({ current })
      expect(store.get(atoms.planTargets(['c', 'b', 'a', 'd'])).max).toEqual(['c', 'b', 'a'])
    })

    it('leaves out an operator whose goal is maxed', () => {
      const { store, atoms } = setup({ current })
      store.set(atoms.maxGoals, ['a'])
      expect(store.get(atoms.planTargets(['a', 'b'])).max).toEqual(['b'])
    })

    it('clears only the operators in the plan', () => {
      const { store, atoms } = setup({ current })
      expect(store.get(atoms.planTargets(['a', 'b', 'c'])).clear).toEqual(['a'])
    })

    it('tells whether every operator is finished', () => {
      const { store, atoms } = setup({ current })
      expect(store.get(atoms.planTargets(['d'])).allFinished).toBe(true)
      expect(store.get(atoms.planTargets(['d', 'b'])).allFinished).toBe(false)
    })
  })
})

describe('completeTasks', () => {
  type Status = { lv: number }
  const zero: Status = Object.freeze({ lv: 0 })
  // 每一级一项任务，依赖上一级：1 份 m 加 150 经验，经验卡 big 100、small 10
  const leveled = {
    getUserDataAdapter: () => ({
      getAllCharacterIds: () => ['a'],
      getFrozenEmptyCharacterStatus: () => zero,
      rewriteCharacters: (_: string, current?: Status, goal?: Status) => {
        if (current && goal && deepEqual(current, goal)) goal = undefined
        if (current && current.lv === 0) current = undefined
        return [current, goal] as const
      },
      finishedCharacterStatus: () => ({ lv: 3 }),
      generateTasksForCharacter: (charId: string, c: Status, g: Status): Task<IGame>[] => {
        const tasks: Task<IGame>[] = []
        for (let n = c.lv + 1; n <= g.lv; n++) {
          tasks.push({
            id: `${charId}->${n}`,
            charId,
            type: n,
            requires: [
              { itemId: 'm', quantity: 1 },
              { itemId: 'exp', quantity: 150 },
            ],
            depends: tasks.length ? [tasks[tasks.length - 1]] : [],
          })
        }
        return tasks
      },
      completeTask: (type: number, _: string, d: Status) => {
        d.lv = type
      },
      isManuallyTask: () => false,
    }),
    getFormulas: () => [],
    getExpItems: () => ({ exp: { value: { big: 100, small: 10 }, indirectStage: [] } }),
  } as unknown as IGameAdapter<IGame>

  function setup() {
    const store = createStore()
    const holder = new UserDataAtomHolder(leveled)
    holder.setAtom(
      atom<UserData<IGame> | undefined>({
        ...newUserData(),
        current: { a: { lv: 1 } },
        goal: { a: { lv: 3 } },
        goalOrder: ['a'],
        items: { m: 2, big: 3, small: 10 },
      }),
      atom<string[]>([]),
      atom(0),
    )
    return { store, atoms: holder.atoms }
  }

  it('completes the tasks in order and takes their items, the second from what the first left', () => {
    const { store, atoms } = setup()
    const assert = vi.spyOn(console, 'assert')
    try {
      store.set(atoms.completeTasks, { tasks: store.get(atoms.goalTasks('a')), consume: true })
      const data = store.get(atoms.dataAtom)
      expect(data.current.a).toEqual({ lv: 3 })
      expect('a' in data.goal).toBe(false)
      expect(data.items).toEqual({ m: 0, big: 1, small: 0 })
      // m 和 small 刚好用完
      expect(assert.mock.calls.filter(([ok]) => ok === false)).toEqual([])
    } finally {
      assert.mockRestore()
    }
  })

  it('leaves the items alone without consume', () => {
    const { store, atoms } = setup()
    store.set(atoms.completeTasks, { tasks: store.get(atoms.goalTasks('a')), consume: false })
    const data = store.get(atoms.dataAtom)
    expect(data.current.a).toEqual({ lv: 3 })
    expect(data.items).toEqual({ m: 2, big: 3, small: 10 })
  })

  it('undoes the whole batch in one step', () => {
    const { store, atoms } = setup()
    const before = store.get(atoms.dataAtom)
    store.set(atoms.completeTasks, { tasks: store.get(atoms.goalTasks('a')), consume: true })
    store.set(atoms.dataAtom, 'undo')
    expect(store.get(atoms.dataAtom)).toEqual(before)
  })
})
