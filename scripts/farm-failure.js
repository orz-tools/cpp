#!/usr/bin/env node
// Reads what 复制求解数据 copied when a farm plan failed (src/pkg/cpp-basic/farmFailure.ts), says what it holds and
// solves its model again with the javascript-lp-solver installed here.
//
//   node scripts/farm-failure.js [file] [--precision <p>] [--model <out.json>]
//
// Without a file it reads stdin. The text may sit anywhere in it, such as the body of a GitHub issue.
// --precision solves at another precision than the failed plan's; --model writes the model out as JSON.
import fs from 'node:fs'
import { createRequire } from 'node:module'
import { parseArgs } from 'node:util'
import Lpsolver from 'javascript-lp-solver'
import { decodeFarmFailure } from '../src/pkg/cpp-basic/farmFailure.ts'

const { values: args, positionals } = parseArgs({
  options: { precision: { type: 'string' }, model: { type: 'string' } },
  allowPositionals: true,
})
if (positionals.length > 1) {
  console.error('usage: node scripts/farm-failure.js [file] [--precision <p>] [--model <out.json>]')
  process.exit(1)
}

const failure = await decodeFarmFailure(fs.readFileSync(positionals[0] ?? 0, 'utf-8'))
const { model, data, outcome, previousResult } = failure

const show = (label, value) => console.log(`${label.padEnd(10)} ${value}`)
show('at', failure.at)
show('game', `${failure.game} ${failure.region ?? '-'}`)
show('build', failure.build ?? '-')
show('level', `${failure.level}, failed planning for ${failure.failed}`)
show('solver', `javascript-lp-solver ${failure.solver.version} at ${failure.solver.precision}`)
show('outcome', JSON.stringify(outcome))
show(
  'forbidden',
  `stages ${JSON.stringify(failure.forbiddenStageIds)}, formula tags ${JSON.stringify(failure.forbiddenFormulaTags)}`,
)
show('model', `${Object.keys(model.variables).length} variables, ${Object.keys(model.constraints).length} constraints`)
if (previousResult) show('previous', JSON.stringify(previousResult))
console.log('data')
for (const [name, version] of Object.entries(data)) console.log(`  ${name} ${version}`)

if (args.model) {
  fs.writeFileSync(args.model, JSON.stringify(model, null, 2) + '\n')
  console.log(`model written to ${args.model}`)
}

const { version } = createRequire(import.meta.url)('javascript-lp-solver/package.json')
const precision = args.precision === undefined ? failure.solver.precision : Number(args.precision)
const { feasible, bounded, result, ...solution } = Lpsolver.Solve(model, precision)
console.log(`solved again with javascript-lp-solver ${version} at ${precision}:`)
show('  outcome', JSON.stringify({ feasible, bounded, result }))
for (const [k, v] of Object.entries(solution).sort(([a], [b]) => a.localeCompare(b))) console.log(`  ${k} ${v}`)
