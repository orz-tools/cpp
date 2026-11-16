import { z } from 'zod'
import type { Character } from './DataManager'
import type { ArknightsCharacterStatus } from './types'

// MAA 小工具「仓库识别」的四种导出：明日方舟工具箱（id → 数量的对象）、企鹅物流刷图规划、CSV、Markdown。
// CSV 与 Markdown 是导出到文件的，用户打开文件复制内容粘贴进来也能认。
export function parseMAADepot(input: string): Record<string, number> {
  const json = tryParseJSON(input)
  if (json !== undefined) {
    const penguin = PenguinDepot.safeParse(json)
    if (penguin.success) {
      return Object.fromEntries(penguin.data.items.map((x) => [x.id, x.have]))
    }
    if (typeof json === 'object' && json && !Array.isArray(json)) {
      return Object.fromEntries(
        Object.entries(json).filter((x): x is [string, number] => typeof x[1] === 'number' && Number.isFinite(x[1])),
      )
    }
    throw new Error('Unrecognized MAA depot JSON')
  }

  const result: Record<string, number> = {}
  for (const line of input.split(/\r?\n/)) {
    const cells = line.includes('|')
      ? line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|')
      : parseCSVLine(line.trim())
    if (cells.length < 3) continue
    const id = cells[0].trim()
    const count = cells[cells.length - 1].trim()
    if (!id || !/^\d+$/.test(count)) continue
    result[id] = parseInt(count, 10)
  }
  if (Object.keys(result).length === 0) throw new Error('Unrecognized MAA depot export')
  return result
}

function tryParseJSON(input: string): unknown {
  const trimmed = input.trim()
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return undefined
  return JSON.parse(trimmed)
}

function parseCSVLine(line: string): string[] {
  const cells: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cell += '"'
        i++
      } else if (ch === '"') {
        quoted = false
      } else {
        cell += ch
      }
    } else if (ch === '"') {
      quoted = true
    } else if (ch === ',') {
      cells.push(cell)
      cell = ''
    } else {
      cell += ch
    }
  }
  cells.push(cell)
  return cells
}

const PenguinDepot = z.object({
  '@type': z.literal('@penguin-statistics/depot'),
  items: z.array(z.object({ id: z.string(), have: z.number().int().nonnegative() })),
})

const MAAOperBox = z.array(
  z.object({
    id: z.string(),
    name: z.string().nullish(),
    own: z.boolean(),
    elite: z.number().int().min(0).max(2),
    level: z.number().int().min(0),
    // 1-6，未拥有时为 0
    potential: z.number().int().min(0).max(6),
    // 以下三项只在数据来自一图流 OpenAPI 时存在
    mainSkillLevel: z.number().int().min(1).max(7).nullish(),
    skills: z.array(z.object({ id: z.string(), level: z.number().int().min(0).max(3) })).nullish(),
    equips: z
      .array(z.object({ id: z.string(), type: z.string().nullish(), level: z.number().int().min(0).max(3) }))
      .nullish(),
  }),
)
export type MAAOperBox = z.infer<typeof MAAOperBox>

export function parseMAAOperBox(input: string): MAAOperBox {
  return MAAOperBox.parse(JSON.parse(input))
}

export interface MAAOperBoxMergeResult {
  // 拥有但 cpp 不认识的干员（通常是游戏数据还没更新），已跳过
  unknown: string[]
  // 是否带有技能等级、专精、模组（一图流来源）；截图识别没有这些，cpp 保留原值
  hasDetails: boolean
}

interface CharacterLookup {
  getRealCharacterKey(charId: string): string
  getCharacter(key: string): Character | undefined
}

export function mergeMAAOperBox(
  ga: CharacterLookup,
  current: Record<string, ArknightsCharacterStatus>,
  empty: ArknightsCharacterStatus,
  opers: MAAOperBox,
): MAAOperBoxMergeResult {
  const unknown: string[] = []
  const owned = new Set<string>()
  let hasDetails = false

  for (const oper of opers) {
    if (!oper.own) continue
    const key = ga.getRealCharacterKey(oper.id)
    const c = ga.getCharacter(key)
    if (!c) {
      unknown.push(oper.name || oper.id)
      continue
    }
    owned.add(key)
    if (!current[key]) current[key] = JSON.parse(JSON.stringify(empty))
    const o = current[key]
    o.elite = oper.elite
    o.level = oper.level
    o.potentialRank = Math.max(0, oper.potential - 1)

    if (oper.mainSkillLevel != null) {
      hasDetails = true
      o.skillLevel = oper.mainSkillLevel
    }

    if (oper.skills) {
      hasDetails = true
      for (const skill of c.skills) {
        if (skill.rawCharId !== oper.id) continue
        const lv = oper.skills.find((x) => x.id === skill.skillId)?.level || 0
        if (lv > 0) {
          o.skillMaster[skill.skillId] = lv
        } else {
          delete o.skillMaster[skill.skillId]
        }
      }
    }

    if (oper.equips) {
      hasDetails = true
      if (o.elite === 2 && o.level >= c.modUnlockLevel) {
        const uniEquips = c.uniEquips.filter(
          (x) => x.equip.raw.unlockEvolvePhase > 'PHASE_0' && x.rawCharId === oper.id,
        )
        for (const ue of uniEquips) {
          const typeName = ue.equip.raw.typeName2?.toUpperCase()
          // 一图流给的 id 未必是 uniequip_*，认不出 id 时按分支字母（X/Y/D/A）对位
          const d =
            oper.equips.find((x) => x.id === ue.equipId) ||
            (typeName ? oper.equips.find((x) => x.type?.toUpperCase() === typeName) : undefined)
          const level = d?.level || 0
          if (level > 0) {
            o.modLevel[ue.equipId] = level
          } else {
            delete o.modLevel[ue.equipId]
          }
        }
      }
    }
  }

  for (const oper of opers) {
    if (oper.own) continue
    const key = ga.getRealCharacterKey(oper.id)
    // 升变干员的各形态共用一条记录，任一形态拥有就算拥有
    if (owned.has(key)) continue
    delete current[key]
  }

  return { unknown, hasDetails }
}
