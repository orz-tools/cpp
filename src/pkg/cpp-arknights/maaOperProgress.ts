import { z } from 'zod'
import type { Character } from './DataManager'
import { ArknightsCharacterStatus, Profession } from './types'

// MaaCore 的 OperProgressTask 只接受这五个键，多一个键或写 null 都会让整份计划被拒，所以不需要的字段一律省略
export interface MaaOperProgressPlan {
  role: string
  name: string
  elite?: number
  skill_level?: number
  skill_mastery?: [number, number, number]
}

export interface MaaOperProgressExport {
  plans: MaaOperProgressPlan[]
  // 有 MAA 执行不了的目标（模组、升到某一等级）的干员，可执行的部分仍在 plans 里
  partial: number
  // 整个没有导出的干员：尚未持有，或是 MAA 屏蔽的阿米娅
  excluded: number
  // 特殊干员的养成靠集成战略的任务，MAA 做不了，整个没有导出
  special: number
}

// MAA 的 OperatorRole 枚举名，GUI 用区分大小写的 Enum.TryParse 解析
const roles: Partial<Record<Profession, string>> = {
  [Profession.WARRIOR]: 'Warrior',
  [Profession.PIONEER]: 'Pioneer',
  [Profession.MEDIC]: 'Medic',
  [Profession.TANK]: 'Tank',
  [Profession.SNIPER]: 'Sniper',
  [Profession.CASTER]: 'Caster',
  [Profession.SUPPORT]: 'Support',
  [Profession.SPECIAL]: 'Special',
}

export type MaaOperProgressCharacter = Pick<Character, 'key' | 'hasPatches' | 'isSpecialOperator'> & {
  raw: Pick<Character['raw'], 'name' | 'profession'>
  skills: readonly Pick<Character['skills'][number], 'skillId' | 'rawCharId' | 'charSkillIndex'>[]
}

export function buildMaaOperProgressPlans(
  goalOrder: readonly string[],
  current: Record<string, ArknightsCharacterStatus | undefined>,
  goal: Record<string, ArknightsCharacterStatus | undefined>,
  getCharacter: (key: string) => MaaOperProgressCharacter | undefined,
): MaaOperProgressExport {
  const result: MaaOperProgressExport = { plans: [], partial: 0, excluded: 0, special: 0 }

  for (const key of goalOrder) {
    const g = goal[key]
    const character = getCharacter(key)
    if (!g || !character) continue
    if (character.isSpecialOperator) {
      result.special++
      continue
    }
    const c = current[key]

    const role = roles[character.raw.profession as Profession]
    // 只有阿米娅有升变形态，MAA 的「干员培养」把三个形态都屏蔽了
    if (!c || c.level === 0 || character.hasPatches || !role) {
      result.excluded++
      continue
    }

    const plan: MaaOperProgressPlan = { role, name: character.raw.name }

    if (g.elite > c.elite) plan.elite = g.elite
    if (g.skillLevel > c.skillLevel) plan.skill_level = g.skillLevel

    const mastery: [number, number, number] = [0, 0, 0]
    for (const skill of character.skills) {
      if (skill.rawCharId !== key || skill.charSkillIndex > 2) continue
      const to = g.skillMaster[skill.skillId] || 0
      if (to > (c.skillMaster[skill.skillId] || 0)) mastery[skill.charSkillIndex] = to
    }
    if (mastery.some((x) => x > 0)) plan.skill_mastery = mastery

    // MAA 精英化前先升满级，之后停在 1 级；不精英化时它不会单独升级
    const levelAfter = plan.elite ? 1 : c.level
    const modLeft = Object.entries(g.modLevel).some(([modId, to]) => to > (c.modLevel[modId] || 0))
    if (g.level > levelAfter || modLeft) result.partial++

    if (plan.elite || plan.skill_level || plan.skill_mastery) result.plans.push(plan)
  }

  return result
}

// 每名干员一行，粘进 MAA 之后仍然好读
export function formatMaaOperProgressPlans(plans: readonly MaaOperProgressPlan[]) {
  return `[\n${plans.map((x) => `  ${JSON.stringify(x)}`).join(',\n')}\n]`
}

// 只认 MAA 的这五个键：MAA「干员识别」的导出也是带 name、elite 的对象数组，靠多出来的键把两者分开
const MaaOperProgressPlanInput = z
  .object({
    role: z.string().optional(),
    name: z.string().min(1),
    // MAA 自己只接受 elite 1–2、skill_level 2–7；arkntools 导出的计划可能带 0 和 1，一并接受
    elite: z.number().int().min(0).max(2).optional(),
    skill_level: z.number().int().min(1).max(7).optional(),
    skill_mastery: z.array(z.number().int().min(0).max(3)).max(3).optional(),
  })
  .strict()
export type MaaOperProgressPlanInput = z.infer<typeof MaaOperProgressPlanInput>

export function parseMaaOperProgressPlans(input: string): MaaOperProgressPlanInput[] {
  return z.array(MaaOperProgressPlanInput).min(1).parse(JSON.parse(input))
}

export type MaaOperProgressImportCharacter = Pick<Character, 'key' | 'maxElite' | 'charIds'> & {
  raw: Pick<Character['raw'], 'name' | 'appellation' | 'profession'>
  rawLocal: Pick<Character['raw'], 'name'> | null
  skills: readonly (Pick<Character['skills'][number], 'skillId' | 'rawCharId' | 'charSkillIndex'> & {
    charSkill: { levelUpCostCond?: readonly unknown[] | null }
  })[]
  getPatchProfession(charId: string): string
}

export interface MaaOperProgressImportResult {
  // 认不出的名字：cpp 没有这名干员，或者名字是当前区服数据以外的语言
  unknown: string[]
  // 目标超出干员上限（精英化次数、不存在或不能专精的技能位），整条跳过
  invalid: string[]
  // 导入前在 cpp 里尚未持有、按计划所需的最低状态设为持有的干员
  inferred: string[]
}

// 计划只抬高 cpp 的目标，不降低；等级、模组等计划里没有的目标保留。新出现的干员按计划顺序排到计划末尾。
export function mergeMaaOperProgressPlans(
  characters: Iterable<MaaOperProgressImportCharacter>,
  data: {
    current: Record<string, ArknightsCharacterStatus>
    goal: Record<string, ArknightsCharacterStatus>
    goalOrder: string[]
  },
  empty: ArknightsCharacterStatus,
  plans: readonly MaaOperProgressPlanInput[],
): MaaOperProgressImportResult {
  const result: MaaOperProgressImportResult = { unknown: [], invalid: [], inferred: [] }

  const byName = new Map<string, MaaOperProgressImportCharacter[]>()
  for (const character of characters) {
    const names = [character.raw.name, character.rawLocal?.name, character.raw.appellation]
    for (const name of new Set(names.flatMap((x) => (x ? [normalizeName(x)] : [])))) {
      if (!byName.has(name)) byName.set(name, [])
      byName.get(name)!.push(character)
    }
  }

  for (const plan of plans) {
    const form = resolveForm(byName.get(normalizeName(plan.name)) || [], plan.role)
    if (!form) {
      result.unknown.push(plan.name)
      continue
    }
    const { character, rawCharId } = form
    const key = character.key

    const skillMaster: Record<string, number> = {}
    let badSlot = false
    ;(plan.skill_mastery || []).forEach((lv, i) => {
      if (lv === 0) return
      const skill = character.skills.find((x) => x.rawCharId === rawCharId && x.charSkillIndex === i)
      if (!skill?.charSkill.levelUpCostCond?.length) {
        badSlot = true
        return
      }
      skillMaster[skill.skillId] = lv
    })

    // 专精要求精二和技能 7 级，技能 5 级以上要求精一；计划没写这两项时按这些前提补上
    const masters = Object.keys(skillMaster).length > 0
    const skillLevel = Math.max(plan.skill_level ?? 1, masters ? 7 : 1)
    const impliedElite = masters ? 2 : skillLevel > 4 ? 1 : 0
    const elite = Math.max(plan.elite ?? 0, impliedElite)
    if (badSlot || elite > character.maxElite) {
      result.invalid.push(plan.name)
      continue
    }
    // 什么也不升的计划不能用来把尚未持有的干员设为持有
    if (elite === 0 && skillLevel === 1 && !masters) continue

    // 没写的维度视为已经在计划需要的位置：只写了专精的干员已是精二、技能 7 级
    if (!data.current[key] || data.current[key].level === 0) {
      result.inferred.push(key)
      const start = clone(empty)
      start.level = 1
      start.elite = plan.elite != null ? 0 : impliedElite
      start.skillLevel = plan.skill_level != null ? 1 : skillLevel
      data.current[key] = start
    }

    if (!data.goal[key]) data.goal[key] = clone(data.current[key])
    const g = data.goal[key]
    if (elite > g.elite) {
      g.elite = elite
      g.level = 1
    }
    g.skillLevel = Math.max(g.skillLevel, skillLevel)
    for (const [id, lv] of Object.entries(skillMaster)) {
      g.skillMaster[id] = Math.max(g.skillMaster[id] || 0, lv)
    }

    if (!data.goalOrder.includes(key)) data.goalOrder.push(key)
  }

  return result
}

function normalizeName(name: string) {
  return name.trim().toLowerCase()
}

const professionsByRole = new Map(Object.entries(roles).map(([profession, role]) => [role, profession]))

// 阿米娅的三个形态同名，靠 role 区分；role 认不出或对不上时，和 MAA 一样只按名字找
function resolveForm(candidates: readonly MaaOperProgressImportCharacter[], role: string | undefined) {
  const profession = role ? professionsByRole.get(role) : undefined
  if (profession) {
    const matched = candidates.flatMap((character) =>
      character.charIds
        .filter((rawCharId) => character.getPatchProfession(rawCharId) === profession)
        .map((rawCharId) => ({ character, rawCharId })),
    )
    if (matched.length === 1) return matched[0]
  }
  return candidates.length === 1 ? { character: candidates[0], rawCharId: candidates[0].key } : undefined
}

function clone(x: ArknightsCharacterStatus): ArknightsCharacterStatus {
  return JSON.parse(JSON.stringify(x))
}
