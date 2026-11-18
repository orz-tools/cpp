import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  SpecialOperator,
  buildSpecialOperator,
  expRows,
  levelExp,
  needUnmet,
  nodeForTask,
  nodeState,
  nodeUnlocked,
  shortenMissionTexts,
  soProgress,
} from './specialOperators'
import { ArknightsCharacterStatus, ArknightsCharacterTaskType } from './types'

// 读文件而不 import：import 会让 tsc 为 JSON 推导字面量类型
const fx = JSON.parse(readFileSync(new URL('./__fixtures__/special-operators.json', import.meta.url), 'utf8'))

const MCNIST = 'char_4230_mcnist'
const RADIAN = 'char_4195_radian'
const skills = (name: string) => [1, 2, 3].map((i) => `skchr_${name}_${i}`)

function build(charId: string, lang = 'zh_CN'): SpecialOperator {
  const so = buildSpecialOperator(charId, skills(charId.split('_')[2]), fx.zh_CN, lang === 'zh_CN' ? null : fx[lang])
  if (!so) throw new Error(`no ${charId} in ${lang}`)
  return so
}

const mcnist = build(MCNIST)
const radian = build(RADIAN)

const status = (s: Partial<ArknightsCharacterStatus>): ArknightsCharacterStatus => ({
  elite: 0,
  level: 1,
  skillLevel: 1,
  skillMaster: {},
  modLevel: {},
  ...s,
})

describe('buildSpecialOperator', () => {
  it('reads the mode and the topic', () => {
    expect([mcnist.mode, mcnist.topic]).toEqual(['集成战略', '沉沦者的黑流树海'])
    expect([radian.mode, radian.topic]).toEqual(['集成战略', '岁的界园志异'])
  })

  it('lists the nodes that take a mission', () => {
    const count = (so: SpecialOperator) => [so.elites, so.skillLevels, so.masteries, so.modules].map((l) => l.length)
    expect(count(mcnist)).toEqual([2, 2, 9, 3])
    expect(count(radian)).toEqual([2, 2, 9, 6])
    expect(mcnist.skillLevels.map((n) => n.key)).toEqual(['skill4', 'skill7'])
    expect(mcnist.masteries.map((n) => n.key).slice(0, 4)).toEqual([
      'mastery:skchr_mcnist_1:1',
      'mastery:skchr_mcnist_1:2',
      'mastery:skchr_mcnist_1:3',
      'mastery:skchr_mcnist_2:1',
    ])
    expect(radian.modules.map((n) => n.key)).toEqual([
      'mod:uniequip_002_radian:1',
      'mod:uniequip_002_radian:2',
      'mod:uniequip_002_radian:3',
      'mod:uniequip_003_radian:1',
      'mod:uniequip_003_radian:2',
      'mod:uniequip_003_radian:3',
    ])
  })

  it('keeps each node’s prerequisite', () => {
    expect(mcnist.elites.map((n) => n.need)).toEqual([
      { elite: 0, level: 50 },
      { elite: 1, level: 80 },
    ])
    expect(mcnist.skillLevels.map((n) => n.need)).toEqual([
      { elite: 0, level: 1 },
      { elite: 1, level: 1 },
    ])
    expect(mcnist.modules[0].need).toEqual({ elite: 2, level: 60 })
  })

  it('drops the experience past each phase’s maximum', () => {
    expect(mcnist.expMap.map((l) => l.length)).toEqual([49, 79, 89])
  })

  it('groups the masters, named where the data names them', () => {
    const groups = (so: SpecialOperator) => so.masters.map((m) => [m.masterId, m.name, m.levels.length])
    expect(groups(mcnist)).toEqual([
      ['master_mcnist_1', null, 3],
      ['master_mcnist_2', '战斗精通 II', 3],
      ['master_mcnist_3', '战斗精通 I', 3],
      ['master_mcnist_4', null, 3],
      ['master_mcnist_5', null, 1],
      ['master_mcnist_6', null, 1],
    ])
    expect(groups(radian)).toEqual([
      ['master_radian_1', null, 2],
      ['master_radian_2', null, 1],
      ['master_radian_3', null, 3],
      ['master_radian_4', null, 3],
      ['master_radian_5', null, 3],
      ['master_radian_6', '历战精锐', 3],
    ])
  })

  it('marks the master levels that unlock with an elite phase', () => {
    const auto = (so: SpecialOperator) =>
      so.masters.flatMap((m) => m.levels.filter((l) => !l.mission).map((l) => [m.masterId, l.level, l.need.elite]))
    expect(auto(mcnist)).toEqual([['master_mcnist_5', 1, 2]])
    expect(auto(radian)).toEqual([
      ['master_radian_1', 1, 1],
      ['master_radian_1', 2, 2],
      ['master_radian_2', 1, 2],
    ])
  })

  it('is undefined for an operator without the data, and for data published before it', () => {
    expect(buildSpecialOperator('char_002_amiya', [], fx.zh_CN, null)).toBeUndefined()
    expect(buildSpecialOperator(MCNIST, skills('mcnist'), undefined, null)).toBeUndefined()
    const empty = {
      modeData: [],
      operatorBasicData: {},
      operatorDetailData: {},
      nodeUnlockMissionData: {},
      masterNames: {},
    }
    expect(buildSpecialOperator(MCNIST, skills('mcnist'), empty, null)).toBeUndefined()
  })
})

describe('mission texts', () => {
  const text = (so: SpecialOperator, key: string) => {
    const node = [...so.elites, ...so.skillLevels].find((n) => n.key === key)!
    return [node.mission.text, node.mission.full]
  }

  it('lose the common opening in zh_CN, keeping the difficulty', () => {
    expect(text(mcnist, 'elite1')).toEqual(['到达3层', '在集成战略：沉沦者的黑流树海的常规行动中，到达3层'])
    expect(text(mcnist, 'elite2')).toEqual([
      '保密等级·1及以上，通关任意结局',
      '在集成战略：沉沦者的黑流树海的常规行动保密等级·1及以上，通关任意结局',
    ])
  })

  it('lose it in ja_JP and ko_KR, keeping a leading bracket or quote', () => {
    const ja = build(RADIAN, 'ja_JP')
    expect(text(ja, 'elite1')).toEqual(['雲瓦亭へ到達', '統合戦略：歳の界園志異の通常探索で雲瓦亭へ到達'])
    expect(text(ja, 'elite2')[0]).toBe('<迎客入園・2>以上で、任意のエンディングへ到達')
    expect(ja.mode).toBe('統合戦略')
    const ko = build(RADIAN, 'ko_KR')
    expect(text(ko, 'elite1')[0]).toBe("'청운정' 구역에 도달")
  })

  it('stay whole in en_US, which has no common opening', () => {
    const en = build(RADIAN, 'en_US')
    expect(text(en, 'elite1')[0]).toBe(
      "Reach Yunwa Gazebo in Integrated Strategies: Sui's Garden of Grotesqueries (Regular Operations)",
    )
    expect([en.mode, en.topic]).toEqual(['Integrated Strategies', "Sui's Garden of Grotesqueries"])
    expect(en.masters.find((m) => m.masterId === 'master_radian_6')!.name).toBe('Elite Veteran')
  })

  it('fall back to zh_CN for an operator the region lacks', () => {
    const en = build(MCNIST, 'en_US')
    expect([en.mode, en.topic]).toEqual(['Integrated Strategies', '沉沦者的黑流树海'])
    expect(text(en, 'elite1')).toEqual(text(mcnist, 'elite1'))
    expect(en.masters.find((m) => m.masterId === 'master_mcnist_2')!.name).toBe('战斗精通 II')
  })

  it('stay whole when the opening would leave a bare number', () => {
    const texts = [
      '在集成战略：某主题的常规行动保密等级·1及以上，到达3层',
      '在集成战略：某主题的常规行动保密等级·2及以上，通关',
    ]
    expect(shortenMissionTexts(texts, '某主题')).toEqual(texts)
  })

  it('stay whole when the opening does not name the topic', () => {
    const texts = ['在集成战略的常规行动中，到达3层', '在集成战略的常规行动中，通关任意结局']
    expect(shortenMissionTexts(texts, '某主题')).toEqual(texts)
    expect(
      shortenMissionTexts(
        texts.map((t) => t.replace('集成战略', '集成战略：某主题')),
        '某主题',
      ),
    ).toEqual(['到达3层', '通关任意结局'])
  })
})

describe('tasks', () => {
  const mission = (so: SpecialOperator, type: ArknightsCharacterTaskType) => nodeForTask(so, type)?.mission.id

  it('find their node and its mission', () => {
    expect(mission(mcnist, { _: 'elite', elite: 1 })).toBe('mcnist_t_evolve_1')
    expect(mission(mcnist, { _: 'elite', elite: 2 })).toBe('mcnist_t_evolve_2')
    expect(mission(mcnist, { _: 'skill', to: 4 })).toBe('mcnist_t_skill_to4')
    expect(mission(mcnist, { _: 'skill', to: 7 })).toBe('mcnist_t_skill_to7')
    expect(mission(mcnist, { _: 'skillMaster', skillId: 'skchr_mcnist_2', to: 3 })).toBe('mcnist_t_skill2_to10')
    expect(mission(mcnist, { _: 'mod', modId: 'uniequip_002_mcnist', to: 2 })).toBe('mcnist_t_uniequip1_2')
    expect(mission(radian, { _: 'elite', elite: 1 })).toBe('t_evolve_1')
    expect(mission(radian, { _: 'skill', to: 7 })).toBe('t_skill_to7')
    expect(mission(radian, { _: 'skillMaster', skillId: 'skchr_radian_3', to: 1 })).toBe('t_skill3_to8')
    expect(mission(radian, { _: 'mod', modId: 'uniequip_003_radian', to: 3 })).toBe('t_uniequip2_3')
  })

  it('count a skill level between the steps towards the step above it', () => {
    expect(nodeForTask(mcnist, { _: 'skill', to: 5 })?.key).toBe('skill7')
    expect(nodeForTask(mcnist, { _: 'skill', to: 2 })?.key).toBe('skill4')
  })

  it('have no node for levels and recruiting', () => {
    expect(nodeForTask(mcnist, { _: 'level', elite: 1, from: 1, to: 80 })).toBeUndefined()
    expect(nodeForTask(mcnist, { _: 'join' })).toBeUndefined()
    expect(nodeForTask(mcnist, { _: 'mod', modId: 'uniequip_001_mcnist', to: 1 })).toBeUndefined()
  })
})

describe('experience', () => {
  it('adds up the levels between', () => {
    expect(levelExp(mcnist, 0, 1, 50)).toBe(22500)
    expect(levelExp(mcnist, 1, 60, 80)).toBe(30573)
    expect(levelExp(mcnist, 2, 1, 60)).toBe(198000)
    expect(levelExp(mcnist, 2, 1, 90)).toBe(909300)
    expect(levelExp(radian, 1, 1, 80)).toBe(68000)
  })

  it('makes a row per phase: passed, planned and left', () => {
    const rows = expRows(mcnist, status({ elite: 1, level: 60 }), status({ elite: 2, level: 60 }))
    expect(rows.map((r) => [r.key, r.state, r.from, r.to, r.top, r.exp, r.total])).toEqual([
      ['exp0', 'done', 1, 50, 50, 22500, 22500],
      ['exp1', 'planned', 60, 80, 80, 30573, 68000],
      ['exp2', 'planned', 1, 60, 90, 198000, 909300],
    ])
    const idle = expRows(mcnist, status({ elite: 1, level: 60 }), undefined)
    expect(idle.map((r) => [r.state, r.from, r.to, r.exp])).toEqual([
      ['done', 1, 50, 22500],
      ['idle', 60, 80, 30573],
      ['idle', 1, 90, 909300],
    ])
  })

  it('counts a phase at its maximum level as passed, and an absent operator from level 1', () => {
    expect(expRows(mcnist, status({ elite: 0, level: 50 }), undefined)[0].state).toBe('done')
    const absent = expRows(mcnist, status({ level: 0 }), status({ elite: 0, level: 30 }))
    expect(absent.map((r) => [r.state, r.from, r.to])).toEqual([
      ['planned', 1, 30],
      ['idle', 1, 80],
      ['idle', 1, 90],
    ])
  })
})

describe('node states', () => {
  const current = status({ elite: 1, level: 60, skillLevel: 4 })
  const goal = status({
    elite: 2,
    level: 60,
    skillLevel: 7,
    skillMaster: { skchr_mcnist_1: 1 },
    modLevel: { uniequip_002_mcnist: 1 },
  })
  const node = (key: string) =>
    [...mcnist.elites, ...mcnist.skillLevels, ...mcnist.masteries, ...mcnist.modules].find((n) => n.key === key)!

  it('tell unlocked, planned and idle apart', () => {
    expect(nodeState(node('elite1'), current, goal)).toBe('done')
    expect(nodeState(node('skill4'), current, goal)).toBe('done')
    expect(nodeState(node('elite2'), current, goal)).toBe('planned')
    expect(nodeState(node('skill7'), current, goal)).toBe('planned')
    expect(nodeState(node('mastery:skchr_mcnist_1:1'), current, goal)).toBe('planned')
    expect(nodeState(node('mastery:skchr_mcnist_1:2'), current, goal)).toBe('idle')
    expect(nodeState(node('mod:uniequip_002_mcnist:1'), current, goal)).toBe('planned')
    expect(nodeState(node('elite2'), current, undefined)).toBe('idle')
  })

  it('unlock nothing for an absent operator', () => {
    expect(nodeState(node('elite1'), status({ elite: 1, level: 0 }), undefined)).toBe('idle')
    expect(nodeUnlocked(node('elite1'), status({ elite: 1 }))).toBe(true)
  })

  it('name the prerequisites not met yet', () => {
    expect(needUnmet(node('elite2').need, current)).toBe(true)
    expect(needUnmet(node('elite2').need, status({ elite: 1, level: 80 }))).toBe(false)
    expect(needUnmet(node('skill7').need, current)).toBe(false)
    expect(needUnmet(node('elite2').need, status({ level: 0 }))).toBe(false)
  })

  it('count the unlocked nodes out of all', () => {
    expect(soProgress(mcnist, current)).toEqual({ done: 2, total: 16 })
    expect(soProgress(radian, status({}))).toEqual({ done: 0, total: 19 })
    expect(soProgress(mcnist, status({ elite: 1, level: 0, skillLevel: 4 }))).toEqual({ done: 0, total: 16 })
  })
})
