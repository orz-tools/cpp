import Lpsolver from 'javascript-lp-solver'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FarmPlanner } from './FarmPlanner'
import type { IGameAdapter } from './managers'
import type { ExpItem, Formula, IGame, IStageInfo } from './types'

function adapter(
  stages: Record<string, IStageInfo['varRow'] & { ap: number }>,
  formulas: Formula[] = [],
  expItems: Record<string, ExpItem> = {},
) {
  return {
    getStageInfos: () =>
      Object.fromEntries(Object.entries(stages).map(([id, varRow]) => [id, { id, ap: varRow.ap, varRow }])),
    getFormulas: () => formulas,
    getExpItems: () => expItems,
  } as unknown as IGameAdapter<IGame>
}

async function plan(
  ga: IGameAdapter<IGame>,
  requirements: Record<string, number>,
  quantities: Record<string, number>,
  previousResult?: Awaited<ReturnType<FarmPlanner<IGame>['run']>>,
) {
  const planner = await FarmPlanner.create(ga, { forbiddenFormulaTags: [], forbiddenStageIds: [] }, previousResult)
  planner.setRequirements(requirements)
  planner.setQuantity(quantities)
  return await planner.run()
}

describe('FarmPlanner', () => {
  beforeEach(() => {
    // run() logs the whole model and its MiniZinc translation
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('plans the cheapest stages for the requirements', async () => {
    const ga = adapter({
      a: { ap: 10, 'item:x': 1 },
      b: { ap: 10, 'item:x': 0.5 },
    })
    const result = await plan(ga, { x: 10 }, { x: 4 })
    expect(result.feasible).toBe(true)
    expect(result['battle:a']).toBeCloseTo(6)
    expect(result['battle:b']).toBeUndefined()
  })

  // The stage yielding 10000 EXP puts 1/10000 into the tableau, which a tolerance of 1e-4 took for zero
  it('plans when the EXP in stock exceeds what is needed', async () => {
    const ga = adapter(
      {
        exp: { ap: 30, 'item:##EXP': 10000 },
        s0: { ap: 10, 'item:##EXP': 200, 'item:a': 0.5 },
        s1: { ap: 15, 'item:a': 0.5, 'item:c': 0.1 },
      },
      [],
      { '##EXP': { value: { book: 1000 }, indirectStage: [] } },
    )
    const result = await plan(ga, { a: 100, c: 100 }, { book: 100 })
    expect(result.feasible).toBe(true)
    expect(result['battle:s1']).toBeCloseTo(1000)
    expect(result['battle:exp']).toBeUndefined()
    expect(result.result).toBeCloseTo(15000)
  })

  it('lists what nothing makes, at no AP', async () => {
    const ga = adapter({ a: { ap: 10, 'item:x': 1 } })
    const result = await plan(ga, { x: 3, token: 5 }, { token: 2 })
    expect(result.feasible).toBe(true)
    expect(result['unfeasible:item:token']).toBeCloseTo(3)
    expect(result['unfeasible:item:x']).toBeUndefined()
    expect(result.result).toBeCloseTo(30)
  })

  it('plans a level on the stages of another without taking an item from nowhere', async () => {
    const ga = adapter(
      {
        t1: { ap: 10, 'item:t1': 1 },
        t2: { ap: 10, 'item:t2': 1 },
      },
      [{ id: 'f', itemId: 't2', quantity: 1, costs: [{ itemId: 't1', quantity: 3 }], tags: [] } as unknown as Formula],
    )
    // Making t2 from farmed t1 costs 30 AP, so the first plan uses up the 4 t1 in stock on 4/3 syntheses and farms
    // none; the second may synthesize up to twice, which needs 2 t1 it cannot farm
    const first = await plan(ga, { t2: 10 }, { t1: 4 })
    expect(first['formula:f']).toBeCloseTo(4 / 3, 3)
    expect(first['battle:t1']).toBeUndefined()
    const second = await plan(ga, { t2: 10 }, { t1: 4 }, first)
    expect(second.feasible).toBe(true)
    expect(second['unfeasible:item:t1']).toBeUndefined()
    expect(second['formula:f']).toBeCloseTo(4 / 3, 3)
    expect(second['battle:t2']).toBeCloseTo(26 / 3, 3)
  })

  it('rounds away the noise of the solve', async () => {
    vi.spyOn(Lpsolver, 'Solve').mockReturnValue({
      feasible: true,
      bounded: true,
      result: 30.000000003,
      'battle:a': 3.000000001,
      'battle:b': 2e-9,
      'formula:f': 4.999999998,
    })
    const ga = adapter({ a: { ap: 10, 'item:x': 1 }, b: { ap: 10, 'item:x': 0.5 } })
    const result = await plan(ga, { x: 3 }, {})
    expect(result).toEqual({ feasible: true, bounded: true, result: 30, 'battle:a': 3, 'formula:f': 5 })
  })
})
