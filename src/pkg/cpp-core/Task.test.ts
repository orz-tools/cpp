import { describe, expect, it } from 'vitest'
import { IGame, IGameAdapter, Task } from '../cpp-basic'
import { TaskStatus, generateTaskExtra } from './Task'

const ga = {
  getExpItems: () => ({}),
  getFormulas: () => [{ id: 'f', itemId: 'y', quantity: 1, costs: [{ itemId: 'z', quantity: 2 }], tags: [] }],
  getItem: () => ({ valueAsAp: 1 }),
  getUserDataAdapter: () => ({ isManuallyTask: () => false }),
} as unknown as IGameAdapter<IGame>

const task = (id: string, requires: Task<IGame>['requires']): Task<IGame> => ({
  id,
  charId: 'a',
  type: id,
  requires,
  depends: [],
})

describe('generateTaskExtra', () => {
  it('lets each task consume what the earlier ones left, without touching the inventory passed in', () => {
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
