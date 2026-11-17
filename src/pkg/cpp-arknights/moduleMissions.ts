import { gt } from '../gt'
import { ArknightsCharacterStatus, DeployableProfession, Position, Profession, ProfessionNames } from './types'

export type MissionScope = 'plan' | 'open' | 'elite2' | 'owned' | 'all' | 'everything'

export const missionScopes: readonly MissionScope[] = ['plan', 'open', 'elite2', 'owned', 'all', 'everything']

export type EnemyLevel = 'NORMAL' | 'ELITE' | 'BOSS'

export interface MissionInput {
  id: string
  template: string
  paramList: readonly string[]
  stageId: string | null
  /** 游戏原文 */
  desc: string
  equipId: string
  /** 干员（基础形态） */
  charId: string
  /** 模组所属的形态，阿米娅的近卫、医疗是 char_1001_amiya2、char_1037_amiya3 */
  formId: string
  /** 形态的 */
  profession: Profession
  /** 形态的 */
  position: Position
  /** 1–6 */
  stars: number
}

export interface MissionWorld {
  enemyLevel(enemyId: string): EnemyLevel | undefined
}

/** 先锋、近卫、重装、狙击、术师、医疗、辅助、特种，和干员列表快捷过滤的顺序相同 */
export const deployableProfessions: readonly DeployableProfession[] = [
  Profession.PIONEER,
  Profession.WARRIOR,
  Profession.TANK,
  Profession.SNIPER,
  Profession.CASTER,
  Profession.MEDIC,
  Profession.SUPPORT,
  Profession.SPECIAL,
]

/** 一次至多编入的人数 */
const SQUAD_SIZE = 12

/** 绑定关卡的模板里，影响能不能一起做的那几种之外，现在数据里出现过的 */
const plainStageTemplates = new Set([
  'EquipmentCharKilledStage',
  'EquipmentDamageStage',
  'EquipmentDamageTypeStage',
  'EquipmentElementBurstStage',
  'EquipmentEventStageKill',
  'EquipmentEventStageMore',
  'EquipmentSkillCastStage',
  'EquipmentSquadNoAnyDead',
])

/** 不绑关卡的模板，现在数据里出现过的 */
const anyStageTemplates = new Set([
  'EquipmentBattleCharDamage',
  'EquipmentBattleCharKilled',
  'EquipmentCharKilled',
  'EquipmentDamageTotal',
  'EquipmentDamageTotalWithToken',
  'EquipmentDamageTypeTotal',
  'EquipmentDeployCharAndKillCnt',
  'EquipmentDeployCharOrder',
  'EquipmentDeployStage',
  'EquipmentDeployTotal',
  'EquipmentElementBurst',
  'EquipmentEventBattleMore',
  'EquipmentEventTotal',
  'EquipmentSkillCast',
  'EquipmentSkillCastBattle',
  'EquipmentSquadProStage',
  'EquipmentSquadStarStage',
])

// ---------------------------------------------------------------------------------------------------------------------
// 解析

/** 对这一次「其他人」的限制 */
export interface SquadRule {
  banned?: ReadonlySet<Profession>
  allowed?: ReadonlySet<Profession>
  position?: 'MELEE' | 'RANGED'
  stars?: number
  maxOthers?: number
}

export interface ParsedMission {
  mission: MissionInput
  /** 模板在已知清单里，参数格式也对得上 */
  known: boolean
  squad: SquadRule
  firstDeploy: boolean
  /** 要本人歼灭的首领 */
  bosses: string[]
  /** 要本人歼灭的非首领敌人 */
  enemies: string[]
}

const professionSet = new Set<string>(deployableProfessions)

/** `数量,值;数量,值`：值都要认得，数量取最大的那个，写进 squad；≥ 12（数据里是 13 和 999）表示不限 */
function parseCountedValues(param: string | undefined, valid: (v: string) => boolean, squad: SquadRule) {
  if (!param) return null
  const parts = param.split(';').map((x) => x.split(','))
  if (parts.some((p) => p.length !== 2 || !/^\d+$/.test(p[0]) || !valid(p[1]))) return null
  const max = Math.max(...parts.map((p) => Number(p[0])))
  if (max < SQUAD_SIZE) squad.maxOthers = max
  return [...new Set(parts.map((p) => p[1]))]
}

export function parseMission(m: MissionInput, world: MissionWorld): ParsedMission {
  const squad: SquadRule = {}
  const p = m.paramList
  let known = m.stageId == null ? anyStageTemplates.has(m.template) : true
  let firstDeploy = false

  switch (m.template) {
    case 'EquipmentSquadProEx': {
      const values = (p[3] ?? '').split(';')
      if (values.every((v) => professionSet.has(v))) squad.banned = new Set(values as Profession[])
      else known = false
      break
    }
    case 'EquipmentSquadPro': {
      const values = parseCountedValues(p[3], (v) => professionSet.has(v), squad)
      if (values) squad.allowed = new Set(values as Profession[])
      else known = false
      break
    }
    case 'EquipmentSquadPos': {
      const values = parseCountedValues(p[3], (v) => v === 'MELEE' || v === 'RANGED', squad)
      if (values?.length === 1) squad.position = values[0] as 'MELEE' | 'RANGED'
      else known = false
      break
    }
    case 'EquipmentSquadStar': {
      const values = parseCountedValues(p[3], (v) => /^[1-6]$/.test(v), squad)
      if (values?.length === 1) squad.stars = Number(values[0])
      else known = false
      break
    }
    case 'EquipmentSquadNum':
    case 'EquipmentStageDeployCntAndSpec':
      if (/^\d+$/.test(p[3] ?? '')) squad.maxOthers = Number(p[3])
      else known = false
      break
    case 'EquipmentDeployOneNoEvac':
      firstDeploy = true
      break
    // 下面三种不绑关卡，不参与分法，只用来检查顺带的任务这一次能不能推进
    case 'EquipmentDeployCharOrder':
      if (p[1] === '1') firstDeploy = true
      else known = false
      break
    case 'EquipmentSquadProStage': {
      const values = parseCountedValues(p[2], (v) => professionSet.has(v), squad)
      if (values) squad.allowed = new Set(values as Profession[])
      else known = false
      break
    }
    case 'EquipmentSquadStarStage': {
      const values = parseCountedValues(p[2], (v) => /^[1-6]$/.test(v), squad)
      if (values?.length === 1) squad.stars = Number(values[0])
      else known = false
      break
    }
    default:
      if (m.stageId != null && !plainStageTemplates.has(m.template)) known = false
  }

  const bosses: string[] = []
  const enemies: string[] = []
  // 伺夜那条把本人和召唤物各写一遍（`DEATHDETAIL,char,enemy;DEATHDETAIL,token,enemy`），所以去重
  for (const id of new Set(p.flatMap((x) => x.split(/[;,]/)).filter((x) => x.startsWith('enemy_')))) {
    ;(world.enemyLevel(id) === 'BOSS' ? bosses : enemies).push(id)
  }

  return { mission: m, known, squad, firstDeploy, bosses, enemies }
}

// ---------------------------------------------------------------------------------------------------------------------
// 能否一起做

export type SquadConflictRule = 'none' | 'banned' | 'allowed' | 'position' | 'stars'

export type Conflict =
  | { kind: 'unknown' }
  /** 同一名干员的不同形态 */
  | { kind: 'form' }
  /** by 的条件把 other 排除在外 */
  | { kind: 'squad'; rule: SquadConflictRule; by: ParsedMission; other: ParsedMission }
  | { kind: 'firstDeploy' }
  | { kind: 'boss'; enemyId: string }

function excludes(by: ParsedMission, other: ParsedMission): SquadConflictRule | null {
  const s = by.squad
  const o = other.mission
  if (s.maxOthers === 0) return 'none'
  if (s.banned?.has(o.profession)) return 'banned'
  if (s.allowed && !s.allowed.has(o.profession)) return 'allowed'
  if (s.position && o.position !== s.position && o.position !== 'ALL') return 'position'
  if (s.stars && o.stars !== s.stars) return 'stars'
  return null
}

/** 按规则的顺序，返回第一条不成立的；能一起做时返回 null。人数要看整个一次，见 fits */
export function conflict(a: ParsedMission, b: ParsedMission): Conflict | null {
  if (!a.known || !b.known) return { kind: 'unknown' }
  if (a.mission.charId === b.mission.charId) {
    // 同一个人的两个模组：一个人上场，两条一起推进
    return a.mission.formId === b.mission.formId ? null : { kind: 'form' }
  }
  const ab = excludes(a, b)
  if (ab) return { kind: 'squad', rule: ab, by: a, other: b }
  const ba = excludes(b, a)
  if (ba) return { kind: 'squad', rule: ba, by: b, other: a }
  if (a.firstDeploy && b.firstDeploy) return { kind: 'firstDeploy' }
  const boss = a.bosses.find((x) => b.bosses.includes(x))
  if (boss) return { kind: 'boss', enemyId: boss }
  return null
}

function countFits(missions: readonly ParsedMission[]) {
  const operators = new Set(missions.map((x) => x.mission.charId)).size
  if (operators > SQUAD_SIZE) return false
  return missions.every((x) => x.squad.maxOthers == null || operators - 1 <= x.squad.maxOthers)
}

export function fits(missions: readonly ParsedMission[]): boolean {
  for (let i = 0; i < missions.length; i++) {
    for (let j = i + 1; j < missions.length; j++) {
      if (conflict(missions[i], missions[j])) return false
    }
  }
  return countFits(missions)
}

/** 顺带的不限关卡任务这一次推进不了的原因 */
export type PiggybackConflict =
  | { kind: 'squad'; rule: SquadConflictRule; by: MissionInput; squad: SquadRule; other: MissionInput }
  /** 同一次里别人的关卡任务也要第一个部署 */
  | { kind: 'firstDeploy'; with: MissionInput }
  /** 同一次里别人的顺带任务也要第一个部署 */
  | { kind: 'firstDeployPiggyback'; with: MissionInput }

/** run 是这一次的关卡任务，piggies 是这一次所有顺带的任务；能推进时返回 null */
export function piggybackConflict(
  piggy: ParsedMission,
  run: readonly ParsedMission[],
  piggies: readonly ParsedMission[],
): PiggybackConflict | null {
  for (const s of run) {
    const c = conflict(piggy, s)
    if (c?.kind === 'squad') {
      return { kind: 'squad', rule: c.rule, by: c.by.mission, squad: c.by.squad, other: c.other.mission }
    }
    if (c?.kind === 'firstDeploy') return { kind: 'firstDeploy', with: s.mission }
  }
  if (piggy.known && piggy.firstDeploy) {
    const rival = piggies.find((q) => q.known && q.firstDeploy && q.mission.charId !== piggy.mission.charId)
    if (rival) return { kind: 'firstDeployPiggyback', with: rival.mission }
  }
  return null
}

// ---------------------------------------------------------------------------------------------------------------------
// 分法

/** 超过这么多条时，穷举的 3ⁿ 太慢，改用贪心 */
const EXHAUSTIVE_LIMIT = 16

/** 计划里的干员在前，按计划的顺序；其余按干员，再按任务 */
function fixedOrder(missions: readonly ParsedMission[], goalOrder: readonly string[]) {
  const rank = (charId: string) => {
    const i = goalOrder.indexOf(charId)
    return i < 0 ? Infinity : i
  }
  return [...missions].sort((a, b) => {
    const x = a.mission
    const y = b.mission
    return (
      rank(x.charId) - rank(y.charId) ||
      (x.charId < y.charId ? -1 : x.charId > y.charId ? 1 : 0) ||
      compareId(x.id, y.id)
    )
  })
}

function compareId(a: string, b: string) {
  return a < b ? -1 : a > b ? 1 : 0
}

function popcount(x: number) {
  let n = 0
  for (; x; x &= x - 1) n++
  return n
}

/** 一关的任务分成次数最少的几次；第 1 次条数最多，其次第 2 次，依此类推。结果和输入的顺序无关 */
export function partitionStage(missions: readonly ParsedMission[], goalOrder: readonly string[]): ParsedMission[][] {
  const sorted = fixedOrder(missions, goalOrder)
  const n = sorted.length
  if (n === 0) return []
  if (n > EXHAUSTIVE_LIMIT) {
    const runs: ParsedMission[][] = []
    for (const m of sorted) {
      const run = runs.find((r) => fits([...r, m]))
      if (run) run.push(m)
      else runs.push([m])
    }
    return runs
  }

  const conflicts = new Uint32Array(n)
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (conflict(sorted[i], sorted[j])) {
        conflicts[i] |= 1 << j
        conflicts[j] |= 1 << i
      }
    }
  }
  const charIndex = new Map<string, number>()
  const charBit = sorted.map((x) => {
    if (!charIndex.has(x.mission.charId)) charIndex.set(x.mission.charId, charIndex.size)
    return 1 << charIndex.get(x.mission.charId)!
  })

  // 先对每个子集判断能否同一次做：去掉最高位的子集能做、最高位和其余不冲突、人数够
  const size = 1 << n
  const ok = new Uint8Array(size)
  const operators = new Uint32Array(size)
  const maxOthers = new Uint8Array(size)
  ok[0] = 1
  maxOthers[0] = 255
  for (let mask = 1; mask < size; mask++) {
    const high = 31 - Math.clz32(mask)
    const rest = mask ^ (1 << high)
    if (!ok[rest] || conflicts[high] & rest) continue
    operators[mask] = operators[rest] | charBit[high]
    maxOthers[mask] = Math.min(maxOthers[rest], sorted[high].squad.maxOthers ?? 255)
    const k = popcount(operators[mask])
    ok[mask] = k <= SQUAD_SIZE && k - 1 <= maxOthers[mask] ? 1 : 0
  }

  // dp[mask]：mask 里的任务至少要几次。取含最低位的可行子集，每个分法只数一遍
  const dp = new Uint8Array(size).fill(255)
  dp[0] = 0
  for (let mask = 1; mask < size; mask++) {
    const low = mask & -mask
    const rest = mask ^ low
    for (let s = rest; ; s = (s - 1) & rest) {
      const run = s | low
      if (ok[run] && dp[mask ^ run] + 1 < dp[mask]) dp[mask] = dp[mask ^ run] + 1
      if (s === 0) break
    }
  }

  const runs: ParsedMission[][] = []
  for (let mask = size - 1; mask;) {
    let best = 0
    for (let s = mask; s; s = (s - 1) & mask) {
      if (!ok[s] || dp[mask ^ s] !== dp[mask] - 1) continue
      if (!best || isBetterRun(s, best)) best = s
    }
    runs.push(sorted.filter((_, i) => best & (1 << i)))
    mask ^= best
  }
  return runs
}

/** 条数多的更好；一样多时，成员在固定顺序里靠前的更好 */
function isBetterRun(s: number, t: number) {
  const ds = popcount(s)
  const dt = popcount(t)
  if (ds !== dt) return ds > dt
  const diff = s ^ t
  return (s & diff & -diff) !== 0
}

// ---------------------------------------------------------------------------------------------------------------------
// 为什么分开

export type SplitReason =
  | { kind: 'boss'; enemyId: string; missions: MissionInput[] }
  | { kind: 'squad'; rule: SquadConflictRule; by: MissionInput; squad: SquadRule; others: MissionInput[] }
  | { kind: 'form'; charId: string }
  | { kind: 'firstDeploy'; missions: MissionInput[] }
  | { kind: 'unknown'; missions: MissionInput[] }
  | { kind: 'count' }

/** 分在不同次的任务之间的冲突，按种类合并；解释的冲突多的在前，至多三条。只因为人数分开时是一条 count */
export function splitReasons(runs: readonly (readonly ParsedMission[])[]): SplitReason[] {
  if (runs.length < 2) return []
  const groups = new Map<string, { reason: SplitReason; pairs: number; order: number }>()
  const add = (key: string, make: () => SplitReason, extend?: (r: SplitReason) => void) => {
    let g = groups.get(key)
    if (!g) groups.set(key, (g = { reason: make(), pairs: 0, order: groups.size }))
    g.pairs++
    extend?.(g.reason)
  }
  const pushUnique = (list: MissionInput[], ...ms: MissionInput[]) => {
    for (const m of ms) if (!list.includes(m)) list.push(m)
  }

  for (let i = 0; i < runs.length; i++) {
    for (let j = i + 1; j < runs.length; j++) {
      for (const a of runs[i]) {
        for (const b of runs[j]) {
          const c = conflict(a, b)
          if (!c) continue
          switch (c.kind) {
            case 'boss':
              add(
                'boss:' + c.enemyId,
                () => ({ kind: 'boss', enemyId: c.enemyId, missions: [] }),
                (r) => pushUnique((r as { missions: MissionInput[] }).missions, a.mission, b.mission),
              )
              break
            case 'squad': {
              const value =
                c.rule === 'banned' || c.rule === 'allowed'
                  ? c.other.mission.profession
                  : c.rule === 'position'
                    ? c.other.mission.position
                    : c.rule === 'stars'
                      ? c.other.mission.stars
                      : ''
              add(
                `squad:${c.by.mission.id}:${c.rule}:${value}`,
                () => ({ kind: 'squad', rule: c.rule, by: c.by.mission, squad: c.by.squad, others: [] }),
                (r) => pushUnique((r as { others: MissionInput[] }).others, c.other.mission),
              )
              break
            }
            case 'form':
              add('form:' + a.mission.charId, () => ({ kind: 'form', charId: a.mission.charId }))
              break
            case 'firstDeploy':
              add(
                'firstDeploy',
                () => ({ kind: 'firstDeploy', missions: [] }),
                (r) => pushUnique((r as { missions: MissionInput[] }).missions, a.mission, b.mission),
              )
              break
            case 'unknown':
              add(
                'unknown',
                () => ({ kind: 'unknown', missions: [] }),
                (r) =>
                  pushUnique(
                    (r as { missions: MissionInput[] }).missions,
                    ...[a, b].filter((x) => !x.known).map((x) => x.mission),
                  ),
              )
              break
          }
        }
      }
    }
  }
  if (groups.size === 0) return [{ kind: 'count' }]
  return [...groups.values()]
    .sort((x, y) => y.pairs - x.pairs || x.order - y.order)
    .slice(0, 3)
    .map((x) => x.reason)
}

// ---------------------------------------------------------------------------------------------------------------------
// 还能编入几位、哪些职业

export interface Capacity {
  count: number
  professions: DeployableProfession[]
  position?: 'MELEE' | 'RANGED'
  stars?: number
}

export function capacity(run: readonly ParsedMission[]): Capacity {
  const k = new Set(run.map((x) => x.mission.charId)).size
  let count = SQUAD_SIZE - k
  let professions = [...deployableProfessions]
  const positions = new Set<'MELEE' | 'RANGED'>()
  const stars = new Set<number>()
  for (const { squad } of run) {
    if (squad.maxOthers != null) count = Math.min(count, squad.maxOthers - (k - 1))
    if (squad.banned) professions = professions.filter((p) => !squad.banned!.has(p))
    if (squad.allowed) professions = professions.filter((p) => squad.allowed!.has(p))
    if (squad.position) positions.add(squad.position)
    if (squad.stars) stars.add(squad.stars)
  }
  // 近战位、远程位都限定时，只剩两种都算的二十来名干员，和星级互相矛盾一样当作没有可选的
  if (professions.length === 0 || positions.size > 1 || stars.size > 1) count = 0
  const result: Capacity = { count: Math.max(0, count), professions }
  if (positions.size === 1) result.position = [...positions][0]
  if (stars.size === 1) result.stars = [...stars][0]
  return result
}

// ---------------------------------------------------------------------------------------------------------------------
// 面板的全部内容

export interface MissionModule {
  equipId: string
  charId: string
  stars: number
  /** 精二以后到这一级，模组任务才计数 */
  unlockLevel: number
  /** 按 uniEquipMissionSort 排好 */
  missions: MissionInput[]
}

export interface MissionStageInfo {
  id: string
  /** 数据里找不到这一关时是 stageId */
  code: string
  name: string
  apCost: number
  zoneName: string
}

/** 从游戏数据整理出来的、和用户数据无关的部分 */
export interface MissionCatalog {
  modules: readonly MissionModule[]
  world: MissionWorld
  stage(stageId: string): MissionStageInfo
  isOwned(charId: string, status: ArknightsCharacterStatus | undefined): boolean
}

export interface BoardInput {
  catalog: MissionCatalog
  current: Readonly<Record<string, ArknightsCharacterStatus>>
  goal: Readonly<Record<string, ArknightsCharacterStatus>>
  doneMissions: readonly string[]
  goalOrder: readonly string[]
  scope: MissionScope
  /** 空的时候不按星级筛 */
  rarities: readonly number[]
  /** 留在原处的任务：这一轮勾过或取消过，做没做完都照旧分组，直到整理 */
  held: ReadonlySet<string>
}

/** 引用不变，buildBoard 的缓存才认得 */
export const EMPTY_HELD: ReadonlySet<string> = new Set()

export type BlockReason = 'level' | 'absent'

export interface Ticket {
  /** 排序后的任务 id 用逗号连起来；选中状态用它认券 */
  key: string
  stageId: string
  /** 第几次，从 1 开始 */
  index: number
  /** 这一关要打几次 */
  total: number
  missions: MissionInput[]
  capacity: Capacity
  /** 这一关不止一次时 */
  reasons: SplitReason[]
  /** 几条都要歼灭的同一种非首领敌人 */
  sharedEnemies: string[]
  /** 有认不出条件的任务 */
  unknown: boolean
  blocked: { charId: string; reason: BlockReason }[]
  /** 这几名干员的不限关卡任务：没做完的，加上留在原处的 */
  piggyback: MissionInput[]
  /** 任务 id → 这一次推进不了的原因；能推进的不在里面 */
  piggybackConflicts: ReadonlyMap<string, PiggybackConflict>
  /** 任务都做完了。只有留在原处的券会这样，不算进次数和理智 */
  allDone: boolean
}

export interface BoardStats {
  /** 范围内的模组 */
  modules: number
  /** 券的张数，不算「用过的」和整张做完的 */
  runs: number
  ap: number
  /** 范围内模组的任务里做完的，两类都算 */
  done: number
  runsWithBlocked: number
  stageDone: number
  stageTotal: number
  anyStageDone: number
  anyStageTotal: number
}

export interface Board {
  tickets: Ticket[]
  used: Ticket[]
  /** 不限关卡的任务，按干员分组，每组没做完的和留在原处的在前 */
  anyStage: { charId: string; missions: MissionInput[] }[]
  /** 只在「计划内」：还不能做的任务 */
  blocked: { mission: MissionInput; reason: BlockReason }[]
  stats: BoardStats
  /** 范围内做完的任务，包括模组已解锁的 */
  done: ReadonlySet<string>
  /** 当前 ≥ 1 级的模组 */
  unlocked: ReadonlySet<string>
  /** 任务 id → 它所在的券（包括「用过的」） */
  ticketOf: ReadonlyMap<string, Ticket>
  parsed: ReadonlyMap<string, ParsedMission>
  /** 留在原处、已做完、整理时会收走的任务条数，包括顺带的 */
  stale: number
}

function inScope(
  scope: MissionScope,
  level: number,
  goalLevel: number,
  elite: number,
  owned: boolean,
  block: BlockReason | null,
) {
  if (scope === 'everything') return true
  if (level >= 1) return false
  switch (scope) {
    case 'plan':
      return goalLevel >= 1
    case 'open':
      return block == null
    case 'elite2':
      return owned && elite >= 2
    case 'owned':
      return owned
    case 'all':
      return true
  }
}

function stageGroup(stageId: string) {
  return stageId.startsWith('main_') ? 0 : stageId.startsWith('sub_') ? 1 : 2
}

export function compareStages(a: string, b: string) {
  return stageGroup(a) - stageGroup(b) || a.localeCompare(b, 'en', { numeric: true })
}

function compareTickets(a: Ticket, b: Ticket) {
  return (
    Number(a.blocked.length > 0) - Number(b.blocked.length > 0) ||
    b.missions.length - a.missions.length ||
    compareStages(a.stageId, b.stageId) ||
    a.index - b.index
  )
}

/**
 * 选中的券的 key 不在了时，接替它的那张：同一关里成员是原来的子集或超集的券，也就是勾掉或取消了其中一条；
 * 分法真变了时是 undefined
 */
export function successorTicket(tickets: readonly Ticket[], key: string): Ticket | undefined {
  const old = new Set(key.split(','))
  return tickets.find((t) => {
    const ids = t.missions.map((x) => x.id)
    const shared = ids.filter((x) => old.has(x)).length
    return shared > 0 && (shared === ids.length || shared === old.size)
  })
}

/** 这名干员还没解锁的模组（当前 modLevel < 1）的任务：已完成数和总数；没有这样的模组时是 null */
export function missionProgress(
  modules: readonly MissionModule[],
  current: ArknightsCharacterStatus | undefined,
  done: ReadonlySet<string>,
): { done: number; total: number } | null {
  const locked = modules.filter((m) => (current?.modLevel[m.equipId] ?? 0) < 1)
  if (locked.length === 0) return null
  const missions = locked.flatMap((m) => m.missions)
  return { done: missions.filter((x) => done.has(x.id)).length, total: missions.length }
}

/** 留两份：面板要的，和算「整理后还剩几次」时不带留在原处的那份，交替着算也不会互相挤掉 */
const recent: { input: BoardInput; board: Board }[] = []

/** 同样的输入（各项按引用比较）直接返回算过的结果，面板、大窗口、档案同时开着时只算一次 */
export function buildBoard(input: BoardInput): Board {
  const i = recent.findIndex((r) => (Object.keys(input) as (keyof BoardInput)[]).every((k) => r.input[k] === input[k]))
  const hit = i < 0 ? { input, board: computeBoard(input) } : recent.splice(i, 1)[0]
  recent.unshift(hit)
  recent.length = Math.min(recent.length, 2)
  return hit.board
}

function computeBoard({ catalog, current, goal, doneMissions, goalOrder, scope, rarities, held }: BoardInput): Board {
  const doneSet = new Set(doneMissions)
  const done = new Set<string>()
  const unlocked = new Set<string>()
  const parsed = new Map<string, ParsedMission>()
  const stats: BoardStats = {
    modules: 0,
    runs: 0,
    ap: 0,
    done: 0,
    runsWithBlocked: 0,
    stageDone: 0,
    stageTotal: 0,
    anyStageDone: 0,
    anyStageTotal: 0,
  }
  const byStage = new Map<string, ParsedMission[]>()
  const usedByStage = new Map<string, MissionInput[]>()
  const anyStageByChar = new Map<string, MissionInput[]>()
  const blocked: Board['blocked'] = []
  const blockOf = new Map<string, BlockReason>()

  for (const mod of catalog.modules) {
    if (rarities.length > 0 && !rarities.includes(mod.stars)) continue
    const cur = current[mod.charId] as ArknightsCharacterStatus | undefined
    const owned = catalog.isOwned(mod.charId, cur)
    const block: BlockReason | null = !owned
      ? 'absent'
      : (cur?.elite ?? 0) < 2 || (cur?.level ?? 0) < mod.unlockLevel
        ? 'level'
        : null
    const level = cur?.modLevel[mod.equipId] ?? 0
    const goalLevel = goal[mod.charId]?.modLevel[mod.equipId] ?? 0
    if (!inScope(scope, level, goalLevel, cur?.elite ?? 0, owned, block)) continue

    stats.modules++
    if (level >= 1) unlocked.add(mod.equipId)
    if (block) blockOf.set(mod.charId, block)
    for (const m of mod.missions) {
      const p = parseMission(m, catalog.world)
      parsed.set(m.id, p)
      const isDone = level >= 1 || doneSet.has(m.id)
      if (isDone) {
        done.add(m.id)
        stats.done++
      }
      if (m.stageId == null) {
        stats.anyStageTotal++
        if (isDone) stats.anyStageDone++
      } else {
        stats.stageTotal++
        if (isDone) stats.stageDone++
      }

      if (scope === 'plan' && block && !isDone) {
        blocked.push({ mission: m, reason: block })
      } else if (m.stageId == null) {
        let list = anyStageByChar.get(m.charId)
        if (!list) anyStageByChar.set(m.charId, (list = []))
        list.push(m)
      } else if (
        // 「计划内」里还不能做的任务没做完时不分组，所以勾了也不留：不给还不能做的干员凭空分出一张券
        (isDone && scope === 'plan' && block) ||
        (isDone && !held.has(m.id) && scope !== 'everything')
      ) {
        let list = usedByStage.get(m.stageId)
        if (!list) usedByStage.set(m.stageId, (list = []))
        list.push(m)
      } else {
        let list = byStage.get(m.stageId)
        if (!list) byStage.set(m.stageId, (list = []))
        list.push(p)
      }
    }
  }

  const tickets: Ticket[] = []
  const used: Ticket[] = []
  for (const [stageId, missions] of byStage) {
    const runs = partitionStage(missions, goalOrder)
    const reasons = splitReasons(runs)
    runs.forEach((run, i) => {
      const ms = run.map((x) => x.mission)
      const enemyCount = new Map<string, Set<string>>()
      for (const x of run) {
        for (const e of x.enemies) {
          let s = enemyCount.get(e)
          if (!s) enemyCount.set(e, (s = new Set()))
          s.add(x.mission.charId)
        }
      }
      const charIds = [...new Set(ms.map((x) => x.charId))]
      const piggyback = charIds.flatMap((charId) =>
        (anyStageByChar.get(charId) ?? []).filter((m) => !done.has(m.id) || held.has(m.id)),
      )
      const piggies = piggyback.map((m) => parsed.get(m.id)!)
      const piggybackConflicts = new Map<string, PiggybackConflict>()
      for (const pp of piggies) {
        const c = piggybackConflict(pp, run, piggies)
        if (c) piggybackConflicts.set(pp.mission.id, c)
      }
      const ticket: Ticket = {
        key: ms
          .map((x) => x.id)
          .sort()
          .join(','),
        stageId,
        index: i + 1,
        total: runs.length,
        missions: ms,
        capacity: capacity(run),
        reasons,
        sharedEnemies: [...enemyCount].filter(([, s]) => s.size > 1).map(([e]) => e),
        unknown: run.some((x) => !x.known),
        blocked: charIds.flatMap((charId) => {
          const reason = blockOf.get(charId)
          return reason ? [{ charId, reason }] : []
        }),
        piggyback,
        piggybackConflicts,
        allDone: ms.every((x) => done.has(x.id)),
      }
      if (scope === 'everything' && ticket.allDone && !ms.some((x) => held.has(x.id))) used.push(ticket)
      else tickets.push(ticket)
    })
  }
  for (const [stageId, missions] of usedByStage) {
    used.push({
      key: missions
        .map((x) => x.id)
        .sort()
        .join(','),
      stageId,
      index: 1,
      total: 1,
      missions,
      capacity: capacity([]),
      reasons: [],
      sharedEnemies: [],
      unknown: false,
      blocked: [],
      piggyback: [],
      piggybackConflicts: new Map(),
      allDone: true,
    })
  }
  tickets.sort(compareTickets)
  used.sort(compareTickets)

  const stale = new Set<string>()
  for (const t of tickets) {
    // 「所有任务」档本来就把做完的分进去，整理只会收走整张做完的券
    if (scope !== 'everything' || t.allDone) {
      for (const m of t.missions) if (done.has(m.id) && held.has(m.id)) stale.add(m.id)
    }
    for (const m of t.piggyback) if (done.has(m.id) && held.has(m.id)) stale.add(m.id)
    if (t.allDone) continue
    stats.runs++
    stats.ap += catalog.stage(t.stageId).apCost
    if (t.blocked.length > 0) stats.runsWithBlocked++
  }

  const ticketOf = new Map<string, Ticket>()
  for (const t of [...tickets, ...used]) for (const m of t.missions) ticketOf.set(m.id, t)

  const charRank = (charId: string) => {
    const i = goalOrder.indexOf(charId)
    return i < 0 ? Infinity : i
  }
  const byChar = (a: string, b: string) => charRank(a) - charRank(b) || compareId(a, b)
  const settled = (id: string) => Number(done.has(id) && !held.has(id))
  const anyStage = [...anyStageByChar]
    .sort(([a], [b]) => byChar(a, b))
    .map(([charId, missions]) => ({
      charId,
      missions: [...missions].sort((a, b) => settled(a.id) - settled(b.id)),
    }))
  blocked.sort((a, b) => byChar(a.mission.charId, b.mission.charId))

  return { tickets, used, anyStage, blocked, stats, done, unlocked, ticketOf, parsed, stale: stale.size }
}

// ---------------------------------------------------------------------------------------------------------------------
// 文字

export interface MissionNames {
  character(charId: string): string
  enemy(enemyId: string): string | undefined
  skill(skillId: string): string | undefined
}

function professionName(p: Profession) {
  return ProfessionNames[p as DeployableProfession]?.toString() ?? p
}

function positionName(p: Position) {
  return p === 'MELEE'
    ? gt.pgettext('module mission', '近战位')
    : p === 'RANGED'
      ? gt.pgettext('module mission', '远程位')
      : gt.pgettext('module mission', '近战位和远程位')
}

export function listJoin(items: readonly string[]) {
  return items.join(gt.pgettext('list separator', '、'))
}

function withLimit(text: string, maxOthers: number | undefined) {
  if (maxOthers == null) return text
  return gt
    .pgettext('module mission', '%1，至多 %2 名') /* I10N: %1: 其他人只能是…; %2: a number */
    .replace('%1', text)
    .replace('%2', String(maxOthers))
}

const isCount = (x: string | undefined) => /^\d+$/.test(x ?? '')

const quotePairs: Record<string, string> = { '“': '”', '"': '"', '「': '」' }

/** 有的技能名在数据里自带引号（`“大拉里”`），摘要还要再套一层「」 */
function skillName(names: MissionNames, skillId: string | undefined) {
  const name = names.skill(skillId ?? '')
  if (!name) return undefined
  const close = quotePairs[name[0]]
  return close && name.length > 2 && name.endsWith(close) ? name.slice(1, -1) : name
}

function withBattles(text: string, battles: string) {
  return gt
    .pgettext('module mission', '%1，共 %2 场') /* I10N: %1: 其他人只能是…; %2: a number */
    .replace('%1', text)
    .replace('%2', battles)
}

/** 面板和档案的第一行：由模板和参数生成；解析不出来时是游戏原文 */
export function missionSummary(parsed: ParsedMission, names: MissionNames): string {
  const { mission: m, squad } = parsed
  if (!parsed.known) return m.desc
  const p = m.paramList
  switch (m.template) {
    case 'EquipmentSquadProEx': {
      const banned = [...squad.banned!]
      const list = listJoin(banned.map(professionName))
      return banned.includes(m.profession)
        ? gt.pgettext('module mission', '不编入其他%s').replaceAll('%s', list)
        : gt.pgettext('module mission', '不编入%s').replaceAll('%s', list)
    }
    case 'EquipmentSquadPro':
      if (squad.maxOthers === 0) return gt.pgettext('module mission', '不编入其他人')
      return withLimit(
        gt
          .pgettext('module mission', '其他人只能是%s')
          .replaceAll('%s', listJoin([...squad.allowed!].map(professionName))),
        squad.maxOthers,
      )
    case 'EquipmentSquadPos':
      if (squad.maxOthers === 0) return gt.pgettext('module mission', '不编入其他人')
      return withLimit(
        gt.pgettext('module mission', '其他人只能是%s').replaceAll('%s', positionName(squad.position!)),
        squad.maxOthers,
      )
    case 'EquipmentSquadStar':
      if (squad.maxOthers === 0) return gt.pgettext('module mission', '不编入其他人')
      return withLimit(
        gt.pgettext('module mission', '其他人只能是 %d 星').replaceAll('%d', String(squad.stars)),
        squad.maxOthers,
      )
    case 'EquipmentSquadNum':
      return gt.pgettext('module mission', '其他人至多 %d 名').replaceAll('%d', String(squad.maxOthers))
    case 'EquipmentStageDeployCntAndSpec':
      return gt.pgettext('module mission', '其他人至多部署 %d 位').replaceAll('%d', String(squad.maxOthers))
    case 'EquipmentDeployOneNoEvac':
      return gt.pgettext('module mission', '第一个部署，全程不撤退')
    case 'EquipmentSquadNoAnyDead':
      return gt.pgettext('module mission', '所有干员不被击倒')
    case 'EquipmentEventStageMore': {
      const target = [...parsed.bosses, ...parsed.enemies]
      const enemy = target.length === 1 ? names.enemy(target[0]) : undefined
      if (!enemy || !/^\d+$/.test(p[4] ?? '')) return m.desc
      return p[4] === '1'
        ? gt.pgettext('module mission', '本人歼灭%s').replaceAll('%s', enemy)
        : gt
            .pgettext('module mission', '本人歼灭 %1 名%2') /* I10N: %1: a number; %2: enemy name */
            .replace('%1', p[4])
            .replace('%2', enemy)
    }
    case 'EquipmentEventStageKill': {
      const target = [...parsed.bosses, ...parsed.enemies]
      const enemies = target.map((x) => names.enemy(x))
      if (enemies.length === 0 || enemies.some((x) => !x) || !/^\d+$/.test(p[3] ?? '') || !/^\d+$/.test(p[5] ?? '')) {
        return m.desc
      }
      return (
        p[5] === '1'
          ? gt.pgettext('module mission', '本人歼灭 %1 名敌人，其中有%2') /* I10N: %1: a number; %2: enemy names */
          : gt.pgettext('module mission', '本人歼灭 %1 名敌人，其中 %3 名%2')
      ) /* I10N: %1, %3: numbers; %2: enemy names */
        .replace('%1', p[3])
        .replace('%2', listJoin(enemies as string[]))
        .replace('%3', p[5])
    }
    case 'EquipmentCharKilledStage':
      if (!/^\d+$/.test(p[3] ?? '')) return m.desc
      return gt.pgettext('module mission', '本人歼灭 %d 名敌人').replaceAll('%d', p[3])
    case 'EquipmentSkillCastStage': {
      const skill = skillName(names, p[2])
      if (!skill || !/^\d+$/.test(p[3] ?? '')) return m.desc
      return gt
        .pgettext('module mission', '使用 %1 次「%2」') /* I10N: %1: a number; %2: skill name */
        .replace('%1', p[3])
        .replace('%2', skill)
    }

    // 不限关卡：干员写在摘要上面，所以不再说「由非助战某某」
    case 'EquipmentSkillCast': {
      const skill = skillName(names, p[1])
      if (!skill || !isCount(p[2])) return m.desc
      return gt
        .pgettext('module mission', '累计释放 %1 次「%2」') /* I10N: %1: a number; %2: skill name */
        .replace('%1', p[2])
        .replace('%2', skill)
    }
    case 'EquipmentDamageTotal':
    case 'EquipmentDamageTotalWithToken':
      if (!isCount(p[1])) return m.desc
      return gt.pgettext('module mission', '累计造成 %d 点伤害').replaceAll('%d', p[1])
    case 'EquipmentCharKilled':
      if (!isCount(p[1])) return m.desc
      return gt.pgettext('module mission', '累计歼灭 %d 名敌人').replaceAll('%d', p[1])
    case 'EquipmentSkillCastBattle': {
      const skill = skillName(names, p[1])
      if (!skill || !isCount(p[0]) || !isCount(p[2])) return m.desc
      return gt
        .pgettext(
          'module mission',
          '每场至少释放 %1 次「%2」，共 %3 场',
        ) /* I10N: %1: casts per battle; %2: skill name; %3: battles */
        .replace('%1', p[2])
        .replace('%3', p[0])
        .replace('%2', skill)
    }
    case 'EquipmentBattleCharKilled':
      if (!isCount(p[0]) || !isCount(p[2])) return m.desc
      return gt
        .pgettext('module mission', '每场至少歼灭 %1 名敌人，共 %2 场') /* I10N: %1: kills per battle; %2: battles */
        .replace('%1', p[2])
        .replace('%2', p[0])
    case 'EquipmentBattleCharDamage':
      if (!isCount(p[0]) || !isCount(p[2])) return m.desc
      return gt
        .pgettext('module mission', '每场至少造成 %1 点伤害，共 %2 场') /* I10N: %1: damage per battle; %2: battles */
        .replace('%1', p[2])
        .replace('%2', p[0])
    case 'EquipmentDeployCharOrder':
      if (!isCount(p[0])) return m.desc
      return gt.pgettext('module mission', '每场第一个部署，共 %d 场').replaceAll('%d', p[0])
    case 'EquipmentDeployStage':
      // 部署召唤物的那几条，摘要里少了召唤物的名字，用原文
      if (!isCount(p[0]) || !isCount(p[1]) || !p[2]?.startsWith('char_')) return m.desc
      return gt
        .pgettext('module mission', '每场至少部署 %1 次，共 %2 场') /* I10N: %1: deployments per battle; %2: battles */
        .replace('%1', p[1])
        .replace('%2', p[0])
    case 'EquipmentDeployCharAndKillCnt':
      if (!isCount(p[0]) || !isCount(p[1]) || !isCount(p[4])) return m.desc
      return gt
        .pgettext(
          'module mission',
          '每场至少部署 %1 次、歼灭 %2 名敌人，共 %3 场',
        ) /* I10N: %1: deployments per battle; %2: kills per battle; %3: battles */
        .replace('%1', p[1])
        .replace('%2', p[4])
        .replace('%3', p[0])
    case 'EquipmentSquadProStage':
      if (!isCount(p[0])) return m.desc
      return withBattles(
        withLimit(
          gt
            .pgettext('module mission', '其他人只能是%s')
            .replaceAll('%s', listJoin([...squad.allowed!].map(professionName))),
          squad.maxOthers,
        ),
        p[0],
      )
    case 'EquipmentSquadStarStage':
      if (!isCount(p[0])) return m.desc
      return withBattles(
        withLimit(
          gt.pgettext('module mission', '其他人只能是 %d 星').replaceAll('%d', String(squad.stars)),
          squad.maxOthers,
        ),
        p[0],
      )
    default:
      return m.desc
  }
}

export function formatSplitReason(reason: SplitReason, names: MissionNames): string {
  const who = (ms: readonly MissionInput[]) => listJoin([...new Set(ms.map((x) => names.character(x.charId)))])
  switch (reason.kind) {
    case 'boss':
      return gt
        .pgettext('module mission', '%1都要本人歼灭%2') /* I10N: %1: operator names; %2: enemy name */
        .replace('%1', who(reason.missions))
        .replace('%2', names.enemy(reason.enemyId) ?? reason.enemyId)
    case 'squad':
      return squadReason(reason, names, who(reason.others))
    case 'form':
      return gt.pgettext('module mission', '%s一次只能带一种形态').replaceAll('%s', names.character(reason.charId))
    case 'firstDeploy':
      return gt.pgettext('module mission', '%s都要第一个部署').replaceAll('%s', who(reason.missions))
    case 'unknown':
      return gt.pgettext('module mission', '%s的任务条件我们还不认识').replaceAll('%s', who(reason.missions))
    case 'count':
      return gt.pgettext('module mission', '人数超过限制')
  }
}

function squadReason(reason: Extract<SplitReason, { kind: 'squad' }>, names: MissionNames, others: string) {
  const by = names.character(reason.by.charId)
  const other = reason.others[0]
  const onlyText = (only: string, is: string) =>
    gt
      .pgettext('module mission', '%1的其他人只能是%3，%2是%4') /* I10N: %1, %2: operators; %3, %4: 先锋 / 近战位 */
      .replace('%1', by)
      .replace('%2', others)
      .replace('%3', only)
      .replace('%4', is)
  switch (reason.rule) {
    case 'none':
      return gt.pgettext('module mission', '%s不编入其他人').replaceAll('%s', by)
    case 'banned':
      return (
        reason.by.profession === other.profession
          ? gt.pgettext('module mission', '%1不编入其他%3，%2是%3') /* I10N: %1, %2: operators; %3: class */
          : gt.pgettext('module mission', '%1不编入%3，%2是%3')
      ) /* I10N: %1, %2: operators; %3: class */
        .replace('%1', by)
        .replace('%2', others)
        .replaceAll('%3', professionName(other.profession))
    case 'allowed':
      return onlyText(listJoin([...reason.squad.allowed!].map(professionName)), professionName(other.profession))
    case 'position':
      return onlyText(positionName(reason.squad.position!), positionName(other.position))
    case 'stars':
      return gt
        .pgettext('module mission', '%1的其他人只能是 %3 星，%2是 %4 星') /* I10N: %1, %2: operators; %3, %4: numbers */
        .replace('%1', by)
        .replace('%2', others)
        .replace('%3', String(reason.squad.stars))
        .replace('%4', String(other.stars))
  }
}

export function formatPiggybackConflict(c: PiggybackConflict, names: MissionNames): string {
  if (c.kind === 'firstDeployPiggyback') {
    return gt
      .pgettext('module mission', '和%s的顺带任务都要第一个部署，这一次只能推进一条')
      .replaceAll('%s', names.character(c.with.charId))
  }
  const reason =
    c.kind === 'squad'
      ? formatSplitReason({ kind: 'squad', rule: c.rule, by: c.by, squad: c.squad, others: [c.other] }, names)
      : gt.pgettext('module mission', '%s也要第一个部署').replaceAll('%s', names.character(c.with.charId))
  return gt.pgettext('module mission', '这一次推进不了：%s').replaceAll('%s', reason)
}

/** 至多三条，用「；」连起来 */
export function formatSplitReasons(reasons: readonly SplitReason[], names: MissionNames): string {
  return reasons.map((r) => formatSplitReason(r, names)).join(gt.pgettext('module mission', '；'))
}
