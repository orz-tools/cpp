import { type UnlockAt, reached } from './baseSkills'
import type { ArknightsCharacterStatus, ArknightsCharacterTaskType, ArknightsKengxxiao } from './types'

type Raw = ArknightsKengxxiao['exSpecialOperators']

export interface SoMission {
  id: string
  /** 去掉共同开头后的展示文字 */
  text: string
  /** 区服的原文，没有时是国服的；悬停显示 */
  full: string
}

interface SoNodeBase {
  /** 档案里这一行的 key，也是框选目标的最后一段 */
  key: string
  mission: SoMission
  need: UnlockAt
}

export type SoNode =
  | (SoNodeBase & { kind: 'elite'; elite: number }) // key: elite<N>
  | (SoNodeBase & { kind: 'skill'; level: number }) // key: skill<L>
  | (SoNodeBase & { kind: 'mastery'; skillId: string; mastery: number }) // key: mastery:<skillId>:<M>
  | (SoNodeBase & { kind: 'mod'; equipId: string; level: number }) // key: mod:<equipId>:<L>

export interface SoMasterLevel {
  level: number
  /** null：随精英化自动解锁，阶段看 need.elite */
  mission: SoMission | null
  need: UnlockAt
}

export interface SoMaster {
  masterId: string
  /** masterId 末尾的数字，按它排 */
  number: number
  /** 区服的名字，没有时是国服的；都没有是 null */
  name: string | null
  levels: SoMasterLevel[]
}

export interface SpecialOperator {
  charId: string
  /** 「集成战略」 */
  mode: string
  /** 「沉沦者的黑流树海」 */
  topic: string
  elites: Extract<SoNode, { kind: 'elite' }>[]
  skillLevels: Extract<SoNode, { kind: 'skill' }>[]
  masteries: Extract<SoNode, { kind: 'mastery' }>[]
  modules: Extract<SoNode, { kind: 'mod' }>[]
  masters: SoMaster[]
  /** 已去掉 -1 */
  expMap: number[][]
}

export type SoState = 'done' | 'planned' | 'idle'

export interface SoExpRow {
  elite: number
  /** exp<P> */
  key: string
  from: number
  to: number
  /** 这一阶段的满级 */
  top: number
  /** from → to 的特勤经验 */
  exp: number
  /** 1 → top 的特勤经验 */
  total: number
  state: SoState
}

// DataManager 里也有一个，但从那里引用会成环
function phaseNumber(phase: string) {
  return Number(phase.replace('PHASE_', '')) || 0
}

function own<T>(record: Record<string, T> | undefined | null, key: string): T | undefined {
  return record && Object.hasOwn(record, key) ? record[key] : undefined
}

/** 没有这名干员的特勤数据（含 raw 为 undefined）时返回 undefined。skillIds 是干员技能 id 的次序 */
export function buildSpecialOperator(
  charId: string,
  skillIds: readonly string[],
  raw: Raw | undefined,
  local: Raw | undefined | null,
): SpecialOperator | undefined {
  const basic = own(raw?.operatorBasicData, charId)
  const detail = own(raw?.operatorDetailData, charId)
  if (!raw || !basic || !detail) return undefined

  const modeName = (data: Raw | undefined | null) => data?.modeData.find((m) => m.type === basic.targetType)?.typeName
  const mode = modeName(local) || modeName(raw) || basic.targetType
  const topic = own(local?.operatorBasicData, charId)?.targetTopicName || basic.targetTopicName

  const nodes = Object.values(detail.nodeUnlockData)
  const fullOf = (id: string) =>
    own(local?.nodeUnlockMissionData, id)?.description || own(raw.nodeUnlockMissionData, id)?.description || ''
  const ids = [...new Set(nodes.map((n) => n.unlockTaskId).filter((id): id is string => !!id && !!fullOf(id)))]
  const fulls = ids.map(fullOf)
  const texts = shortenMissionTexts(fulls, topic)
  const missions = new Map(ids.map((id, i): [string, SoMission] => [id, { id, text: texts[i], full: fulls[i] }]))

  const firstSkill = skillIds.find((id) => Object.values(detail.skillNodeData).some((n) => n.skillKey === id))
  const skillOrder = (id: string) => {
    const i = skillIds.indexOf(id)
    return i < 0 ? skillIds.length : i
  }

  const so: SpecialOperator = {
    charId,
    mode,
    topic,
    elites: [],
    skillLevels: [],
    masteries: [],
    modules: [],
    masters: [],
    expMap: detail.specialOperatorExpMap,
  }
  const masters = new Map<string, SoMaster>()

  for (const node of nodes) {
    const need = { elite: phaseNumber(node.unlockEvolvePhase), level: node.unlockLevel }
    const mission = node.unlockTaskId ? missions.get(node.unlockTaskId) : null
    // 数据里缺了原文的任务，连同它的节点一起不列
    if (mission === undefined) continue

    if (node.nodeType === 'MASTER') {
      const m = own(detail.masterNodeData, node.nodeId)
      if (!m) continue
      let master = masters.get(m.masterId)
      if (!master) {
        const name = own(local?.masterNames, m.masterId) || own(raw.masterNames, m.masterId) || null
        const number = Number(/(\d+)$/.exec(m.masterId)?.[1] ?? 0)
        masters.set(m.masterId, (master = { masterId: m.masterId, number, name, levels: [] }))
      }
      master.levels.push({ level: m.level, mission, need })
      continue
    }

    // 随精英化自动解锁的节点（1 级技能、初始模组）没有任务，不列
    if (!mission) continue
    if (node.nodeType === 'EVOLVE') {
      const e = own(detail.evolveNodeData, node.nodeId)
      if (!e) continue
      const elite = phaseNumber(e.toEvolvePhase)
      so.elites.push({ kind: 'elite', key: `elite${elite}`, elite, mission, need })
    } else if (node.nodeType === 'SKILL') {
      const s = own(detail.skillNodeData, node.nodeId)
      if (!s) continue
      if (s.skillSpLevel > 0) {
        so.masteries.push({
          kind: 'mastery',
          key: `mastery:${s.skillKey}:${s.skillSpLevel}`,
          skillId: s.skillKey,
          mastery: s.skillSpLevel,
          mission,
          need,
        })
      } else if (s.skillKey === firstSkill) {
        // 后面的技能同一级用同一条任务，只是前置练度高一些（二技能本身要精一才有）；
        // Closure++ 的技能等级是三个技能共用的一个数，所以按第一个技能算
        so.skillLevels.push({ kind: 'skill', key: `skill${s.skillLevel}`, level: s.skillLevel, mission, need })
      }
    } else if (node.nodeType === 'UNIEQUIP') {
      const u = own(detail.uniEquipNodeData, node.nodeId)
      if (!u) continue
      so.modules.push({
        kind: 'mod',
        key: `mod:${u.uniEquipId}:${u.equipLevel}`,
        equipId: u.uniEquipId,
        level: u.equipLevel,
        mission,
        need,
      })
    }
  }

  so.elites.sort((a, b) => a.elite - b.elite)
  so.skillLevels.sort((a, b) => a.level - b.level)
  so.masteries.sort((a, b) => skillOrder(a.skillId) - skillOrder(b.skillId) || a.mastery - b.mastery)
  so.modules.sort((a, b) => (a.equipId < b.equipId ? -1 : a.equipId > b.equipId ? 1 : a.level - b.level))
  so.masters = [...masters.values()].sort((a, b) => a.number - b.number)
  for (const master of so.masters) master.levels.sort((a, b) => a.level - b.level)
  return so
}

function commonPrefix(texts: readonly string[]) {
  let prefix = texts[0] ?? ''
  for (const t of texts) {
    let i = 0
    while (i < prefix.length && i < t.length && prefix[i] === t[i]) i++
    prefix = prefix.slice(0, i)
  }
  return prefix
}

/**
 * 任务原文都以同一段开头（「在集成战略：沉沦者的黑流树海的常规行动……」），任务列表又窄，整句放进去只看得到这段开头，
 * 所以去掉它。前缀要含主题名，才确定是这一段；去掉后哪条变空或以数字开头，说明前缀吃进了难度词
 * （「保密等级·」后面只剩「1及以上」），就都用原文。引号和尖括号不去：韩服、日服有的任务正以它们开头
 */
export function shortenMissionTexts(texts: readonly string[], topic: string): string[] {
  const prefix = commonPrefix(texts)
  if (!topic || !prefix.includes(topic)) return [...texts]
  const shortened = texts.map((t) => t.slice(prefix.length).replace(/^(?:中[，,]|で|[，,、\s])+/u, ''))
  if (shortened.some((t) => !t || /^\d/u.test(t))) return [...texts]
  return shortened
}

export function nodeForTask(so: SpecialOperator, type: ArknightsCharacterTaskType): SoNode | undefined {
  switch (type._) {
    case 'elite':
      return so.elites.find((n) => n.elite === type.elite)
    case 'skill':
      // 存下的 2、3、5、6 级不是节点，算进它上面那一档
      return so.skillLevels.find((n) => n.level >= type.to)
    case 'skillMaster':
      return so.masteries.find((n) => n.skillId === type.skillId && n.mastery === type.to)
    case 'mod':
      return so.modules.find((n) => n.equipId === type.modId && n.level === type.to)
    default:
      return undefined
  }
}

export function levelExp(so: SpecialOperator, elite: number, from: number, to: number): number {
  return (so.expMap[elite] ?? []).slice(from - 1, to - 1).reduce((a, b) => a + b, 0)
}

export function nodeUnlocked(node: SoNode, status: ArknightsCharacterStatus): boolean {
  switch (node.kind) {
    case 'elite':
      return status.elite >= node.elite
    case 'skill':
      return status.skillLevel >= node.level
    case 'mastery':
      return (status.skillMaster[node.skillId] ?? 0) >= node.mastery
    case 'mod':
      return (status.modLevel[node.equipId] ?? 0) >= node.level
  }
}

// 同 isAbsentCharacter
function owned(status: ArknightsCharacterStatus) {
  return status.level > 0
}

/** goal 是 goalCharacters 里的计划，没有计划时 undefined */
export function nodeState(
  node: SoNode,
  current: ArknightsCharacterStatus,
  goal: ArknightsCharacterStatus | undefined,
): SoState {
  if (owned(current) && nodeUnlocked(node, current)) return 'done'
  if (goal && nodeUnlocked(node, goal)) return 'planned'
  return 'idle'
}

/** 持有且现在的练度没到 need */
export function needUnmet(need: UnlockAt, current: ArknightsCharacterStatus): boolean {
  return owned(current) && !reached(current, need)
}

export function soProgress(so: SpecialOperator, current: ArknightsCharacterStatus): { done: number; total: number } {
  const nodes: SoNode[] = [...so.elites, ...so.skillLevels, ...so.masteries, ...so.modules]
  return {
    done: owned(current) ? nodes.filter((n) => nodeUnlocked(n, current)).length : 0,
    total: nodes.length,
  }
}

export function expRows(
  so: SpecialOperator,
  current: ArknightsCharacterStatus,
  goal: ArknightsCharacterStatus | undefined,
): SoExpRow[] {
  return so.expMap.map((exps, elite) => {
    const top = exps.length + 1
    const total = levelExp(so, elite, 1, top)
    const row = (state: SoState, from: number, to: number): SoExpRow => ({
      elite,
      key: `exp${elite}`,
      from,
      to,
      top,
      exp: levelExp(so, elite, from, to),
      total,
      state,
    })
    const has = owned(current)
    if (has && (current.elite > elite || (current.elite === elite && current.level >= top))) return row('done', 1, top)
    const start = has && current.elite === elite ? current.level : 1
    if (goal && goal.elite > elite) return row('planned', start, top)
    if (goal && goal.elite === elite && goal.level > start) return row('planned', start, goal.level)
    return row('idle', start, top)
  })
}
