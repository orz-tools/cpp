import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  BoardInput,
  EMPTY_HELD,
  MissionCatalog,
  MissionInput,
  MissionModule,
  MissionNames,
  MissionScope,
  MissionWorld,
  buildBoard,
  capacity,
  conflict,
  fits,
  formatPiggybackConflict,
  formatSplitReasons,
  missionProgress,
  missionSummary,
  parseMission,
  partitionStage,
  piggybackConflict,
  splitReasons,
  successorTicket,
} from './moduleMissions'
import { ArknightsCharacterStatus, Profession } from './types'

// 读文件而不 import：import 会让 tsc 为 JSON 推导字面量类型
const fx = JSON.parse(readFileSync(new URL('./__fixtures__/module-missions.zh_CN.json', import.meta.url), 'utf8'))

const stars = (rarity: string) => Number(rarity.slice('TIER_'.length))

function input(id: string): MissionInput {
  const m = fx.exUniEquips.missionList[id]
  const e = fx.exUniEquips.equipDict[m.uniEquipId]
  const formId: string = e.tmplId ?? e.charId
  const form = fx.exPatchCharacters.patchChars[formId] ?? fx.exCharacters[formId]
  return {
    id,
    template: m.template,
    paramList: m.paramList,
    stageId: m.jumpStageId,
    desc: m.desc,
    equipId: m.uniEquipId,
    charId: e.charId,
    formId,
    profession: form.profession,
    position: form.position,
    stars: stars(form.rarity),
  }
}

const world: MissionWorld = { enemyLevel: (id) => fx.exEnemies.enemyData[id]?.enemyLevel }
const parse = (id: string) => parseMission(input(id), world)
const names: MissionNames = {
  character: (charId) => fx.exCharacters[charId]?.name ?? charId,
  enemy: (id) => fx.exEnemies.enemyData[id]?.name,
  skill: (id) => fx.exSkills[id]?.levels[0].name,
}
const summary = (id: string) => missionSummary(parse(id), names)
const onStage = (stageId: string) =>
  Object.keys(fx.exUniEquips.missionList).filter((id) => fx.exUniEquips.missionList[id].jumpStageId === stageId)

/** 手写的任务：数据里没有的情况 */
function made(id: string, over: Partial<MissionInput>): MissionInput {
  return {
    id,
    template: 'EquipmentSquadNoAnyDead',
    paramList: ['3', 'main_x', 'char_' + id],
    stageId: 'main_x',
    desc: '原文 ' + id,
    equipId: 'uniequip_' + id,
    charId: 'char_' + id,
    formId: 'char_' + id,
    profession: Profession.SNIPER,
    position: 'RANGED',
    stars: 5,
    ...over,
  }
}

const ids = (runs: { mission: MissionInput }[][]) => runs.map((r) => r.map((x) => x.mission.id))

// 3-8 的十二条
const surtr = 'uniequip_002_surtr_2'
const alga = 'uniequip_002_alga_2'
const amiyaCaster = 'uniequip_002_amiya_2'
const amiyaMedic = 'uniequip_002_amiya3_2'
const robrta = 'uniequip_002_robrta_2'
const vigil = 'uniequip_002_vigil_2'
// 4-2
const sunbr = 'uniequip_002_sunbr_2'
const frostl = 'uniequip_002_frostl_2'
const fang2 = 'uniequip_002_fang2_2'
const caper = 'uniequip_002_caper_2'
// 4-3
const makoto = 'uniequip_002_makoto_2'
const chilc = 'uniequip_002_chilc_2'
const tinman = 'uniequip_002_tinman_2'
const leto = 'uniequip_002_leto_2'
// 4-6
const liskam = 'uniequip_002_liskam_2'
const demkni = 'uniequip_003_demkni_2'
const rosesa = 'uniequip_002_rosesa_2'
// S2-3
const swire = 'uniequip_002_swire_2'
const tachak = 'uniequip_002_tachak_2'
const vulpis = 'uniequip_002_vulpis_2'
// 不限关卡
const swireAny = 'uniequip_002_swire_1'
const fang2Any = 'uniequip_002_fang2_1'
const sunbrAny = 'uniequip_002_sunbr_1'

describe('parseMission and missionSummary', () => {
  it('read the squad conditions', () => {
    expect(parse(sunbr).squad).toEqual({ banned: new Set(['TANK']) })
    expect(summary(sunbr)).toBe('不编入其他重装')
    // 塞雷娅自己是重装
    expect(summary(demkni)).toBe('不编入医疗')

    expect(parse('uniequip_003_pallas_2').squad).toEqual({ allowed: new Set(['TANK']) })
    expect(summary('uniequip_003_pallas_2')).toBe('其他人只能是重装')
    expect(parse(tachak).squad).toEqual({ allowed: new Set(['TANK']), maxOthers: 1 })
    expect(summary(tachak)).toBe('其他人只能是重装，至多 1 名')
    expect(parse('uniequip_002_deepcl_2').squad.maxOthers).toBe(0)
    expect(summary('uniequip_002_deepcl_2')).toBe('不编入其他人')
    // `13,PIONEER;13,MEDIC`：分号连起来的几个职业
    expect(parse('uniequip_002_meteo_2').squad).toEqual({ allowed: new Set(['PIONEER', 'MEDIC']) })
    expect(summary('uniequip_002_meteo_2')).toBe('其他人只能是先锋、医疗')
    // 999 也是不限
    expect(parse('uniequip_003_dusk_4').squad).toEqual({ allowed: new Set(['PIONEER']) })

    expect(parse('uniequip_002_humus_2').squad).toEqual({ position: 'MELEE' })
    expect(summary('uniequip_002_humus_2')).toBe('其他人只能是近战位')
    expect(summary(swire)).toBe('其他人只能是近战位，至多 1 名')
    const star = parseMission(
      made('star', { template: 'EquipmentSquadStar', paramList: ['3', 'main_x', 'c', '13,3'] }),
      world,
    )
    expect(star.squad).toEqual({ stars: 3 })
    expect(missionSummary(star, names)).toBe('其他人只能是 3 星')

    expect(summary('uniequip_002_toddi_2')).toBe('其他人至多 6 名')
    expect(parse('uniequip_002_ling_2').squad).toEqual({ maxOthers: 4 })
    expect(summary('uniequip_002_ling_2')).toBe('其他人至多部署 4 位')
    expect(parse('uniequip_003_siege_2').firstDeploy).toBe(true)
    expect(summary('uniequip_003_siege_2')).toBe('第一个部署，全程不撤退')
  })

  it('read the enemies, skills and counts', () => {
    expect(summary(robrta)).toBe('所有干员不被击倒')
    expect(parse(surtr)).toMatchObject({ bosses: ['enemy_1500_skulsr'], enemies: [] })
    expect(summary(surtr)).toBe('本人歼灭碎骨')
    // 伺夜那条把本人和召唤物各写一遍
    expect(parse(vigil)).toMatchObject({ known: true, bosses: ['enemy_1500_skulsr'], enemies: [] })
    expect(summary(vigil)).toBe('本人歼灭碎骨')
    expect(parse('uniequip_002_podego_2')).toMatchObject({ bosses: [], enemies: ['enemy_1021_bslime'] })
    expect(summary('uniequip_002_podego_2')).toBe('本人歼灭 2 名高能源石虫')
    // 布丁那条的参数多一个数字
    expect(summary('uniequip_002_pudd_2')).toBe('本人歼灭 2 名重装防御者')
    const kill = made('kill', {
      template: 'EquipmentEventStageKill',
      paramList: ['3', 'main_x', 'c', '10', 'DEATHDETAIL,c,enemy_1034_laxe', '2'],
    })
    expect(missionSummary(parseMission(kill, world), names)).toBe('本人歼灭 10 名敌人，其中 2 名屠夫')
    expect(summary(caper)).toBe('本人歼灭 8 名敌人')
    expect(summary(alga)).toBe('使用 2 次「只为我的答案」')
  })

  it('sum up the missions on any stage', () => {
    expect(summary('uniequip_002_sunbr_1')).toBe('累计释放 6 次「食粮烹制」')
    expect(summary('uniequip_003_demkni_1')).toBe('每场至少释放 3 次「药物配置」，共 5 场')
    expect(summary('uniequip_002_alga_1')).toBe('累计歼灭 20 名敌人')
    expect(summary('uniequip_002_aurora_1')).toBe('累计造成 40000 点伤害')
    expect(summary('uniequip_002_fang2_1')).toBe('每场第一个部署，共 5 场')
    expect(summary('uniequip_002_meteo_1')).toBe('每场至少歼灭 10 名敌人，共 5 场')
    expect(summary('uniequip_002_peacok_1')).toBe('每场至少造成 15000 点伤害，共 5 场')
    expect(summary('uniequip_001_flower_15')).toBe('每场至少部署 1 次，共 5 场')
    expect(summary(swireAny)).toBe('其他人只能是近卫，共 5 场')

    const anyStage = (id: string, over: Partial<MissionInput>) =>
      parseMission(made(id, { stageId: null, ...over }), world)
    const token = anyStage('token', { template: 'EquipmentDamageTotalWithToken', paramList: ['c', '120000', '0'] })
    expect(missionSummary(token, names)).toBe('累计造成 120000 点伤害')
    const deployKill = anyStage('deployKill', {
      template: 'EquipmentDeployCharAndKillCnt',
      paramList: ['5', '2', 'char_deployKill', 'DEATHDETAIL', '4'],
    })
    expect(missionSummary(deployKill, names)).toBe('每场至少部署 2 次、歼灭 4 名敌人，共 5 场')
    const star = anyStage('star', { template: 'EquipmentSquadStarStage', paramList: ['5', 'char_star', '999,3'] })
    expect(star.squad).toEqual({ stars: 3 })
    expect(missionSummary(star, names)).toBe('其他人只能是 3 星，共 5 场')
  })

  it('drop the quotes a skill name comes with', () => {
    expect(names.skill('skchr_bubble_2')).toBe('“挨打”')
    expect(summary('uniequip_002_bubble_1')).toBe('每场至少释放 1 次「挨打」，共 5 场')
    expect(summary('uniequip_002_tinman_1')).toBe('累计释放 8 次「大拉里」')
    const stage = made('cast', {
      template: 'EquipmentSkillCastStage',
      paramList: ['3', 'main_x', 'skchr_tinman_2', '2'],
    })
    expect(missionSummary(parseMission(stage, world), names)).toBe('使用 2 次「大拉里」')
  })

  it('fall back to the original text', () => {
    for (const id of ['uniequip_002_amiya_1', 'uniequip_002_bgsnow_1', 'uniequip_002_deepcl_1']) {
      expect(parse(id).known).toBe(true)
      expect(summary(id)).toBe(fx.exUniEquips.missionList[id].desc)
    }
    const anyStage = (id: string, over: Partial<MissionInput>) =>
      missionSummary(parseMission(made(id, { stageId: null, ...over }), world), names)
    // 部署的是召唤物
    expect(
      anyStage('summon', { template: 'EquipmentDeployStage', paramList: ['5', '1', 'token_10026_x', 'char_summon'] }),
    ).toBe('原文 summon')
    expect(anyStage('garbled', { template: 'EquipmentBattleCharKilled', paramList: ['5', 'char_garbled', 'x7'] })).toBe(
      '原文 garbled',
    )
    expect(anyStage('noSkill', { template: 'EquipmentSkillCast', paramList: ['c', 'skchr_missing', '3'] })).toBe(
      '原文 noSkill',
    )
    expect(anyStage('order', { template: 'EquipmentDeployCharOrder', paramList: ['5', '2', 'char_order'] })).toBe(
      '原文 order',
    )

    const strange = parseMission(made('strange', { template: 'EquipmentSomethingNew' }), world)
    expect(strange.known).toBe(false)
    expect(missionSummary(strange, names)).toBe('原文 strange')
    const badParam = parseMission(
      made('bad', { template: 'EquipmentSquadProEx', paramList: ['3', 'x', 'c', 'DOCTOR'] }),
      world,
    )
    expect(badParam.known).toBe(false)
  })
})

describe('conflict and fits', () => {
  it('put 4-2 into one run', () => {
    expect(fits([sunbr, frostl, fang2, caper].map(parse))).toBe(true)
  })

  it('keep apart a class that another one bars', () => {
    expect(conflict(parse(liskam), parse(demkni))).toMatchObject({ kind: 'squad', rule: 'banned' })
    expect(conflict(parse(demkni), parse(rosesa))).toMatchObject({ kind: 'squad', rule: 'banned' })
    // 诗怀雅只要近战位，塔克只要重装
    expect(conflict(parse(swire), parse(tachak))).toMatchObject({ kind: 'squad', rule: 'allowed' })
  })

  it('give each boss to one operator', () => {
    const bosses = onStage('main_03-08')
      .map(parse)
      .filter((x) => x.bosses.length > 0)
    expect(bosses).toHaveLength(9)
    for (const a of bosses) {
      for (const b of bosses) {
        if (a !== b) expect(conflict(a, b)).not.toBeNull()
      }
    }
  })

  it('take one form of Amiya and one first deployment', () => {
    expect(conflict(parse(amiyaCaster), parse(amiyaMedic))).toEqual({ kind: 'form' })
    const first = (id: string) =>
      parseMission(made(id, { template: 'EquipmentDeployOneNoEvac', paramList: ['3', 'main_x', 'c', '1'] }), world)
    expect(conflict(first('a'), first('b'))).toEqual({ kind: 'firstDeploy' })
  })

  it('keep within the squad limits', () => {
    const others = (n: number) => Array.from({ length: n }, (_, i) => parseMission(made('o' + i, {}), world))
    const toddi = parse('uniequip_002_toddi_2')
    expect(fits([toddi, ...others(6)])).toBe(true)
    expect(fits([toddi, ...others(7)])).toBe(false)
    expect(fits(others(12))).toBe(true)
    expect(fits(others(13))).toBe(false)
  })
})

describe('piggybackConflict', () => {
  const anyStage = (id: string, over: Partial<MissionInput>) =>
    parseMission(made(id, { stageId: null, ...over }), world)
  const firstDeploy = (id: string) =>
    anyStage(id, { template: 'EquipmentDeployCharOrder', paramList: ['5', '1', 'char_' + id] })

  it('lets one first deployment through a run', () => {
    const a = firstDeploy('a')
    const b = firstDeploy('b')
    const run = [parseMission(made('a', { id: 'a_stage' }), world), parseMission(made('b', { id: 'b_stage' }), world)]
    expect(piggybackConflict(a, run, [a, b])).toEqual({ kind: 'firstDeployPiggyback', with: b.mission })
    expect(piggybackConflict(b, run, [a, b])).toEqual({ kind: 'firstDeployPiggyback', with: a.mission })
    expect(formatPiggybackConflict(piggybackConflict(a, run, [a, b])!, names)).toBe(
      '和char_b的顺带任务都要第一个部署，这一次只能推进一条',
    )
  })

  it('gives way to a stage mission that also deploys first', () => {
    const order = firstDeploy('order')
    const siege = parse('uniequip_003_siege_2')
    const c = piggybackConflict(order, [parseMission(made('order', { id: 'order_stage' }), world), siege], [order])
    expect(c).toEqual({ kind: 'firstDeploy', with: siege.mission })
    expect(formatPiggybackConflict(c!, names)).toBe('这一次推进不了：推进之王也要第一个部署')
  })

  it('checks a squad rule against everyone else in the run', () => {
    const star = anyStage('star', { template: 'EquipmentSquadStarStage', paramList: ['5', 'char_star', '999,3'] })
    const six = parseMission(made('six', { stars: 6 }), world)
    const c = piggybackConflict(star, [parseMission(made('star', { id: 'star_stage' }), world), six], [star])
    expect(c).toMatchObject({ kind: 'squad', rule: 'stars' })
    expect(formatPiggybackConflict(c!, names)).toBe('这一次推进不了：char_star的其他人只能是 3 星，char_six是 6 星')
  })
})

describe('partitionStage', () => {
  it('splits 3-8 into nine runs, the first with the most', () => {
    const runs = partitionStage(onStage('main_03-08').map(parse), [])
    expect(runs).toHaveLength(9)
    expect(runs[0].map((x) => x.mission.id).sort()).toEqual([alga, amiyaMedic, robrta, 'uniequip_002_kroos2_2'].sort())
    expect(runs.slice(1).every((r) => r.length === 1)).toBe(true)
  })

  it('does not depend on the order it is given', () => {
    const missions = onStage('main_03-08').map(parse)
    const expected = ids(partitionStage(missions, ['char_350_surtr']))
    const shuffled = [...missions].reverse()
    shuffled.push(...shuffled.splice(0, 5))
    expect(ids(partitionStage(shuffled, ['char_350_surtr']))).toEqual(expected)
    // 计划里靠前的干员先分
    expect(expected[0]).toContain(surtr)
  })

  it('falls back to a greedy split past sixteen missions', () => {
    const missions = Array.from({ length: 20 }, (_, i) =>
      parseMission(made('g' + String(i).padStart(2, '0'), {}), world),
    )
    const start = performance.now()
    const runs = partitionStage(missions, [])
    expect(performance.now() - start).toBeLessThan(1000)
    expect(runs.map((r) => r.length)).toEqual([12, 8])
  })
})

describe('splitReasons', () => {
  it('names the boss that splits 3-8', () => {
    const text = formatSplitReasons(splitReasons(partitionStage(onStage('main_03-08').map(parse), [])), names)
    const [first, ...rest] = text.split('；')
    expect(first).toMatch(/^(.+、){8}.+都要本人歼灭碎骨$/)
    expect(first).toContain('史尔特尔')
    expect(rest).toContain('阿米娅一次只能带一种形态')
  })

  it('gives each class clash its own sentence', () => {
    const runs = partitionStage([liskam, demkni, rosesa].map(parse), [])
    expect(ids(runs)).toEqual([[liskam, rosesa], [demkni]])
    expect(formatSplitReasons(splitReasons(runs), names)).toBe(
      '雷蛇不编入其他重装，塞雷娅是重装；塞雷娅不编入医疗，瑰盐是医疗',
    )
  })

  it('blames the squad size when nothing else clashes', () => {
    const toddi = parse('uniequip_002_toddi_2')
    const others = Array.from({ length: 7 }, (_, i) => parseMission(made('o' + i, {}), world))
    const runs = partitionStage([toddi, ...others], [])
    expect(runs).toHaveLength(2)
    expect(formatSplitReasons(splitReasons(runs), names)).toBe('人数超过限制')
  })
})

describe('capacity', () => {
  it('counts who else can come along', () => {
    expect(capacity([makoto, chilc, tinman, leto].map(parse))).toEqual({
      count: 8,
      professions: ['TANK', 'SNIPER', 'CASTER', 'SUPPORT', 'SPECIAL'],
    })
    expect(capacity([surtr, alga].map(parse))).toEqual({
      count: 10,
      professions: ['PIONEER', 'WARRIOR', 'TANK', 'SNIPER', 'CASTER', 'MEDIC', 'SUPPORT', 'SPECIAL'],
    })
    expect(capacity([parse(tachak)])).toEqual({ count: 1, professions: ['TANK'] })
    expect(capacity([parse('uniequip_002_deepcl_2')]).count).toBe(0)
    expect(capacity([parse('uniequip_002_humus_2')])).toMatchObject({ count: 11, position: 'MELEE' })
  })
})

describe('buildBoard', () => {
  const unlockLevel = [-1, -1, -1, 40, 50, 60]
  const modules: MissionModule[] = Object.values<any>(fx.exUniEquips.equipDict).map((e) => {
    const s = stars(fx.exCharacters[e.charId].rarity)
    return {
      equipId: e.uniEquipId,
      charId: e.charId,
      stars: s,
      unlockLevel: unlockLevel[s - 1],
      missions: (e.missionList as string[])
        .map(input)
        .sort(
          (a, b) =>
            fx.exUniEquips.missionList[a.id].uniEquipMissionSort - fx.exUniEquips.missionList[b.id].uniEquipMissionSort,
        ),
    }
  })
  const catalog: MissionCatalog = {
    modules,
    world,
    stage: (id) => ({
      id,
      code: fx.exStage.stages[id]?.code ?? id,
      name: '',
      apCost: fx.exStage.stages[id]?.apCost ?? 0,
      zoneName: '',
    }),
    isOwned: (_, st) => !!st && st.level > 0,
  }
  const st = (elite: number, level: number, modLevel: Record<string, number> = {}): ArknightsCharacterStatus => ({
    elite,
    level,
    skillLevel: 1,
    skillMaster: {},
    modLevel,
  })
  const current = {
    char_196_sunbr: st(2, 55), // 古米：计划内，能做
    char_193_frostl: st(2, 30), // 霜叶：计划内，没到 40 级
    char_1036_fang2: st(2, 60), // 历阵锐枪芬：任务已开放
    char_4100_caper: st(1, 50), // 跃跃：持有，没精二
    char_112_siege: st(2, 60), // 推进之王：任务已开放
    char_107_liskam: st(2, 60, { uniequip_002_liskam: 1 }), // 雷蛇：模组已解锁
  }
  const goal = {
    char_196_sunbr: st(2, 55, { uniequip_002_sunbr: 1 }),
    char_193_frostl: st(2, 40, { uniequip_002_frostl: 1 }),
    char_350_surtr: st(2, 60, { uniequip_002_surtr: 1 }), // 史尔特尔：计划内，未持有
  }
  const board = (scope: MissionScope, over: Partial<BoardInput> = {}) =>
    buildBoard({
      catalog,
      current,
      goal,
      doneMissions: [],
      goalOrder: [],
      scope,
      rarities: [],
      held: EMPTY_HELD,
      ...over,
    })
  const equipsOf = (b: ReturnType<typeof board>) =>
    [...new Set([...b.tickets, ...b.used].flatMap((t) => t.missions.map((x) => x.equipId)))].sort()

  it('picks the modules of each scope', () => {
    expect(board('plan').stats.modules).toBe(3)
    expect(equipsOf(board('plan'))).toEqual(['uniequip_002_sunbr'])
    expect(equipsOf(board('open'))).toEqual(['uniequip_002_fang2', 'uniequip_002_sunbr', 'uniequip_003_siege'])
    expect(equipsOf(board('elite2'))).toEqual([
      'uniequip_002_fang2',
      'uniequip_002_frostl',
      'uniequip_002_sunbr',
      'uniequip_003_siege',
    ])
    expect(equipsOf(board('owned'))).toEqual([
      'uniequip_002_caper',
      'uniequip_002_fang2',
      'uniequip_002_frostl',
      'uniequip_002_sunbr',
      'uniequip_003_siege',
    ])
    expect(board('all').stats.modules).toBe(modules.length - 1)
    expect(board('everything').stats.modules).toBe(modules.length)
  })

  it('lists who cannot count yet, in the plan only', () => {
    const plan = board('plan')
    expect(plan.blocked.map((x) => [x.mission.charId, x.reason])).toEqual([
      ['char_193_frostl', 'level'],
      ['char_193_frostl', 'level'],
      ['char_350_surtr', 'absent'],
      ['char_350_surtr', 'absent'],
    ])
    expect(plan.stats.runsWithBlocked).toBe(0)

    const elite2 = board('elite2')
    expect(elite2.blocked).toEqual([])
    const t42 = elite2.tickets.find((t) => t.stageId === 'main_04-02')!
    expect(t42.missions.map((x) => x.id)).toEqual([fang2, frostl, sunbr])
    expect(t42.blocked).toEqual([{ charId: 'char_193_frostl', reason: 'level' }])
    expect(elite2.stats.runsWithBlocked).toBe(1)
    // 有人还不能做的排在后面，条数再多也一样
    expect(elite2.tickets.map((t) => t.stageId)).toEqual(['main_11-02', 'main_04-02'])
  })

  it('moves what is done to the used cards', () => {
    const plan = board('plan', { doneMissions: [sunbr] })
    expect(plan.tickets).toEqual([])
    expect(plan.used.map((t) => [t.stageId, t.missions.map((x) => x.id)])).toEqual([['main_04-02', [sunbr]]])
    // 还不能做的也算在范围内
    expect(plan.stats).toMatchObject({ runs: 0, ap: 0, done: 1, stageDone: 1, stageTotal: 3 })

    const everything = board('everything', { doneMissions: [sunbr, frostl, fang2, caper] })
    expect(everything.tickets.some((t) => t.stageId === 'main_04-02')).toBe(false)
    expect(everything.used.map((t) => t.key)).toEqual([[caper, fang2, frostl, sunbr].sort().join(',')])
    // 模组已解锁的算做完，照样参与分法
    expect(everything.done.has(liskam)).toBe(true)
    expect(everything.ticketOf.get(liskam)?.stageId).toBe('main_04-06')
  })

  it('counts the runs and sanity', () => {
    const open = board('open')
    expect(open.tickets.map((t) => t.stageId)).toEqual(['main_04-02', 'main_11-02'])
    expect(open.stats).toMatchObject({ modules: 3, runs: 2, ap: 18 + 21, done: 0, runsWithBlocked: 0 })
    expect(open.tickets[0].piggyback.map((x) => x.charId).sort()).toEqual(['char_1036_fang2', 'char_196_sunbr'])
  })

  it('filters by rarity only when asked to', () => {
    expect(board('all', { rarities: [] }).stats.modules).toBe(modules.length - 1)
    const six = board('all', { rarities: [6] })
    expect(six.stats.modules).toBeGreaterThan(0)
    expect(
      [...six.tickets, ...six.used].every((t) =>
        t.missions.every((x) => stars(fx.exCharacters[x.charId].rarity) === 6),
      ),
    ).toBe(true)
  })

  it('gives a mission it cannot read a run of its own', () => {
    const strange = made('strange', { template: 'EquipmentSomethingNew' })
    const plain = made('plain', {})
    const b = buildBoard({
      catalog: {
        ...catalog,
        modules: [strange, plain].map((m) => ({
          equipId: m.equipId,
          charId: m.charId,
          stars: 5,
          unlockLevel: 50,
          missions: [m],
        })),
      },
      current: {},
      goal: {},
      doneMissions: [],
      goalOrder: [],
      scope: 'all',
      rarities: [],
      held: EMPTY_HELD,
    })
    expect(b.tickets.map((t) => [t.missions.map((x) => x.id), t.unknown])).toEqual([
      [['plain'], false],
      [['strange'], true],
    ])
  })

  it('follows the selected ticket when one of its missions is ticked or unticked', () => {
    const tickets = board('open').tickets
    const t42 = tickets.find((t) => t.stageId === 'main_04-02')!
    expect(t42.key).toBe([fang2, sunbr].join(','))
    expect(successorTicket(tickets, [caper, fang2, sunbr].join(','))).toBe(t42)
    expect(successorTicket(tickets, sunbr)).toBe(t42)
    expect(successorTicket(tickets, [sunbr, surtr].join(','))).toBeUndefined()
    expect(successorTicket(tickets, surtr)).toBeUndefined()
  })

  it('keeps a ticked mission where it was until it is tidied', () => {
    const before = board('open')
    const t42 = before.tickets.find((t) => t.stageId === 'main_04-02')!
    expect(before.stale).toBe(0)

    const held = board('open', { doneMissions: [sunbr], held: new Set([sunbr]) })
    expect(held.tickets.map((t) => t.key)).toEqual(before.tickets.map((t) => t.key))
    expect(held.tickets.find((t) => t.stageId === 'main_04-02')).toMatchObject({ key: t42.key, allDone: false })
    expect(held.used).toEqual([])
    expect(held.stale).toBe(1)
    expect(held.stats).toMatchObject({ runs: 2, done: 1 })

    const tidied = board('open', { doneMissions: [sunbr] })
    expect(tidied.used.map((t) => t.key)).toEqual([sunbr])
    expect(tidied.tickets.find((t) => t.stageId === 'main_04-02')?.key).toBe(fang2)
    expect(tidied.stale).toBe(0)
  })

  it('does not split a stage again while a ticked mission is kept', () => {
    const runs = (b: ReturnType<typeof board>) => b.tickets.filter((t) => t.stageId === 'main_03-08').length
    expect(runs(board('all'))).toBe(9)
    expect(runs(board('all', { doneMissions: [surtr], held: new Set([surtr]) }))).toBe(9)
    expect(runs(board('all', { doneMissions: [surtr] }))).toBe(8)
  })

  it('keeps a ticket whose missions are all ticked, without counting it', () => {
    const open = board('open')
    const t42 = open.tickets.find((t) => t.stageId === 'main_04-02')!
    const done = { doneMissions: [fang2, sunbr], held: new Set([fang2, sunbr]) }
    const kept = board('open', done)
    expect(kept.tickets.find((t) => t.stageId === 'main_04-02')).toMatchObject({ key: t42.key, allDone: true })
    expect(kept.stats).toMatchObject({ runs: open.stats.runs - 1, ap: open.stats.ap - 18 })
    expect(kept.stale).toBe(2)

    const everything = board('everything')
    const all = [sunbr, frostl, fang2, caper]
    const keptAll = board('everything', { doneMissions: all, held: new Set(all) })
    expect(keptAll.tickets.find((t) => t.stageId === 'main_04-02')).toMatchObject({ allDone: true })
    expect(keptAll.stats).toMatchObject({ runs: everything.stats.runs - 1, ap: everything.stats.ap - 18 })
    expect(keptAll.stale).toBe(4)
    const tidied = board('everything', { doneMissions: all })
    expect(tidied.tickets.some((t) => t.stageId === 'main_04-02')).toBe(false)
    expect(tidied.used.map((t) => t.key)).toEqual([[caper, fang2, frostl, sunbr].sort().join(',')])
    // 「所有任务」档本来就把做完的分进去，只勾一部分时整理不改什么
    expect(board('everything', { doneMissions: [sunbr], held: new Set([sunbr]) }).stale).toBe(0)
  })

  it('keeps a ticked mission on any stage in the piggyback and in its place', () => {
    const b = board('open', { doneMissions: [fang2Any], held: new Set([fang2Any]) })
    const t42 = b.tickets.find((t) => t.stageId === 'main_04-02')!
    expect(t42.piggyback.map((x) => x.id)).toContain(fang2Any)
    expect(b.anyStage.find((g) => g.charId === 'char_1036_fang2')?.missions[0].id).toBe(fang2Any)
    expect(b.stale).toBe(1)

    const tidied = board('open', { doneMissions: [fang2Any] })
    expect(tidied.tickets.find((t) => t.stageId === 'main_04-02')!.piggyback.map((x) => x.id)).not.toContain(fang2Any)
    expect(tidied.stale).toBe(0)
  })

  it('does not keep a ticket for someone who cannot count yet', () => {
    const plan = board('plan', { doneMissions: [frostl], held: new Set([frostl]) })
    expect(plan.used.map((t) => t.key)).toEqual([frostl])
    expect(plan.tickets.some((t) => t.missions.some((x) => x.id === frostl))).toBe(false)
    expect(plan.stale).toBe(0)
  })

  it('says which piggyback cannot move in its run', () => {
    const s23 = board('all').tickets.find((t) => t.missions.some((x) => x.id === swire))!
    expect(s23.missions.map((x) => x.id).sort()).toEqual([swire, vulpis].sort())
    expect([...s23.piggybackConflicts.keys()]).toEqual([swireAny])
    expect(formatPiggybackConflict(s23.piggybackConflicts.get(swireAny)!, names)).toBe(
      '这一次推进不了：诗怀雅的其他人只能是近卫，忍冬是先锋',
    )

    const t42 = board('open').tickets.find((t) => t.stageId === 'main_04-02')!
    expect(t42.piggyback.map((x) => x.id).sort()).toEqual([fang2Any, sunbrAny].sort())
    expect(t42.piggybackConflicts.size).toBe(0)
  })

  it('returns the last board for the same input', () => {
    const input: BoardInput = {
      catalog,
      current,
      goal,
      doneMissions: [],
      goalOrder: [],
      scope: 'plan',
      rarities: [],
      held: EMPTY_HELD,
    }
    expect(buildBoard(input)).toBe(buildBoard({ ...input }))
    expect(buildBoard(input)).not.toBe(buildBoard({ ...input, doneMissions: [] }))

    // 带 held 的和不带的交替着算，两份都留着
    const held = { ...input, held: new Set([sunbr]) }
    const plain = buildBoard(input)
    const kept = buildBoard(held)
    expect(buildBoard(input)).toBe(plain)
    expect(buildBoard(held)).toBe(kept)
  })
})

describe('missionProgress', () => {
  const mod = (equipId: string): MissionModule => ({
    equipId,
    charId: 'char_x',
    stars: 6,
    unlockLevel: 60,
    missions: [made(`${equipId}_1`, { equipId }), made(`${equipId}_2`, { equipId })],
  })
  const modules = [mod('uniequip_x'), mod('uniequip_y')]
  const st = (modLevel: Record<string, number>): ArknightsCharacterStatus => ({
    elite: 2,
    level: 60,
    skillLevel: 7,
    skillMaster: {},
    modLevel,
  })

  it('counts the done missions of the locked modules', () => {
    expect(missionProgress(modules, st({}), new Set(['uniequip_y_1']))).toEqual({ done: 1, total: 4 })
  })

  it('leaves out a module that is unlocked', () => {
    const progress = missionProgress(modules, st({ uniequip_x: 1, uniequip_y: 0 }), new Set(['uniequip_x_1']))
    expect(progress).toEqual({ done: 0, total: 2 })
  })

  it('has nothing to show once every module is unlocked, or when there is none', () => {
    expect(missionProgress(modules, st({ uniequip_x: 1, uniequip_y: 2 }), new Set())).toBeNull()
    expect(missionProgress([], st({}), new Set())).toBeNull()
  })

  it('counts every module of an operator not owned', () => {
    expect(missionProgress(modules, undefined, new Set(['uniequip_x_2']))).toEqual({ done: 1, total: 4 })
  })
})
