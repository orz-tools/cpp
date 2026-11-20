import type { Model } from 'javascript-lp-solver'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  FARM_FAILURE_TOKEN,
  FarmFailure,
  asFraction,
  decodeFarmFailure,
  encodeFarmFailure,
  packModel,
  unpackModel,
} from './farmFailure'

function failureOf(model: Model): FarmFailure {
  return {
    at: '2026-11-20T00:00:00.000Z',
    game: 'arknights',
    region: 'zh_CN',
    build: 'abc',
    solver: { version: '1.0.3', precision: 1e-9 },
    data: { 'arknights-kengxxiao-zh_CN': 'v1' },
    level: 'goal_for_finished',
    failed: 'Goal',
    forbiddenStageIds: ['main_01-07'],
    forbiddenFormulaTags: [],
    outcome: { feasible: false, bounded: true, result: 0 },
    previousResult: { feasible: true, bounded: true, result: 30, 'battle:a': 3 },
    model,
  }
}

/** Every coefficient, compared bit for bit: the failures this carries can hang on the last digit */
function expectSameModel(actual: Model, expected: Model) {
  expect(Object.keys(actual.variables)).toEqual(Object.keys(expected.variables))
  for (const [name, coefficients] of Object.entries(expected.variables)) {
    expect(Object.keys(actual.variables[name])).toEqual(Object.keys(coefficients))
    for (const [k, c] of Object.entries(coefficients)) {
      expect(Object.is(actual.variables[name][k], c), `${name} ${k}: ${actual.variables[name][k]} for ${c}`).toBe(true)
    }
  }
  expect(actual.constraints).toEqual(expected.constraints)
  expect({ ...actual, variables: undefined, constraints: undefined }).toEqual({
    ...expected,
    variables: undefined,
    constraints: undefined,
  })
}

/** Drop rates like the stages': counts over runs, besides sums of them and plain integers */
function randomModel(seed: number): Model {
  let s = seed
  const random = () => ((s = (s * 1103515245 + 12345) % 2 ** 31) / 2 ** 31) as number
  const model: Model = {
    optimize: 'ap',
    opType: 'min',
    constraints: {},
    variables: {},
    ints: {},
    options: { timeout: 3000 },
  }
  for (let i = 0; i < 50; i++) {
    const row: Record<string, number> = { ap: 6 + Math.floor(random() * 30), [`battle:s${i}`]: 1 }
    for (let j = 0; j < 8; j++) {
      const times = 1 + Math.floor(random() * 10 ** (1 + Math.floor(random() * 7)))
      row[`item:${Math.floor(random() * 40)}`] = Math.floor(random() * times * 3) / times
    }
    row['item:##EXP'] = (row['item:0'] ?? 0) * 200 + (row['item:1'] ?? 0) * 400 + random()
    model.variables[`battle:s${i}`] = row
    model.constraints[`battle:s${i}`] = { min: 0, max: Math.ceil(random() * 100) }
  }
  model.variables['formula:f'] = { 'formula:f': 1, 'item:0': 1, 'item:1': -3 }
  for (let k = 0; k < 40; k++) model.constraints[`item:${k}`] = { min: Math.floor(random() * 200) - 50 }
  model.constraints['item:##EXP'] = { min: -654800.5 }
  return model
}

describe('asFraction', () => {
  it('writes a count over runs as one', () => {
    expect(asFraction(1234 / 56789)).toBe('1234/56789')
    expect(asFraction(-3 / 7)).toBe('-3/7')
    expect(asFraction(123456 / 999983)).toBe('123456/999983')
  })

  it('leaves what is no shorter, or no fraction, as it is', () => {
    expect(asFraction(0.5)).toBeUndefined()
    expect(asFraction(3)).toBeUndefined()
    expect(asFraction(0.1 + 0.2)).toBeUndefined()
    expect(asFraction(Number.NaN)).toBeUndefined()
  })
})

describe('farm failure text', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('packs a model and gives it back bit for bit', () => {
    for (const seed of [1, 2, 3]) {
      const model = randomModel(seed)
      const packed = packModel(model)
      expect(packed.variables.flat().some((c) => typeof c === 'string')).toBe(true)
      expectSameModel(unpackModel(JSON.parse(JSON.stringify(packed))), model)
    }
  })

  it('gives back what it encoded', async () => {
    const model = randomModel(4)
    const text = await encodeFarmFailure(failureOf(model))
    expect(text.startsWith(FARM_FAILURE_TOKEN)).toBe(true)
    expect(text).toMatch(/^[a-z-]+:[A-Za-z0-9+/=]+$/)
    const decoded = await decodeFarmFailure(text)
    expectSameModel(decoded.model, model)
    expect({ ...decoded, model: undefined }).toEqual({ ...failureOf(model), model: undefined })
  })

  it('reads it out of what it was pasted into', async () => {
    const model = randomModel(5)
    const text = await encodeFarmFailure(failureOf(model))
    const wrapped = text.replace(/(.{76})/g, '$1\n')
    for (const pasted of [
      `Planning failed:\n\n\`\`\`\n${text}\n\`\`\`\n`,
      `${text} thanks`,
      `${text}\nThanks for looking`,
      `${wrapped}\nThanks for looking`,
      `${wrapped}\r\n`,
    ]) {
      expectSameModel((await decodeFarmFailure(pasted)).model, model)
    }
  })

  it('writes the JSON as it is where the browser cannot compress', async () => {
    vi.stubGlobal('CompressionStream', undefined)
    const model = randomModel(6)
    const text = await encodeFarmFailure(failureOf(model))
    expect(atob(text.slice(FARM_FAILURE_TOKEN.length)).startsWith('{')).toBe(true)
    expectSameModel((await decodeFarmFailure(text)).model, model)
  })

  it('turns away anything else', async () => {
    await expect(decodeFarmFailure('nothing here')).rejects.toThrow(FARM_FAILURE_TOKEN)
    await expect(decodeFarmFailure(FARM_FAILURE_TOKEN + btoa('{"@type":"@orz/cpp/dump"}'))).rejects.toThrow(
      'not a @orz/cpp/farm-failure',
    )
    await expect(
      decodeFarmFailure(FARM_FAILURE_TOKEN + btoa('{"@type":"@orz/cpp/farm-failure","@version":2}')),
    ).rejects.toThrow('version 2')
    await expect(decodeFarmFailure(FARM_FAILURE_TOKEN + 'AAAA')).rejects.toThrow()
  })
})
