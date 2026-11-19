import type { CppData_ArknightsKengxxiaoDetailsZhCn } from '../cpp-data-schemas/arknights-kengxxiao-details-zh_CN'
import { DataContainerObject, IDataContainer, load as dccacheLoad } from '../dccache'
import type { ArknightsKengxxiaoDetailsObject } from './DataObjects'

// The four languages are generated from one schema, so their types are identical.
export type DetailsData = CppData_ArknightsKengxxiaoDetailsZhCn
export type SkillDetail = DetailsData['skills']['']
export type SkillLevelDetail = SkillDetail['levels'][0]
export type EquipDetail = DetailsData['equips']['']
export type EquipPhaseDetail = EquipDetail['phases'][0]
export type EquipPartDetail = EquipPhaseDetail['parts'][0]
export type TermDetail = DetailsData['terms']['']
export type Blackboard = SkillLevelDetail['bb']
export type BuildingBuffDetail = DetailsData['buildingBuffs']['']
export type BaseSkillEffect = NonNullable<BuildingBuffDetail['effects']>[0]
export type Leaf = Exclude<BaseSkillEffect, { k: 'if' }>
export type Cond = Extract<BaseSkillEffect, { k: 'if' }>['when']
export type Noun = Extract<Leaf, { k: 'res' }>['what']

/** Base skill texts and effects came with schema 2; an older copy has none. */
const BASE_SKILLS_SCHEMA = 2

/** The region's own language where it has one, and zh_CN to fall back on, as for skill names. */
export interface Details {
  local: DetailsData | null
  base: DetailsData
}

/** Index into SkillDetail.levels: skill levels 1–7 are 0–6, masteries 1–3 are 7–9. */
export function skillLevelIndex(skillLevel: number, mastery: number) {
  return mastery > 0 ? 6 + mastery : Math.max(skillLevel, 1) - 1
}

function pick<T>(local: Record<string, T> | undefined, base: Record<string, T>, key: string): T | null {
  if (local && Object.hasOwn(local, key)) return local[key]
  if (Object.hasOwn(base, key)) return base[key]
  return null
}

export function getSkillDetail(details: Details, skillId: string): SkillDetail | null {
  return pick(details.local?.skills, details.base.skills, skillId)
}

export function getEquipDetail(details: Details, equipId: string): EquipDetail | null {
  return pick(details.local?.equips, details.base.equips, equipId)
}

export function getTermDetail(details: Details, termId: string): TermDetail | null {
  return pick(details.local?.terms, details.base.terms, termId)
}

/** The region's text and effects together when it has the skill, otherwise zh_CN's: the two are never mixed. */
export function getBuildingBuffDetail(details: Details, buffId: string): BuildingBuffDetail | null {
  return pick(details.local?.buildingBuffs, details.base.buildingBuffs ?? {}, buffId)
}

/** The level's data, or null for a level the skill does not have (one without masteries has only 7). */
export function getSkillLevel(skill: SkillDetail, skillLevel: number, mastery: number) {
  const level = skill.levels[skillLevelIndex(skillLevel, mastery)]
  return level ? { level, text: skill.texts[level.text] ?? '' } : null
}

/**
 * Candidates differ by the potential they need: the highest one the potential reaches. Without a recorded potential,
 * the first.
 */
export function pickCandidate<T extends { potential: number }>(candidates: T[], potentialRank?: number): T | null {
  if (potentialRank == null) return candidates[0] ?? null
  let best: T | null = null
  for (const c of candidates) {
    if (c.potential <= potentialRank && (!best || c.potential >= best.potential)) best = c
  }
  return best
}

export type DetailsLoad = <T extends object>(
  obj: DataContainerObject<T>,
  refresh?: boolean,
) => Promise<IDataContainer<T>>

export interface DetailsTarget {
  obj: ArknightsKengxxiaoDetailsObject
  /** version.id of the game data in use, which the details container is built alongside */
  versionId: string
}

/**
 * Loads the details for one region and keeps the promise while the game data stays the same, so every panel opened in
 * a session shares one download. A failed load is forgotten, so that 重试 downloads again. When checking a lagging
 * copy for an update fails, the copy in hand is kept and not checked again in this session.
 */
export class DetailsLoader {
  private cached?: { key: string; promise: Promise<Details> }

  public constructor(private readonly load: DetailsLoad = (obj, refresh) => dccacheLoad(obj, refresh)) {}

  public get(base: DetailsTarget, local: DetailsTarget | null): Promise<Details> {
    const key = JSON.stringify([base.obj.name, base.versionId, local?.obj.name, local?.versionId])
    if (this.cached?.key === key) return this.cached.promise

    const promise = Promise.all([this.loadOne(base), local ? this.loadOne(local) : null]).then(([b, l]) => ({
      base: b,
      local: l,
    }))
    const entry = { key, promise }
    this.cached = entry
    promise.catch(() => {
      if (this.cached === entry) this.cached = undefined
    })
    return promise
  }

  private async loadOne({ obj, versionId }: DetailsTarget) {
    let container = await this.load(obj)
    // The stored copy predates the game data: ask the repo once. If the worker has not caught up yet either, the copy
    // in hand still covers everything but the newest skills and modules. A copy from before base skills is asked about
    // too, or it would stay until the next game update.
    if (container.version.id !== versionId || container.version.schema < BASE_SKILLS_SCHEMA) {
      try {
        container = await this.load(obj, true)
      } catch (e) {
        console.warn(`Failed to check ${obj.name} for an update; keeping the stored copy.`, e)
      }
    }
    return container.data
  }
}
