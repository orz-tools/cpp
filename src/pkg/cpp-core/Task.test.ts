import { describe, expect, it } from 'vitest'
import type { ExpItem, Formula, IGame, IGameAdapter, Task } from '../cpp-basic'
import '../testing/mockLocalforage'
import { emptyTaskExtra, generateTaskExtra, tasksUpTo, TaskCostStatus, TaskExtra, TaskStatus } from './Task'

interface MiniGame extends IGame {
  characterStatus: { level: number }
  characterTaskType: { _: 'test' }
  preferences: Record<string, never>
}

function makeAdapter(
  options: {
    formulas?: Formula[]
    expItems?: Record<string, ExpItem>
    itemValues?: Record<string, number>
    manual?: boolean | ((task: Task<MiniGame>) => boolean)
  } = {},
) {
  return {
    getFormulas: () => options.formulas ?? [],
    getExpItems: () => options.expItems ?? {},
    getItem: (key: string) => ({ valueAsAp: options.itemValues?.[key] ?? 1 }),
    getUserDataAdapter: () => ({
      isManuallyTask: (t: Task<MiniGame>) =>
        typeof options.manual === 'function' ? options.manual(t) : options.manual === true,
    }),
  } as unknown as IGameAdapter<MiniGame>
}

function task(
  id: string,
  requires: { itemId: string; quantity: number }[],
  depends: Task<MiniGame>[] = [],
  charId = 'char_1',
): Task<MiniGame> {
  return { id, charId, type: { _: 'test' }, requires, depends }
}

describe('generateTaskExtra', () => {
  it('marks a task Completable when quantities cover the requirements', () => {
    const ga = makeAdapter({ itemValues: { a: 2 } })
    const result = generateTaskExtra(ga, [task('t1', [{ itemId: 'a', quantity: 3 }])], [], { a: 5 })

    expect(result).toHaveLength(1)
    const [t, extra] = result[0]
    expect(t.id).toBe('t1')
    expect(extra.status).toBe(TaskStatus.Completable)
    expect(extra.costStatus).toEqual([TaskCostStatus.Completable])
    expect(extra.quantityCanConsume).toEqual([5])
    expect(extra.costSynthesised).toEqual([0])
    expect(extra.valueTotal).toEqual([6])
    expect(extra.valueFulfilled).toEqual([6])
  })

  it('marks a task Synthesizable and accumulates formula costs', () => {
    const formulas: Formula[] = [{ id: 'f', itemId: 'b', quantity: 1, costs: [{ itemId: 'a', quantity: 2 }], tags: [] }]
    const ga = makeAdapter({ formulas })
    const result = generateTaskExtra(ga, [task('t1', [{ itemId: 'b', quantity: 3 }])], [], { a: 6 })

    const [, extra] = result[0]
    expect(extra.status).toBe(TaskStatus.Synthesizable)
    expect(extra.costStatus).toEqual([TaskCostStatus.Synthesizable])
    expect(extra.costSynthesised).toEqual([3])
    expect(extra.valueTotal).toEqual([6])
    expect(extra.valueFulfilled).toEqual([6])
  })

  it('marks a task AllUnmet when there is no formula and no quantity', () => {
    const ga = makeAdapter()
    const result = generateTaskExtra(ga, [task('t1', [{ itemId: 'b', quantity: 1 }])], [], {})

    const [, extra] = result[0]
    expect(extra.status).toBe(TaskStatus.AllUnmet)
    expect(extra.costStatus).toEqual([TaskCostStatus.AllUnmet])
    expect(extra.valueTotal).toEqual([1])
    expect(extra.valueFulfilled).toEqual([0])
  })

  it('reports partial consumption for unmet costs', () => {
    const ga = makeAdapter({ itemValues: { a: 2 } })
    const result = generateTaskExtra(ga, [task('t1', [{ itemId: 'a', quantity: 5 }])], [], { a: 2 })

    const [, extra] = result[0]
    expect(extra.status).toBe(TaskStatus.AllUnmet)
    expect(extra.quantityCanConsume).toEqual([2])
    expect(extra.valueTotal).toEqual([10])
    expect(extra.valueFulfilled).toEqual([4])
  })

  it('marks a task DependencyUnmet when a dependency cannot be fulfilled', () => {
    const ga = makeAdapter()
    const t1 = task('t1', [{ itemId: 'a', quantity: 1 }])
    const t2 = task('t2', [{ itemId: 'b', quantity: 1 }], [t1])
    const result = generateTaskExtra(ga, [t1, t2], [], { b: 1 })

    expect(result[0][1].status).toBe(TaskStatus.AllUnmet)
    expect(result[1][1].status).toBe(TaskStatus.DependencyUnmet)
    expect(result[1][1].costStatus).toEqual([TaskCostStatus.Completable])
  })

  it('treats synthesizable dependencies as satisfied', () => {
    const formulas: Formula[] = [{ id: 'f', itemId: 'b', quantity: 1, costs: [{ itemId: 'a', quantity: 1 }], tags: [] }]
    const ga = makeAdapter({ formulas })
    const t1 = task('t1', [{ itemId: 'b', quantity: 1 }])
    const t2 = task('t2', [{ itemId: 'c', quantity: 1 }], [t1])
    const result = generateTaskExtra(ga, [t1, t2], [], { a: 1, c: 1 })

    expect(result[0][1].status).toBe(TaskStatus.Synthesizable)
    expect(result[1][1].status).toBe(TaskStatus.Completable)
  })

  it('propagates unmet dependencies through manual and nested dependencies', () => {
    const ga = makeAdapter({ manual: (t) => t.id === 'm' })
    const manual = task('m', [])
    const t1 = task('t1', [{ itemId: 'a', quantity: 1 }], [manual])
    const t2 = task('t2', [{ itemId: 'b', quantity: 1 }])
    const t3 = task('t3', [{ itemId: 'c', quantity: 1 }], [t2])
    const t4 = task('t4', [{ itemId: 'd', quantity: 1 }], [t3])
    const result = generateTaskExtra(ga, [manual, t1, t2, t3, t4], [], { a: 1, c: 1, d: 1 })

    expect(result[0][1].status).toBe(TaskStatus.Manually)
    expect(result[1][1].status).toBe(TaskStatus.DependencyUnmet)
    expect(result[2][1].status).toBe(TaskStatus.AllUnmet)
    expect(result[3][1].status).toBe(TaskStatus.DependencyUnmet)
    expect(result[4][1].status).toBe(TaskStatus.DependencyUnmet)
  })

  it('marks manual tasks as Manually without consuming anything', () => {
    const ga = makeAdapter({ manual: true })
    const result = generateTaskExtra(ga, [task('t1', [{ itemId: 'a', quantity: 1 }])], [], { a: 1 })

    const [, extra] = result[0]
    expect(extra.status).toBe(TaskStatus.Manually)
    expect(extra.costStatus).toEqual([])
    expect(extra.valueTotal).toEqual([])
  })

  it('respects forbidden formula tags', () => {
    const formulas: Formula[] = [
      { id: 'f', itemId: 'b', quantity: 1, costs: [{ itemId: 'a', quantity: 1 }], tags: ['x'] },
    ]
    const ga = makeAdapter({ formulas })

    const blocked = generateTaskExtra(ga, [task('t1', [{ itemId: 'b', quantity: 1 }])], ['x'], { a: 1 })
    expect(blocked[0][1].status).toBe(TaskStatus.AllUnmet)

    const allowed = generateTaskExtra(ga, [task('t1', [{ itemId: 'b', quantity: 1 }])], [], { a: 1 })
    expect(allowed[0][1].status).toBe(TaskStatus.Synthesizable)
  })

  it('consumes exp items with overshoot from the smallest item', () => {
    const expItems: Record<string, ExpItem> = {
      '##EXP': { value: { e1: 100, e2: 200 }, indirectStage: [] },
    }
    const ga = makeAdapter({ expItems, itemValues: { e1: 1, e2: 2, '##EXP': 3 } })
    const result = generateTaskExtra(ga, [task('t1', [{ itemId: '##EXP', quantity: 350 }])], [], {
      e1: 2,
      e2: 1,
    })

    const [, extra] = result[0]
    expect(extra.status).toBe(TaskStatus.Completable)
    expect(extra.quantityCanConsume).toEqual([400])
    expect(extra.valueTotal).toEqual([1050])
    expect(extra.valueFulfilled).toEqual([4])
  })

  it('marks exp costs AllUnmet when exp is insufficient', () => {
    const expItems: Record<string, ExpItem> = {
      '##EXP': { value: { e1: 100 }, indirectStage: [] },
    }
    const ga = makeAdapter({ expItems })
    const result = generateTaskExtra(ga, [task('t1', [{ itemId: '##EXP', quantity: 350 }])], [], { e1: 2 })

    const [, extra] = result[0]
    expect(extra.status).toBe(TaskStatus.AllUnmet)
    expect(extra.costStatus).toEqual([TaskCostStatus.AllUnmet])
  })

  it('handles exact exp consumption', () => {
    const expItems: Record<string, ExpItem> = {
      '##EXP': { value: { e1: 100 }, indirectStage: [] },
    }
    const ga = makeAdapter({ expItems })
    const result = generateTaskExtra(ga, [task('t1', [{ itemId: '##EXP', quantity: 200 }])], [], { e1: 2 })

    expect(result[0][1].status).toBe(TaskStatus.Completable)
  })

  it('treats completable dependencies as satisfied', () => {
    const ga = makeAdapter()
    const t1 = task('t1', [{ itemId: 'a', quantity: 1 }])
    const t2 = task('t2', [{ itemId: 'b', quantity: 1 }], [t1])
    const result = generateTaskExtra(ga, [t1, t2], [], { a: 1, b: 1 })

    expect(result[0][1].status).toBe(TaskStatus.Completable)
    expect(result[1][1].status).toBe(TaskStatus.Completable)
  })

  it('carries synthesized surplus and leftover quantities to later tasks', () => {
    const formulas: Formula[] = [
      { id: 'fb', itemId: 'b', quantity: 2, costs: [{ itemId: 'a', quantity: 1 }], tags: [] },
    ]
    const ga = makeAdapter({ formulas })
    const result = generateTaskExtra(
      ga,
      [task('t1', [{ itemId: 'b', quantity: 5 }]), task('t2', [{ itemId: 'b', quantity: 1 }])],
      [],
      { a: 3 },
    )

    expect(result[0][1].status).toBe(TaskStatus.Synthesizable)
    expect(result[0][1].costSynthesised).toEqual([5])
    expect(result[1][1].status).toBe(TaskStatus.Completable)
  })

  it('handles multiple requirements with independent cost statuses', () => {
    const ga = makeAdapter()
    const result = generateTaskExtra(
      ga,
      [
        task('t1', [
          { itemId: 'a', quantity: 1 },
          { itemId: 'b', quantity: 2 },
        ]),
      ],
      [],
      { a: 5 },
    )

    const [, extra] = result[0]
    expect(extra.costStatus).toEqual([TaskCostStatus.Completable, TaskCostStatus.AllUnmet])
    expect(extra.status).toBe(TaskStatus.AllUnmet)
  })

  it('returns an empty list for empty tasks', () => {
    const ga = makeAdapter()
    expect(generateTaskExtra(ga, [], [], {})).toEqual([])
  })

  it('lets each task consume what the earlier ones left, without touching the inventory passed in', () => {
    const ga = makeAdapter({
      formulas: [{ id: 'f', itemId: 'y', quantity: 1, costs: [{ itemId: 'z', quantity: 2 }], tags: [] }],
    })
    const inventory = { x: 4, z: 3 }
    const [[, first], [, second], [, third]] = generateTaskExtra(
      ga,
      [
        task('t1', [{ itemId: 'x', quantity: 3 }]),
        task('t2', [{ itemId: 'x', quantity: 3 }]),
        task('t3', [{ itemId: 'y', quantity: 1 }]),
      ],
      [],
      inventory,
    )
    expect(first).toMatchObject({ status: TaskStatus.Completable, quantityCanConsume: [4] })
    expect(second).toMatchObject({ status: TaskStatus.AllUnmet, quantityCanConsume: [1] })
    expect(third).toMatchObject({ status: TaskStatus.Synthesizable, costSynthesised: [1] })
    expect(inventory).toEqual({ x: 4, z: 3 })
  })
})

describe('tasksUpTo', () => {
  const a1 = task('a1', [], [], 'a')
  const a2 = task('a2', [], [], 'a')
  const a3 = task('a3', [], [], 'a')
  const a4 = task('a4', [], [], 'a')
  const b1 = task('b1', [], [], 'b')
  const b2 = task('b2', [], [], 'b')
  const withExtra = (tasks: Task<MiniGame>[]) => tasks.map((t): [Task<MiniGame>, TaskExtra] => [t, emptyTaskExtra])
  const ids = (list: [Task<MiniGame>, TaskExtra][]) => list.map(([t]) => t.id)

  it("takes the operator's tasks down to this one, skipping other operators between them", () => {
    const list = withExtra([a1, b1, a2, b2, a3])
    expect(ids(tasksUpTo(list, a2))).toEqual(['a1', 'a2'])
    expect(ids(tasksUpTo(list, a3))).toEqual(['a1', 'a2', 'a3'])
  })

  it("includes the operator's rows in the starred block, in list order", () => {
    const list = withExtra([a1, b1, a3, b2, a2, a4])
    expect(ids(tasksUpTo(list, a4))).toEqual(['a1', 'a3', 'a2', 'a4'])
  })

  it('finds the task by id, not by object', () => {
    const list = withExtra([a1, b1, a2, b2, a3])
    expect(ids(tasksUpTo(list, task('a2', [], [], 'a')))).toEqual(['a1', 'a2'])
    expect(ids(tasksUpTo(list, task('a3', [], [], 'a')))).toEqual(['a1', 'a2', 'a3'])
  })

  it('returns nothing for a task not in the list', () => {
    expect(tasksUpTo(withExtra([a1, b1, a2]), a4)).toEqual([])
  })
})
