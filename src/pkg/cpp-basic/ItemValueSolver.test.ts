import Lpsolver from 'javascript-lp-solver'
import type { Model, SolveResult } from 'javascript-lp-solver'
import { describe, expect, it } from 'vitest'
import { ItemValueInput, solveItemValues } from './ItemValueSolver'

function values(input: ItemValueInput) {
  const result = solveItemValues(input)
  if (result.status !== 'ok') throw new Error(result.reason)
  return result
}

function expectClose(actual: number | undefined, expected: number, rel = 1e-9) {
  expect(actual).toBeDefined()
  expect(Math.abs(actual! - expected)).toBeLessThanOrEqual(rel * Math.max(1, Math.abs(expected)))
}

const chain: ItemValueInput = {
  stages: [
    { id: 'S1', ap: 10, drops: { T1: 5 } },
    { id: 'SG', ap: 1, drops: { G: 1000 } },
    { id: 'S2', ap: 10, drops: { T2: 1 } },
  ],
  formulas: [{ id: 'f', itemId: 'T2', outputs: { T2: 1 }, costs: { T1: 3, G: 100 } }],
  demand: { T2: 10, G: 1000 },
}

const lmd: ItemValueInput = {
  stages: [
    { id: 'CE', ap: 36, drops: { G: 10000 } },
    { id: 'M', ap: 21, drops: { M: 1, G: 252 } },
  ],
  formulas: [],
  demand: { G: 5e7, M: 3000 },
}

describe('solveItemValues', () => {
  it('prices a single stage', () => {
    const r = values({ stages: [{ id: 'S', ap: 10, drops: { A: 2 } }], formulas: [], demand: { A: 5 } })
    expectClose(r.values.get('A'), 5)
  })

  it('prices a formula chain', () => {
    const r = values(chain)
    expectClose(r.values.get('T1'), 2)
    expectClose(r.values.get('G'), 0.001)
    expectClose(r.values.get('T2'), 6.1)
  })

  it('credits byproducts to the formula', () => {
    const r = values({
      ...chain,
      formulas: [{ id: 'f', itemId: 'T2', outputs: { T2: 1, T1: 0.1 }, costs: { T1: 3, G: 100 } }],
    })
    expectClose(r.values.get('T2'), 5.9)
  })

  it('leaves out products whose costs have no source', () => {
    const r = solveItemValues({
      stages: [{ id: 'S', ap: 10, drops: { A: 1 } }],
      formulas: [{ id: 'f', itemId: 'Y', outputs: { Y: 1 }, costs: { X: 1 } }],
      demand: { Y: 1 },
    })
    expect(r.status).toBe('ok')
    if (r.status === 'ok') expect(r.values.has('Y')).toBe(false)
  })

  it('ignores drops nobody needs', () => {
    const r = values({ stages: [{ id: 'S', ap: 10, drops: { A: 1, Junk: 0.001 } }], formulas: [], demand: { A: 1 } })
    expectClose(r.values.get('A'), 10)
    expect(r.values.has('Junk')).toBe(false)
  })

  it('agrees with the primal minimum', () => {
    const input: ItemValueInput = {
      stages: [
        { id: 'S1', ap: 6, drops: { A: 1, B: 1 } },
        { id: 'S2', ap: 4, drops: { A: 1 } },
      ],
      formulas: [],
      demand: { A: 3, B: 1 },
      demandFloor: 0,
    }
    const r = values(input)
    expectClose(r.values.get('A'), 4)
    expectClose(r.values.get('B'), 2)
    expectClose(3 * r.values.get('A')! + 1 * r.values.get('B')!, 14)

    const model: Model = {
      optimize: 'ap',
      opType: 'min',
      constraints: { A: { min: 3 }, B: { min: 1 } },
      variables: { S1: { ap: 6, A: 1, B: 1 }, S2: { ap: 4, A: 1 } },
    }
    const primal = Lpsolver.Solve(model) as SolveResult
    expectClose(primal.result, 14)
  })

  it('handles LMD-sized coefficients', () => {
    const r = values(lmd)
    expectClose(r.values.get('G'), 0.0036, 1e-6)
    expectClose(r.values.get('M'), 20.0928, 1e-6)
  })

  it('moves fixed values to the right-hand side', () => {
    const r = values({ ...lmd, fixed: { G: 0.0018 } })
    expect(r.values.has('G')).toBe(false)
    expectClose(r.values.get('M'), 21 - 252 * 0.0018)
  })

  it('drops stages whose fixed output already exceeds their sanity', () => {
    const r = values({
      stages: [
        { id: 'S1', ap: 10, drops: { A: 1, B: 1 } },
        { id: 'S2', ap: 10, drops: { B: 2 } },
      ],
      formulas: [],
      demand: { B: 1 },
      fixed: { A: 20 },
    })
    expect(r.droppedStages).toEqual(['S1'])
    expectClose(r.values.get('B'), 5)
  })

  it('leaves out formulas producing a fixed item', () => {
    const r = values({
      stages: [{ id: 'S', ap: 10, drops: { T1: 5 } }],
      formulas: [{ id: 'f', itemId: 'T2', outputs: { T2: 1 }, costs: { T1: 3 } }],
      demand: { T1: 1 },
      fixed: { T2: 9 },
    })
    expectClose(r.values.get('T1'), 2)
  })

  it('splits a shared stage when asked to', () => {
    const input: ItemValueInput = {
      stages: [{ id: 'S', ap: 10, drops: { A: 0.5, B: 0.5 } }],
      formulas: [],
      demand: { A: 100, B: 1 },
    }
    const vertex = values(input)
    expectClose(vertex.values.get('A'), 20)
    expectClose(vertex.values.get('B'), 0)

    const split = values({ ...input, equalPairs: [['A', 'B']] })
    expectClose(split.values.get('A'), 10)
    expectClose(split.values.get('B'), 10)
  })

  it('binds equality formulas', () => {
    const r = values({
      stages: [{ id: 'S', ap: 10, drops: { A: 0.5, B: 0.5 } }],
      formulas: [{ id: 'f', itemId: 'B', outputs: { B: 2 }, costs: { A: 3 }, equality: true }],
      demand: { A: 1, B: 100 },
    })
    expectClose(r.values.get('A'), 8)
    expectClose(r.values.get('B'), 12)
  })

  it('solves an empty input', () => {
    const r = values({ stages: [], formulas: [], demand: {} })
    expect(r.values.size).toBe(0)
  })
})
