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

export type MaaOperProgressCharacter = Pick<Character, 'key' | 'hasPatches'> & {
  raw: Pick<Character['raw'], 'name' | 'profession'>
  skills: readonly Pick<Character['skills'][number], 'skillId' | 'rawCharId' | 'charSkillIndex'>[]
}

export function buildMaaOperProgressPlans(
  goalOrder: readonly string[],
  current: Record<string, ArknightsCharacterStatus | undefined>,
  goal: Record<string, ArknightsCharacterStatus | undefined>,
  getCharacter: (key: string) => MaaOperProgressCharacter | undefined,
): MaaOperProgressExport {
  const result: MaaOperProgressExport = { plans: [], partial: 0, excluded: 0 }

  for (const key of goalOrder) {
    const g = goal[key]
    const character = getCharacter(key)
    if (!g || !character) continue
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
