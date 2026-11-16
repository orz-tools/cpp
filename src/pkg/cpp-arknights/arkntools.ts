import { z } from 'zod'
import type { ArknightsCharacterStatus } from './types'

// arkntools「精英材料计算」的「导出 → 备份」与「导入 → 恢复」用的文本：dataForSave 的 JSON 经 js-base64 编码（UTF-8、标准字母表）。
// presets 每项是一名干员的一个形态，各维度是 [是否勾选, 起点, 终点]；专精的起点终点按技能等级记，7 是未专精，10 是专三。

const Range = z.tuple([z.boolean(), z.coerce.number(), z.coerce.number()])

const ArkntoolsPreset = z.object({
  // 去掉 char_ 前缀的干员 id，阿米娅的升变形态各有一项
  name: z.string(),
  setting: z.object({
    evolve: z.array(z.boolean()).default([]),
    skills: z
      .object({
        normal: Range.default([false, 1, 7]),
        elite: z.array(Range).default([]),
      })
      .default({}),
    // 早期备份的模组只有一个布尔值，arkntools 读到时当作 [勾选, 0, 3]
    uniequip: z
      .record(z.string(), z.union([Range, z.boolean()]))
      .default({})
      .transform((x) =>
        Object.fromEntries(
          Object.entries(x).map(([id, v]) => [id, typeof v === 'boolean' ? ([v, 0, 3] as const) : v] as const),
        ),
      ),
    focus: z.boolean().optional(),
  }),
})

const Count = z.union([z.number(), z.string()]).transform((x) => {
  const n = typeof x === 'number' ? x : parseInt(x, 10)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
})

const ArkntoolsBackup = z.object({
  // 物品 id → [需求, 已有]；更早的备份是 { need, have } 字符串
  inputs: z
    .record(
      z.string(),
      z.union([
        z.tuple([Count, Count]),
        z.object({ need: Count.optional(), have: Count.optional() }).transform((x) => [x.need ?? 0, x.have ?? 0]),
      ]),
    )
    .optional(),
  presets: z.array(ArkntoolsPreset).optional(),
  // 关卡代号（1-7、GT-5），不是关卡 id
  planStageBlacklist: z.array(z.string()).optional(),
})

export type ArkntoolsBackup = z.output<typeof ArkntoolsBackup>
export type ArkntoolsPreset = z.output<typeof ArkntoolsPreset>
type ArkntoolsRange = [boolean, number, number]

// arkntools 只认识它物品表里的材料；恢复时遇到表外的 id 会直接报错中断，所以导出只写这些类别
export function isArkntoolsItem(itemId: string) {
  return /^(3[01]\d{3}|32001|32[1-8][1-3]|330[1-3]|4006|mod_unlock_token|mod_update_token_[12])$/.test(itemId)
}

export function decodeArkntoolsBackup(input: string): ArkntoolsBackup {
  const text = input.trim()
  // 也接受解码后的 JSON，便于用户贴进来自己改过的内容
  const json = text.startsWith('{') ? text : decodeBase64Utf8(text)
  return ArkntoolsBackup.parse(JSON.parse(json))
}

export function encodeArkntoolsBackup(backup: ArkntoolsBackup): string {
  const bytes = new TextEncoder().encode(JSON.stringify(backup))
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(binary)
}

function decodeBase64Utf8(text: string) {
  const normalized = text.replace(/\s+/g, '').replaceAll('-', '+').replaceAll('_', '/')
  const binary = atob(normalized)
  return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)))
}

export interface ArkntoolsCharacter {
  key: string
  rarity: number
  modUnlockLevel: number
  skills: readonly {
    skillId: string
    rawCharId: string
    charSkill: { levelUpCostCond?: readonly unknown[] | null }
  }[]
  uniEquips: readonly { equipId: string; rawCharId: string; equip: { raw: { unlockEvolvePhase: string } } }[]
}

export interface ArkntoolsCharacterLookup {
  getRealCharacterKey(charId: string): string
  getCharacter(key: string): ArkntoolsCharacter | undefined
}

// arkntools 专精列表里的第 i 项：该形态里有专精的技能，按游戏顺序
function masterableSkills(character: ArkntoolsCharacter, rawCharId: string) {
  return character.skills.filter((x) => x.rawCharId === rawCharId && (x.charSkill.levelUpCostCond?.length || 0) > 0)
}

// 只有 X/Y 等分支模组；初始模组（PHASE_0 解锁）arkntools 不列
function upgradableUniEquips(character: ArkntoolsCharacter, rawCharId: string) {
  return character.uniEquips.filter((x) => x.rawCharId === rawCharId && x.equip.raw.unlockEvolvePhase > 'PHASE_0')
}

export interface ArkntoolsImportResult {
  // cpp 不认识的干员（presets 里的 name），已跳过
  unknown: string[]
  // 导入前在 cpp 里尚未持有、按计划起点推断了当前状态的干员
  inferred: string[]
}

// 把备份并入 cpp 的数据：已有物品按备份覆盖（arkntools 跟踪、但备份里没有的物品记为 0），
// 计划里勾选的目标抬高 cpp 的目标，不降低已有目标。需求数量由 cpp 自己从目标算出，不导入。
export function mergeArkntoolsBackup(
  ga: ArkntoolsCharacterLookup,
  data: {
    current: Record<string, ArknightsCharacterStatus>
    goal: Record<string, ArknightsCharacterStatus>
    items: Record<string, number>
  },
  empty: ArknightsCharacterStatus,
  backup: ArkntoolsBackup,
  isKnownItem: (itemId: string) => boolean,
): ArkntoolsImportResult {
  const result: ArkntoolsImportResult = { unknown: [], inferred: [] }

  if (backup.inputs) {
    for (const key of Object.keys(data.items)) {
      if (isArkntoolsItem(key) && !(key in backup.inputs)) delete data.items[key]
    }
    for (const [key, [, have]] of Object.entries(backup.inputs)) {
      if (isKnownItem(key)) data.items[key] = have
    }
  }

  const grouped = new Map<string, { character: ArkntoolsCharacter; plans: PresetPlan[] }>()
  for (const preset of backup.presets || []) {
    const rawCharId = `char_${preset.name}`
    const key = ga.getRealCharacterKey(rawCharId)
    const character = ga.getCharacter(key)
    if (!character) {
      result.unknown.push(preset.name)
      continue
    }
    if (!grouped.has(key)) grouped.set(key, { character, plans: [] })
    grouped.get(key)!.plans.push(readPreset(character, rawCharId, preset))
  }

  for (const [key, { character, plans }] of grouped) {
    if (!data.current[key] || data.current[key].level === 0) {
      result.inferred.push(key)
      const start = clone(empty)
      raise(start, combineStarts(plans), character)
      data.current[key] = start
    }
    if (!data.goal[key]) data.goal[key] = clone(data.current[key])
    for (const plan of plans) raise(data.goal[key], plan.to, character)
  }

  return result
}

interface PlanPoint {
  elite: number
  skillLevel: number
  skillMaster: Record<string, number>
  modLevel: Record<string, number>
}

interface PresetPlan {
  from: PlanPoint
  to: PlanPoint
  // 起点的精英化、技能等级是勾选给出的，而不是推断的
  eliteGiven: boolean
  skillLevelGiven: boolean
}

// 一个 preset 描述的起点和终点。没勾选的维度视为已经在计划需要的位置：
// 只勾了专精或模组的干员已是精二，只勾了技能 5 级以上的已是精一。
function readPreset(character: ArkntoolsCharacter, rawCharId: string, preset: ArkntoolsPreset): PresetPlan {
  const { evolve, skills, uniequip } = preset.setting
  const from: PlanPoint = { elite: 0, skillLevel: 1, skillMaster: {}, modLevel: {} }
  const to: PlanPoint = { elite: 0, skillLevel: 1, skillMaster: {}, modLevel: {} }

  masterableSkills(character, rawCharId).forEach((skill, i) => {
    const range = skills.elite[i]
    if (!range) return
    const [checked, a, b] = range
    if (!checked || b <= a) return
    from.skillMaster[skill.skillId] = a - 7
    to.skillMaster[skill.skillId] = b - 7
  })
  for (const ue of upgradableUniEquips(character, rawCharId)) {
    const range = uniequip[ue.equipId]
    if (!range) continue
    const [checked, a, b] = range
    if (!checked || b <= a) continue
    from.modLevel[ue.equipId] = a
    to.modLevel[ue.equipId] = b
  }

  const [normalChecked, normalFrom, normalTo] = skills.normal
  const skillLevelGiven = normalChecked && normalTo > normalFrom
  const needsElite2 = Object.keys(to.skillMaster).length > 0 || Object.keys(to.modLevel).length > 0
  if (skillLevelGiven) {
    from.skillLevel = normalFrom
    to.skillLevel = normalTo
  } else if (Object.keys(to.skillMaster).length > 0) {
    from.skillLevel = to.skillLevel = 7
  }

  const eliteGiven = !!(evolve[0] || evolve[1])
  const impliedElite = needsElite2 ? 2 : to.skillLevel > 4 ? 1 : 0
  from.elite = evolve[0] ? 0 : evolve[1] ? 1 : Math.max(impliedElite, from.skillLevel > 4 ? 1 : 0)
  to.elite = Math.max(evolve[1] ? 2 : evolve[0] ? 1 : 0, impliedElite, from.elite)

  return { from, to, eliteGiven, skillLevelGiven }
}

// 阿米娅的各形态共用精英化和技能等级：勾选给出的起点优先于其他形态推断出的起点
function combineStarts(plans: readonly PresetPlan[]): PlanPoint {
  const pick = (given: number[], implied: number[]) => (given.length > 0 ? Math.min(...given) : Math.max(...implied))
  return {
    elite: pick(
      plans.filter((x) => x.eliteGiven).map((x) => x.from.elite),
      plans.map((x) => x.from.elite),
    ),
    skillLevel: pick(
      plans.filter((x) => x.skillLevelGiven).map((x) => x.from.skillLevel),
      plans.map((x) => x.from.skillLevel),
    ),
    skillMaster: Object.assign({}, ...plans.map((x) => x.from.skillMaster)),
    modLevel: Object.assign({}, ...plans.map((x) => x.from.modLevel)),
  }
}

// 只往上抬，保持 cpp 的约束：精英化提升后等级回到 1；专精要求技能 7 级，模组要求精二且到解锁等级
function raise(status: ArknightsCharacterStatus, point: PlanPoint, character: ArkntoolsCharacter) {
  if (status.level === 0) status.level = 1
  if (point.elite > status.elite) {
    status.elite = point.elite
    status.level = 1
  }
  status.skillLevel = Math.max(status.skillLevel, point.skillLevel)
  for (const [id, lv] of Object.entries(point.skillMaster)) {
    status.skillMaster[id] = Math.max(status.skillMaster[id] || 0, lv)
  }
  for (const [id, lv] of Object.entries(point.modLevel)) {
    status.modLevel[id] = Math.max(status.modLevel[id] || 0, lv)
  }
  if (Object.keys(point.modLevel).length > 0 && status.elite === 2) {
    status.level = Math.max(status.level, character.modUnlockLevel)
  }
}

function clone(x: ArknightsCharacterStatus): ArknightsCharacterStatus {
  return JSON.parse(JSON.stringify(x))
}

export interface ArkntoolsExport {
  backup: ArkntoolsBackup
  presets: number
  // 有 arkntools 不计算的目标（升级）的干员，其余部分仍在 presets 里
  partial: number
  // arkntools 没有养成数据的一、二星干员，整个没有导出
  excluded: number
}

export function buildArkntoolsBackup(
  data: {
    goalOrder: readonly string[]
    current: Record<string, ArknightsCharacterStatus | undefined>
    goal: Record<string, ArknightsCharacterStatus | undefined>
    items: Record<string, number>
  },
  empty: ArknightsCharacterStatus,
  getCharacter: (key: string) => (ArkntoolsCharacter & { charIds: readonly string[] }) | undefined,
  // 一名干员从 current 到 goal 的材料需求，arkntools 恢复时不重算，直接显示备份里的需求数
  getRequirements: (
    key: string,
    current: ArknightsCharacterStatus,
    goal: ArknightsCharacterStatus,
  ) => readonly { itemId: string; quantity: number }[],
  forbiddenStageCodes: readonly string[],
): ArkntoolsExport {
  const presets: ArkntoolsPreset[] = []
  const need: Record<string, number> = {}
  let partial = 0
  let excluded = 0

  for (const key of data.goalOrder) {
    const g = data.goal[key]
    const character = getCharacter(key)
    if (!g || !character) continue
    if (character.rarity < 2) {
      excluded++
      continue
    }
    const c = data.current[key] || empty

    for (const rawCharId of character.charIds) {
      const isBase = rawCharId === character.key
      const elite = masterableSkills(character, rawCharId).map((skill): ArkntoolsRange => {
        const a = c.skillMaster[skill.skillId] || 0
        const b = g.skillMaster[skill.skillId] || 0
        return b > a ? [true, a + 7, b + 7] : [false, 7, 10]
      })
      const uniequip: Record<string, ArkntoolsRange> = {}
      for (const ue of upgradableUniEquips(character, rawCharId)) {
        const a = c.modLevel[ue.equipId] || 0
        const b = g.modLevel[ue.equipId] || 0
        if (b > a) uniequip[ue.equipId] = [true, a, b]
      }
      const evolve = isBase ? [c.elite < 1 && g.elite >= 1, c.elite < 2 && g.elite >= 2] : [false, false]
      const normal: ArkntoolsRange =
        isBase && g.skillLevel > c.skillLevel ? [true, Math.max(1, c.skillLevel), g.skillLevel] : [false, 1, 7]

      if (!evolve.some((x) => x) && !normal[0] && !elite.some((x) => x[0]) && Object.keys(uniequip).length === 0) {
        continue
      }
      presets.push({
        name: rawCharId.replace(/^char_/, ''),
        setting: { evolve, skills: { normal, elite }, uniequip, focus: false },
      })
    }

    const levelAfter = g.elite > c.elite ? 1 : c.level
    if (g.level > levelAfter) partial++

    for (const { itemId, quantity } of getRequirements(key, c, g)) {
      if (isArkntoolsItem(itemId)) need[itemId] = (need[itemId] || 0) + quantity
    }
  }

  const inputs: Record<string, [number, number]> = {}
  for (const id of new Set([...Object.keys(need), ...Object.keys(data.items)])) {
    if (!isArkntoolsItem(id)) continue
    const n = need[id] || 0
    const h = Math.max(0, Math.floor(data.items[id] || 0))
    if (n + h > 0) inputs[id] = [n, h]
  }

  return {
    backup: { inputs, presets, planStageBlacklist: [...new Set(forbiddenStageCodes)] },
    presets: presets.length,
    partial,
    excluded,
  }
}

// arkntools 的排除关卡按游戏里的关卡代号记（不带「标准」「磨难」前缀）。
// 比较只看 cpp 认识的代号：备份里 cpp 没有的关卡，cpp 也无从排除，不算不同。
export function isArkntoolsStageBlacklistDifferent(
  codes: readonly string[],
  forbiddenStageIds: readonly string[],
  stageCodes: Record<string, string>,
) {
  const known = new Set(Object.values(stageCodes))
  const theirs = new Set(codes.filter((x) => known.has(x)))
  const ours = new Set(arkntoolsCodesFromStageIds(forbiddenStageIds, stageCodes))
  return theirs.size !== ours.size || [...theirs].some((x) => !ours.has(x))
}

export function arkntoolsCodesFromStageIds(ids: readonly string[], stageCodes: Record<string, string>) {
  return [...new Set(ids.flatMap((id) => (stageCodes[id] ? [stageCodes[id]] : [])))]
}
