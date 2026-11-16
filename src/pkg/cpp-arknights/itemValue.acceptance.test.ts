/// <reference types="node" />
import { readFileSync, writeFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  ByproductKind,
  ChipPair,
  DEFAULT_ITEM_VALUE_CONFIG,
  ItemValueConfig,
  ItemValueGameInputs,
  computeItemValuesFromInputs,
} from './itemValue'
import type { PenguinMatrixItem } from './sources/penguinTypes'

interface AcceptanceCase {
  name: string
  options: Record<string, any>
  values: Record<string, number | string | null>
  observed?: string
}

// 读文件而不 import：import 会让 tsc 为 1 MB 的 JSON 推导字面量类型
const fixture = (name: string) => JSON.parse(readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), 'utf8'))
const gameInputs: ItemValueGameInputs = fixture('arknights-game-inputs.zh_CN.json')
const acceptance: {
  capturedAt: string
  items: Record<string, { name: string; rarity: number }>
  inputs: { penguinMatrix: { body: { matrix: PenguinMatrixItem[] } } }
  cases: AcceptanceCase[]
} = fixture('yituliu-acceptance.json')
const matrix = acceptance.inputs.penguinMatrix.body.matrix
const now = Date.parse(acceptance.capturedAt)
const defaultCase = acceptance.cases.find((x) => x.name === 'default')!

// 相对误差容差，由用户在 tracker 上确认。方向一致率不断言：多数 case 只动一两个物品，其余物品的微小变化在两边符号随机
const TOLERANCE = { median: 0.01, p90: 0.03 }
// 用户把全新装置固定在低于其合成成本的价格，破损装置、装置随之落到 0；单列放宽
const TOLERANCE_OVERRIDES: Record<string, { median: number; p90: number }> = {
  'customItem-add:30063=30': { median: 0.01, p90: 0.06 },
}

const WORKSHOP_KINDS: Record<string, ByproductKind> = {
  eliteMaterialT1toT2: 'elite2',
  eliteMaterialT2toT3: 'elite3',
  eliteMaterialT3toT4: 'elite4',
  eliteMaterialT4toT5: 'elite5',
  skillSummary1to2: 'skill2',
  skillSummary2to3: 'skill3',
  baseMaterial: 'building',
  chip: 'chip',
  chipPack: 'chipPack',
}

// 货币与礼包类物品的定价不在本卡范围内：与 default 相同时忽略，不同时整个 case 不适用
const CURRENCY_OPTIONS = [
  'orundumPricingStrategy',
  'orundumValue',
  'originitePrimePricingStrategy',
  'originitePrimeCoefficient',
  'kernelHeadhuntingPermitPricingStrategy',
  'kernelHeadhuntingPermitCoefficient',
  'modUnlockTokenPricingStrategy',
  'modUnlockTokenValue',
  'recruitmentPermitPricingStrategy',
  'recruitmentPermitValue',
  'expeditedPlanPricingStrategy',
  'expeditedPlanValue',
  'furniturePartPricingStrategy',
  'furniturePartValue',
]

function sameOption(a: unknown, b: unknown) {
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b))
  return JSON.stringify(a) === JSON.stringify(b)
}

type Mapping = { config: ItemValueConfig } | { reason: string }

function mapCase(c: AcceptanceCase): Mapping {
  const o = c.options
  if (o.useActivityAverageStage || o.useActivityAverageStageAndUnlimitedItem) {
    return { reason: 'activity average pricing' }
  }
  if (c.name === 'recruitmentPermit:RECRUITMENT_PERMIT_PRICING_CUSTOM=10') return { reason: 'export was empty' }
  for (const key of CURRENCY_OPTIONS) {
    if (!sameOption(o[key], defaultCase.options[key])) return { reason: `currency option ${key}` }
  }

  const config: ItemValueConfig = structuredClone({ ...DEFAULT_ITEM_VALUE_CONFIG }) as ItemValueConfig
  config.excludedStageIds = (o.stageBlacklist as string[]).map((x) => x.replace(/_(perm|rep)$/, ''))
  config.lmdCoefficient = o.lmdCoefficient
  config.expCoefficient = o.expCoefficient
  config.fixedValues = Object.fromEntries(
    (o.customItem as { itemId: string; itemValue: number }[]).map((x) => [x.itemId, x.itemValue]),
  )

  for (const [key, kind] of Object.entries(WORKSHOP_KINDS)) {
    const s = o.workshopStrategy[key] as { strategy: string; byproductRateIncrease: number | null }
    if (key === 'baseMaterial' && sameOption(s, defaultCase.options.workshopStrategy[key])) {
      config.byproductBoost[kind] = 0
    } else if (s.strategy === 'WORKSHOP_STRATEGY_COMMON' && s.byproductRateIncrease != null) {
      config.byproductBoost[kind] = s.byproductRateIncrease
    } else {
      return { reason: `workshop strategy ${s.strategy}` }
    }
  }

  for (const [pair, preference] of Object.entries(o.chipPreference as Record<ChipPair, string>)) {
    config.chipConversion[pair as ChipPair] = preference === 'BALANCED' ? 'split' : (preference as any)
  }
  return { config }
}

const STRICT_ITEMS = new Set(['4001', '4002', '4003', '7003', ...Object.keys(gameInputs.expItems)])

function quantile(sorted: number[], q: number) {
  if (sorted.length === 0) return NaN
  return sorted[Math.min(sorted.length - 1, Math.floor(q * (sorted.length - 1) + 0.5))]
}

const finite = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)
const sign = (x: number, eps = 1e-6) => (Math.abs(x) <= eps ? 0 : Math.sign(x))

describe('item values against the yituliu acceptance data', () => {
  const ours = new Map<string, Map<string, number>>()
  const mapped = acceptance.cases.map((c) => ({ c, m: mapCase(c) }))
  const defaultConfig = mapCase(defaultCase)
  if (!('config' in defaultConfig)) throw new Error('default case does not map')
  const ourDefault = computeItemValuesFromInputs(gameInputs, matrix, now, defaultConfig.config)
  if (ourDefault.status !== 'ok') throw new Error(ourDefault.reason)

  for (const { c, m } of mapped) {
    if (!('config' in m)) continue
    it(`computes ${c.name}`, () => {
      const r = computeItemValuesFromInputs(gameInputs, matrix, now, m.config)
      expect(r.status).toBe('ok')
      if (r.status === 'ok') ours.set(c.name, r.values)
    })
  }

  it('matches the constant conversions exactly', () => {
    for (const { c, m } of mapped) {
      if (!('config' in m)) continue
      const values = ours.get(c.name)!
      const strict = new Set([...STRICT_ITEMS, ...Object.keys(m.config.fixedValues)])
      for (const itemId of strict) {
        const theirs = c.values[itemId]
        const mine = values.get(itemId)
        if (!finite(theirs) || !finite(mine)) continue
        const err = Math.abs(mine - theirs)
        expect(err < 1e-12 || err / Math.abs(theirs) < 1e-9, `${c.name} ${itemId}: ${mine} vs ${theirs}`).toBe(true)
      }
    }
  })

  it('stays within the confirmed tolerance for the other items', () => {
    const lines: string[] = ['# Item value deviation report', '']
    const skipped = mapped.filter((x) => !('config' in x.m))
    lines.push(`Cases: ${mapped.length}, mapped: ${mapped.length - skipped.length}, not applicable: ${skipped.length}`)
    const reasons = new Map<string, string[]>()
    for (const { c, m } of skipped) {
      const reason = (m as { reason: string }).reason
      reasons.set(reason, [...(reasons.get(reason) || []), c.name])
    }
    for (const [reason, names] of reasons) lines.push(`- ${reason}: ${names.length} (${names.join(', ')})`)
    lines.push('')
    lines.push('| case | n | median | P90 | max | direction | worst 5 |')
    lines.push('|---|---|---|---|---|---|---|')

    const summary: { name: string; median: number; p90: number }[] = []
    const onlyTheirs = new Set<string>()
    const onlyOurs = new Set<string>()
    for (const { c, m } of mapped) {
      if (!('config' in m)) continue
      const values = ours.get(c.name)!
      const strict = new Set([...STRICT_ITEMS, ...Object.keys(m.config.fixedValues)])
      const errors: [string, number][] = []
      let agree = 0
      let compared = 0
      for (const [itemId, theirs] of Object.entries(c.values)) {
        const mine = values.get(itemId)
        if (!finite(theirs) || !finite(mine)) {
          if (finite(theirs)) onlyTheirs.add(itemId)
          continue
        }
        if (strict.has(itemId) || theirs === 0) continue
        errors.push([itemId, Math.abs(mine - theirs) / Math.abs(theirs)])

        const theirDefault = defaultCase.values[itemId]
        const myDefault = ourDefault.values.get(itemId)
        if (finite(theirDefault) && finite(myDefault)) {
          compared++
          if (sign((mine - myDefault) / (myDefault || 1)) === sign((theirs - theirDefault) / (theirDefault || 1)))
            agree++
        }
      }
      for (const itemId of values.keys()) if (!finite(c.values[itemId])) onlyOurs.add(itemId)
      const sorted = errors.map((x) => x[1]).sort((a, b) => a - b)
      const worst = [...errors].sort((a, b) => b[1] - a[1]).slice(0, 5)
      const direction = compared ? agree / compared : NaN
      summary.push({ name: c.name, median: quantile(sorted, 0.5), p90: quantile(sorted, 0.9) })
      const pct = (x: number) => `${(x * 100).toFixed(1)}%`
      lines.push(
        `| ${c.name} | ${errors.length} | ${pct(quantile(sorted, 0.5))} | ${pct(quantile(sorted, 0.9))} | ${pct(
          sorted[sorted.length - 1],
        )} | ${pct(direction)} | ${worst
          .map(([id, e]) => `${acceptance.items[id]?.name || id} ${pct(e)}`)
          .join(', ')} |`,
      )
    }
    lines.push('')
    const name = (id: string) => `${id} ${acceptance.items[id]?.name || ''}`.trim()
    lines.push(`Only priced by yituliu: ${[...onlyTheirs].map(name).join(', ') || '-'}`)
    lines.push(`Only priced here: ${[...onlyOurs].map(name).join(', ') || '-'}`)

    const report = lines.join('\n')
    console.log(report)
    if (process.env.ITEM_VALUE_REPORT) writeFileSync(process.env.ITEM_VALUE_REPORT, report + '\n')

    for (const s of summary) {
      const tolerance = TOLERANCE_OVERRIDES[s.name] || TOLERANCE
      expect(s.median, `${s.name} median`).toBeLessThanOrEqual(tolerance.median)
      expect(s.p90, `${s.name} P90`).toBeLessThanOrEqual(tolerance.p90)
    }
  })
})
