import { intBetween, z } from '../zod'
import type { Character } from './DataManager'
import { replaceSkins } from './skins'
import type { ArknightsCharacterStatus } from './types'

export const SklandData = z.object({
  chars: z.array(
    z.object({
      charId: z.string(),
      level: z.int().check(z.positive()),
      evolvePhase: intBetween(0, 2),
      potentialRank: intBetween(0, 5),
      mainSkillLvl: intBetween(1, 7),
      skills: z.array(
        z.object({
          id: z.string(),
          specializeLevel: intBetween(0, 3),
        }),
      ),
      equip: z.array(
        z.object({
          id: z.string(),
          level: intBetween(1, 3),
          locked: z.optional(z.boolean()),
        }),
      ),
      defaultEquipId: z.string(),
    }),
  ),
  cultivate: z.optional(
    z.object({
      characters: z.array(
        z.object({
          id: z.string(),
          level: z.int().check(z.positive()),
          evolvePhase: intBetween(0, 2),
          mainSkillLevel: intBetween(1, 7),
          skills: z.array(
            z.object({
              id: z.string(),
              level: intBetween(0, 3),
            }),
          ),
          equips: z.array(
            z.object({
              id: z.string(),
              level: intBetween(0, 3),
            }),
          ),
          potentialRank: intBetween(0, 5),
        }),
      ),
      items: z.array(
        z.object({
          id: z.string(),
          count: z.string().check(z.regex(/^\d+$/)),
        }),
      ),
    }),
  ),
  building: z.optional(
    z.object({
      training: z.optional(
        z.nullable(
          z.object({
            trainee: z.nullable(
              z.object({
                charId: z.string(),
                targetSkill: z.number().check(z.minimum(-1), z.maximum(2)),
              }),
            ),
            remainPoint: z.number(),
          }),
        ),
      ),
    }),
  ),
  // 这个账号的全部时装，ts 是获得时间（Unix 秒）
  skins: z.optional(z.array(z.object({ id: z.string(), ts: z.number() }))),
})
export type SklandData = z.infer<typeof SklandData>

// 「提取装置」只把这里列出的路径发给 cpp。skins 是已有的时装，换掉用户数据里的整份
export const SKLAND_SCOPES = ['chars', 'building.training', 'cultivate.characters', 'cultivate.items', 'skins']

export interface SklandInput {
  data: SklandData
  // 收到的数据本身，schema 以外的键都在，原样存成快照
  raw: Record<string, unknown>
}

export function toSklandInput(raw: unknown): SklandInput {
  return { data: SklandData.parse(raw), raw: raw as Record<string, unknown> }
}

// 森空岛接口的原始响应把数据包在 data 里，用户复制整个响应也能认
export function parseSklandData(input: string): SklandInput {
  let raw = JSON.parse(input)
  if (typeof raw === 'object' && typeof raw.data === 'object') {
    raw = raw.data
  }
  return toSklandInput(raw)
}

/** 每个档案存一份，在档案附加数据的 skland 键下 */
export interface SklandSnapshot {
  receivedAt: number
  // 这个档案最近一次见到的 UID。「提取装置」不送 UID，那时沿用上一份的，换了账号才认得出
  uid?: string
  data: Record<string, unknown>
}

export function sklandUid(raw: Record<string, unknown>): string | undefined {
  const status = raw.status
  if (!isObject(status)) return undefined
  return typeof status.uid === 'string' && status.uid ? status.uid : undefined
}

// 存储里的东西可能来自别的版本或被导入的 dump 改过，形状不对就当没有
export function readSklandSnapshot(stored: unknown): SklandSnapshot | undefined {
  if (!isObject(stored) || !isObject(stored.data)) return undefined
  return {
    receivedAt: typeof stored.receivedAt === 'number' ? stored.receivedAt : 0,
    ...(typeof stored.uid === 'string' && stored.uid ? { uid: stored.uid } : {}),
    data: stored.data,
  }
}

export function nextSklandSnapshot(
  previous: SklandSnapshot | undefined,
  raw: Record<string, unknown>,
  receivedAt: number,
): SklandSnapshot {
  const uid = sklandUid(raw) ?? previous?.uid
  return { receivedAt, ...(uid ? { uid } : {}), data: raw }
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
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
  draft: {
    current: Record<string, ArknightsCharacterStatus>
    items: Record<string, number>
    skins?: Record<string, number>
  },
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
              // locked: true 是未解锁（未精二干员的模组都是 true）。早期数据没有这个字段，未解锁的也报 1 级
              if (d.locked !== undefined) {
                return d.locked ? 0 : 1
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

  if (data.skins) replaceSkins(draft, data.skins)

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
