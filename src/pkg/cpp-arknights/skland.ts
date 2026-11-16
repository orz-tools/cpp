import { z } from 'zod'
import type { Character } from './DataManager'
import type { ArknightsCharacterStatus } from './types'

export const SklandData = z.object({
  chars: z.array(
    z.object({
      charId: z.string(),
      level: z.number().int().positive(),
      evolvePhase: z.number().int().min(0).max(2),
      potentialRank: z.number().int().min(0).max(5),
      mainSkillLvl: z.number().int().min(1).max(7),
      skills: z.array(
        z.object({
          id: z.string(),
          specializeLevel: z.number().int().min(0).max(3),
        }),
      ),
      equip: z.array(
        z.object({
          id: z.string(),
          level: z.number().int().min(1).max(3),
          locked: z.boolean().optional(),
        }),
      ),
      defaultEquipId: z.string(),
    }),
  ),
  cultivate: z
    .object({
      characters: z.array(
        z.object({
          id: z.string(),
          level: z.number().int().positive(),
          evolvePhase: z.number().int().min(0).max(2),
          mainSkillLevel: z.number().int().min(1).max(7),
          skills: z.array(
            z.object({
              id: z.string(),
              level: z.number().int().min(0).max(3),
            }),
          ),
          equips: z.array(
            z.object({
              id: z.string(),
              level: z.number().int().min(0).max(3),
            }),
          ),
          potentialRank: z.number().int().min(0).max(5),
        }),
      ),
      items: z.array(
        z.object({
          id: z.string(),
          count: z.string().regex(/^\d+$/),
        }),
      ),
    })
    .optional(),
  building: z
    .object({
      training: z
        .object({
          trainee: z
            .object({
              charId: z.string(),
              targetSkill: z.number().min(-1).max(2),
            })
            .nullable(),
          remainPoint: z.number(),
        })
        .nullable()
        .optional(),
    })
    .optional(),
})
export type SklandData = z.infer<typeof SklandData>

// 森空岛接口的原始响应把数据包在 data 里，用户复制整个响应也能认
export function parseSklandData(input: string): SklandData {
  let raw = JSON.parse(input)
  if (typeof raw === 'object' && typeof raw.data === 'object') {
    raw = raw.data
  }
  return SklandData.parse(raw)
}

export class SklandCharacterNotFoundError extends Error {
  public constructor(public readonly key: string) {
    super(`Character Not Found: ${key}`)
    this.name = 'SklandCharacterNotFoundError'
  }
}

export interface SklandLookup {
  getRealCharacterKey(charId: string): string
  getCharacter(key: string): Character | undefined
  getItem(key: string): unknown
}

export interface SklandMergeResult {
  // 有模组只报了 1 级而分不清开没开，这些模组已跳过
  ambiguousEquip: boolean
  // 训练室里是阿米娅，分不清升变形态，没有加专精
  trainingAmiya: boolean
  // 训练室数据读不懂：原始数据与异常，给用户转交开发者
  trainingError?: string
}

export function mergeSklandData(
  ga: SklandLookup,
  draft: { current: Record<string, ArknightsCharacterStatus>; items: Record<string, number> },
  empty: ArknightsCharacterStatus,
  data: SklandData,
): SklandMergeResult {
  const result: SklandMergeResult = { ambiguousEquip: false, trainingAmiya: false }

  if (data.cultivate?.characters) {
    const keys = new Set(Object.keys(draft.current))
    for (const char of data.cultivate.characters) {
      const key = ga.getRealCharacterKey(char.id)
      const c = ga.getCharacter(key)
      if (!c) {
        throw new SklandCharacterNotFoundError(key)
      }
      keys.delete(key)
      if (!draft.current[key]) draft.current[key] = JSON.parse(JSON.stringify(empty))
      const o = draft.current[key]
      o.elite = char.evolvePhase
      o.level = char.level
      o.skillLevel = char.mainSkillLevel
      o.potentialRank = char.potentialRank

      if (char.skills) {
        for (const skill of c.skills) {
          if (skill.rawCharId !== char.id) continue

          const key = skill.skillId
          const lv = char.skills.find((x) => x.id === key)?.level || 0
          if (lv > 0) {
            o.skillMaster[key] = lv
          } else {
            delete o.skillMaster[key]
          }
        }
      }

      if (o.elite === 2 && o.level >= c.modUnlockLevel && char.equips) {
        const uniEquips = c.uniEquips.filter(
          (x) => x.equip.raw.unlockEvolvePhase > 'PHASE_0' && x.rawCharId === char.id,
        )
        for (const ue of uniEquips) {
          const level = ((): number | undefined => {
            const d = char.equips.find((x) => x.id === ue.equipId)
            if (!d) {
              return 0
            }
            return d.level
          })()
          if (level === undefined) continue
          if (level === 0) {
            delete o.modLevel[ue.equipId]
          } else {
            o.modLevel[ue.equipId] = level
          }
        }
      }
    }
    for (const key of keys) {
      delete draft.current[key]
    }
  } else {
    const keys = new Set(Object.keys(draft.current))
    for (const char of data.chars) {
      const key = ga.getRealCharacterKey(char.charId)
      const c = ga.getCharacter(key)
      if (!c) {
        throw new SklandCharacterNotFoundError(key)
      }
      keys.delete(key)
      if (!draft.current[key]) draft.current[key] = JSON.parse(JSON.stringify(empty))
      const o = draft.current[key]
      o.elite = char.evolvePhase
      o.level = char.level
      o.skillLevel = char.mainSkillLvl
      o.potentialRank = char.potentialRank

      if (char.skills) {
        for (const skill of c.skills) {
          if (skill.rawCharId !== char.charId) continue

          const key = skill.skillId
          const lv = char.skills.find((x) => x.id === key)?.specializeLevel || 0
          if (lv > 0) {
            o.skillMaster[key] = lv
          } else {
            delete o.skillMaster[key]
          }
        }
      }

      if (o.elite === 2 && o.level >= c.modUnlockLevel && char.equip) {
        const uniEquips = c.uniEquips.filter(
          (x) => x.equip.raw.unlockEvolvePhase > 'PHASE_0' && x.rawCharId === char.charId,
        )
        for (const ue of uniEquips) {
          const level = ((): number | undefined => {
            const d = char.equip.find((x) => x.id === ue.equipId)
            if (!d) {
              return 0
            }
            if (d.level > 1 || d.level === 0) {
              return d.level
            }
            if (d.level === 1) {
              if ('locked' in d) {
                if (d.locked === false) return 0
                if (d.locked === true) return 1
              }
              if (char.defaultEquipId === ue.equipId) {
                return 1
              }
              result.ambiguousEquip = true
              // TODO: 开没开咱也不知道啊...
            }
            return undefined
          })()
          if (level === undefined) continue
          if (level === 0) {
            delete o.modLevel[ue.equipId]
          } else {
            o.modLevel[ue.equipId] = level
          }
        }
      }
    }
    for (const key of keys) {
      delete draft.current[key]
    }
  }

  if (data.cultivate?.items) {
    draft.items = Object.fromEntries(
      data.cultivate.items
        .map((x) => [x.id, parseInt(x.count, 10)] as const)
        .filter(([key, value]) => {
          return !!ga.getItem(key) && key[0] !== '#' && typeof value === 'number' && Number.isFinite(value)
        }),
    )
  }

  const training = data.building?.training
  if (training && training.trainee && training.trainee.targetSkill >= 0) {
    try {
      const charId = training.trainee.charId
      const skillIndex = training.trainee.targetSkill
      const targetCharacter = ga.getCharacter(ga.getRealCharacterKey(charId))
      if (!targetCharacter) throw new SklandCharacterNotFoundError(charId)
      if (targetCharacter.hasPatches) {
        result.trainingAmiya = true
      } else {
        const targetCharSkill = targetCharacter.skills.find(
          (x) => x.charSkillIndex === skillIndex && x.rawCharId === charId,
        )
        if (!targetCharSkill) throw new Error(`Skill Not Found: ${charId} ${skillIndex}`)

        const now = draft.current[targetCharacter.key].skillMaster[targetCharSkill.skillId] || 0
        if (now === 3) throw new Error('Skill already mastered to level 3')

        draft.current[targetCharacter.key].skillMaster[targetCharSkill.skillId] = now + 1
      }
    } catch (e) {
      console.error(e)
      result.trainingError = `${JSON.stringify(training)}\n${e?.toString()}`
    }
  }

  return result
}
