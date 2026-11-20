// scripts/farm-failure.js imports this file straight into Node, which only strips types: keep it to erasable syntax,
// with type-only imports and no relative ones.
import type { ConstraintBound, ConstraintRelation, Model, VariableCoefficients } from 'javascript-lp-solver'

/** What the farm plan's 复制求解数据 copies: the model the solver gave up on and what it was built from. */
export interface FarmFailure {
  /** When the plan failed, an ISO date */
  at: string
  game: string
  region?: string
  /** The commit the app was built from */
  build?: string
  solver: { version: string; precision: number }
  /** Data container → version id of the data the plan ran on */
  data: Record<string, string>
  /** The farm level, as stored (`FarmLevel`, such as goal_for_finished) */
  level: string
  /**
   * Whose requirements the plan that failed was for, as named by `Level`. A farm level that plans for one level within
   * the runs of another plans for the other first; when the second plan failed, previousResult is the first.
   */
  failed: string
  forbiddenStageIds: string[]
  forbiddenFormulaTags: string[]
  /** What the solver returned; error: it threw */
  outcome: { feasible: boolean; bounded?: boolean; result: number } | { error: string }
  previousResult?: Record<string, unknown>
  model: Model
}

const TYPE = '@orz/cpp/farm-failure'
const VERSION = 1
/** Starts the copied text; whatever surrounds it, such as the rest of a chat message, is left alone */
export const FARM_FAILURE_TOKEN = 'cpp-farm:'

/**
 * The model with each name written once and the coefficients that are small fractions written as "p/q". Drop rates are
 * counts over runs, and their 17 digits make up most of the text; written out in full, a whole stage list would not
 * fit the 65,536 characters a GitHub issue takes.
 */
interface PackedModel {
  names: string[]
  /** Per variable: its name, then each coefficient's constraint and value; a name is an index into names */
  variables: (number | string)[][]
  constraints: [name: number, bound: ConstraintBound | ConstraintRelation][]
  rest: Omit<Model, 'variables' | 'constraints'>
}

const MAX_DENOMINATOR = 1e9

/** "p/q" when p / q gives back exactly this number and is shorter to write, else undefined */
export function asFraction(x: number): string | undefined {
  if (!Number.isFinite(x) || Number.isInteger(x)) return undefined
  const plain = String(x)
  const v = Math.abs(x)
  // The convergents of its continued fraction. The arithmetic is inexact, which only costs a fraction now and then:
  // nothing is used unless the division gives back x.
  let [p0, q0, p1, q1] = [0, 1, 1, 0]
  let r = v
  for (let i = 0; i < 40; i++) {
    const a = Math.floor(r)
    const [p, q] = [a * p1 + p0, a * q1 + q0]
    if (q > MAX_DENOMINATOR || !Number.isSafeInteger(p)) return undefined
    if (p / q === v) {
      const s = `${x < 0 ? '-' : ''}${p}/${q}`
      // Two quotes around it in JSON
      return s.length + 2 < plain.length ? s : undefined
    }
    ;[p0, q0, p1, q1] = [p1, q1, p, q]
    if (r === a) return undefined
    r = 1 / (r - a)
  }
  return undefined
}

function fromFraction(s: string): number {
  const slash = s.indexOf('/')
  const p = Number(s.slice(0, slash))
  const q = Number(s.slice(slash + 1))
  if (slash < 0 || !Number.isSafeInteger(p) || !Number.isSafeInteger(q) || q <= 0) {
    throw new Error(`bad coefficient: ${s}`)
  }
  return p / q
}

export function packModel(model: Model): PackedModel {
  const names: string[] = []
  const index = new Map<string, number>()
  const nameOf = (s: string) => {
    let i = index.get(s)
    if (i === undefined) {
      i = names.length
      names.push(s)
      index.set(s, i)
    }
    return i
  }
  const { variables, constraints, ...rest } = model
  return {
    names,
    variables: Object.entries(variables).map(([name, coefficients]) => {
      const row: (number | string)[] = [nameOf(name)]
      for (const [k, c] of Object.entries(coefficients)) row.push(nameOf(k), asFraction(c) ?? c)
      return row
    }),
    constraints: Object.entries(constraints).map(([name, bound]) => [nameOf(name), bound]),
    rest,
  }
}

export function unpackModel(packed: PackedModel): Model {
  const { names, variables, constraints, rest } = packed
  const nameAt = (i: number | string) => {
    if (typeof i !== 'number' || names[i] === undefined) throw new Error(`bad name index: ${i}`)
    return names[i]
  }
  const model: Model = { ...rest, constraints: {}, variables: {} }
  for (const [name, bound] of constraints) model.constraints[nameAt(name)] = bound
  for (const [name, ...cells] of variables) {
    const coefficients: VariableCoefficients = {}
    for (let i = 0; i < cells.length; i += 2) {
      const c = cells[i + 1]
      coefficients[nameAt(cells[i])] = typeof c === 'string' ? fromFraction(c) : c
    }
    model.variables[nameAt(name)] = coefficients
  }
  return model
}

export async function encodeFarmFailure(failure: FarmFailure): Promise<string> {
  const json = JSON.stringify({ '@type': TYPE, '@version': VERSION, ...failure, model: packModel(failure.model) })
  const bytes = new TextEncoder().encode(json)
  // Browsers that predate CompressionStream get the JSON as it is; decodeFarmFailure tells them apart
  const body =
    typeof CompressionStream === 'function'
      ? new Uint8Array(
          await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer(),
        )
      : bytes
  return FARM_FAILURE_TOKEN + toBase64(body)
}

/** Reads the text encodeFarmFailure wrote, wherever it sits in what was pasted */
export async function decodeFarmFailure(text: string): Promise<FarmFailure> {
  const at = text.indexOf(FARM_FAILURE_TOKEN)
  if (at < 0) throw new Error(`no ${FARM_FAILURE_TOKEN} in the text`)
  // It is written as one line, but a mail or chat may have wrapped it, and a word on the line after it reads as base64
  // too: the lines run on as far as they can, and come off from the end until what is left reads.
  const lines = /^[A-Za-z0-9+/=\s]*/.exec(text.slice(at + FARM_FAILURE_TOKEN.length))![0].split(/\s+/)
  let v: any
  let error: unknown
  for (let n = lines.length; n > 0 && v === undefined; n--) {
    try {
      v = await readPayload(lines.slice(0, n).join(''))
    } catch (e) {
      error = e
    }
  }
  if (v === undefined) throw error
  if (v?.['@type'] !== TYPE) throw new Error(`not a ${TYPE}`)
  if (v['@version'] !== VERSION) throw new Error(`${TYPE} version ${v['@version']} is not supported`)
  delete v['@type']
  delete v['@version']
  return { ...v, model: unpackModel(v.model) }
}

async function readPayload(base64: string): Promise<unknown> {
  let bytes = fromBase64(base64)
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
    bytes = new Uint8Array(
      await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer(),
    )
  }
  return JSON.parse(new TextDecoder().decode(bytes))
}

function toBase64(bytes: Uint8Array): string {
  let s = ''
  // String.fromCharCode takes its arguments on the stack
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

function fromBase64(s: string): Uint8Array<ArrayBuffer> {
  const binary = atob(s)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}
