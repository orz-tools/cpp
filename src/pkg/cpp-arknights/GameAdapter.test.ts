import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Querier, QueryParam } from '../cpp-basic'
import type { DataContainerObject } from '../dccache'
import { ArknightsAdapter } from './GameAdapter'
import { Arknights, PreferenceKeys } from './types'

vi.mock('localforage', () => ({
  default: {
    dropInstance: () => Promise.resolve(),
    createInstance: () => ({ removeItem: () => Promise.resolve() }),
  },
}))

const remote = vi.hoisted(() => new Map<string, unknown>())

vi.mock('../dccache', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../dccache')>()),
  getLastCheckedAt: () => Promise.resolve(0),
  load: (obj: DataContainerObject<any>) => {
    if (!remote.has(obj.name)) return Promise.reject(new Error(`no remote ${obj.name}`))
    return Promise.resolve({
      '@type': '@orz/cpp/data-container',
      '@version': 1,
      name: obj.name,
      version: { id: 'v1', text: 'v1', timestamp: 1, sources: [], schema: 3 },
      data: remote.get(obj.name),
    })
  },
}))

const item = (itemId: string, rarity = 'TIER_1') => ({
  itemId,
  name: itemId,
  rarity,
  iconId: itemId,
  sortId: Number(itemId) || 1,
  classifyType: 'MATERIAL',
  itemType: 'MATERIAL',
})

const stage = (stageId: string, zoneId: string, apCost = 6) => ({
  stageId,
  zoneId,
  code: stageId,
  name: stageId,
  apCost,
  diffGroup: 'NORMAL',
})

const fixedStages = ['wk_melee_1', 'wk_melee_2', 'wk_melee_3', 'wk_melee_4', 'wk_melee_5', 'wk_melee_6', 'wk_toxic_5']

let eventEnd: number

function setRemote() {
  eventEnd = Date.now() + 86400_000
  remote.clear()
  remote.set('arknights-kengxxiao-zh_CN', {
    exCharacters: {},
    exPatchCharacters: { infos: {}, patchChars: {} },
    exSkills: {},
    exUniEquips: { equipDict: {}, charEquip: {} },
    exItems: {
      items: { '30011': item('30011'), '30012': item('30012'), '4001': item('4001'), '4006': item('4006') },
      expItems: { '2001': { id: '2001', gainExp: 200 } },
    },
    exBuilding: { workshopFormulas: {}, manufactFormulas: {} },
    exStage: {
      stages: {
        main_01: stage('main_01', 'main_1'),
        act_01: stage('act_01', 'act_1'),
        ...Object.fromEntries(fixedStages.map((x) => [x, stage(x, 'weekly_1')])),
      },
    },
    exRetro: { stageList: {}, zoneToRetro: {}, retroActList: {} },
    exZone: {
      zones: {
        main_1: { type: 'MAINLINE', zoneNameFirst: 'Main', zoneNameSecond: '1' },
        act_1: { type: 'ACTIVITY', zoneNameFirst: 'Act', zoneNameSecond: '1' },
        weekly_1: { type: 'WEEKLY', zoneNameFirst: 'Weekly', zoneNameSecond: '1' },
      },
    },
  })
  remote.set('arknights-penguin-CN', {
    matrix: [
      { stageId: 'main_01', itemId: '30011', quantity: 10, times: 100, start: 0, end: null },
      { stageId: 'act_01', itemId: '30012', quantity: 50, times: 100, start: 0, end: eventEnd },
    ],
  })
  remote.set('arknights-yituliu-operatorsurvey', { result: [], userCount: 0 })
  remote.set('arknights-heybox-operatorsurvey', { rows: [] })
}

describe('ArknightsAdapter', () => {
  beforeEach(setRemote)

  it('drops its derived data on every commit', async () => {
    const ga = new ArknightsAdapter()
    const dm = ga.getDataManager()
    await dm.init('zh_CN')
    const stages = ga.getStageInfos()
    expect(Object.keys(stages).sort()).toEqual(['act_01', 'main_01', ...fixedStages].sort())
    const expItems = ga.getExpItems()
    const values = ga.getItemValues()
    const inputs = ga.exportItemValueGameInputs()
    const trainingCost = ga.getTrainingCost()

    await dm.rebuild()
    expect(ga.getStageInfos()).not.toBe(stages)
    expect(ga.getExpItems()).not.toBe(expItems)
    expect(ga.getItemValues()).not.toBe(values)
    expect(ga.getTrainingCost()).not.toBe(trainingCost)
    // Same containers, so the inputs built from the game data alone are kept.
    expect(ga.exportItemValueGameInputs()).toBe(inputs)
  })

  it('reports the end of an open event as the expiry of its commit', async () => {
    const ga = new ArknightsAdapter()
    await ga.getDataManager().init('zh_CN')
    expect(ga['onDataCommit']()).toBe(eventEnd)
  })

  it('names the weekly chip zone in the current language', async () => {
    const ga = new ArknightsAdapter()
    await ga.getDataManager().init('zh_CN')
    expect(ga.getZoneInfos()['weekly_chips'].name).toBe('芯片搜索')
  })

  it('names the newer main story chapters by their chapter number', async () => {
    const kengxxiao = remote.get('arknights-kengxxiao-zh_CN') as any
    Object.assign(kengxxiao.exStage.stages, {
      main_14_01: stage('main_14_01', 'main_14'),
      main_15_01: { ...stage('main_15_01', 'act2mainss_zone1'), code: '15-1' },
      act_02: stage('act_02', 'act_2'),
    })
    Object.assign(kengxxiao.exZone.zones, {
      main_14: { type: 'MAINLINE', zoneNameFirst: '第十四章', zoneNameSecond: '慈悲灯塔' },
      act2mainss_zone1: {
        type: 'MAINLINE_ACTIVITY',
        zoneNameFirst: 'Dissociative Recombination',
        zoneNameSecond: '离解复合',
      },
      act_2: { type: 'ACTIVITY', zoneNameFirst: null, zoneNameSecond: '残照终尽' },
    })
    const matrix = (remote.get('arknights-penguin-CN') as any).matrix
    for (const stageId of ['main_14_01', 'main_15_01', 'act_02']) {
      matrix.push({ stageId, itemId: '30011', quantity: 10, times: 100, start: 0, end: null })
    }
    const ga = new ArknightsAdapter()
    await ga.getDataManager().init('zh_CN')
    const zones = ga.getZoneInfos()
    expect(zones['act2mainss_zone1']).toMatchObject({ name: '第十五章 离解复合', shortName: '第十五章' })
    expect(zones['main_14']).toMatchObject({ name: '第十四章 慈悲灯塔', shortName: '第十四章' })
    expect(zones['act_2']).toMatchObject({ name: '残照终尽', shortName: '残照终尽' })
    expect(zones['weekly_chips']).toMatchObject({ name: '芯片搜索', shortName: '芯片搜索' })
  })

  it('leaves event mementos out of the inventory', async () => {
    const memento = { ...item('ark_odc_act53side_spitem_1'), classifyType: 'MEMENTO' }
    ;(remote.get('arknights-kengxxiao-zh_CN') as any).exItems.items[memento.itemId] = memento
    const ga = new ArknightsAdapter()
    await ga.getDataManager().init('zh_CN')
    const keys = ga.getInventoryItems().map((x) => x.key)
    expect(keys).toContain('30011')
    expect(keys).not.toContain(memento.itemId)
  })

  it('has no module missions or enemies in data published before them', async () => {
    const ga = new ArknightsAdapter()
    await ga.getDataManager().init('zh_CN')
    expect(ga.hasModuleMissions()).toBe(false)
    expect(ga.getEnemy('enemy_1500_skulsr')).toBeUndefined()
    expect(ga.getMissionCatalog().modules).toEqual([])
  })

  it('reads module missions and enemies once published', async () => {
    const k = remote.get('arknights-kengxxiao-zh_CN') as any
    k.exUniEquips.missionList = {
      uniequip_002_test_2: {
        template: 'EquipmentSquadNoAnyDead',
        desc: '3星通关',
        paramList: ['3', 'main_01', 'char_test'],
        uniEquipId: 'uniequip_002_test',
        uniEquipMissionSort: 2,
        jumpStageId: 'main_01',
      },
    }
    k.exEnemies = { enemyData: { enemy_1500_skulsr: { name: '碎骨', enemyLevel: 'BOSS' } } }
    const ga = new ArknightsAdapter()
    await ga.getDataManager().init('zh_CN')
    expect(ga.hasModuleMissions()).toBe(true)
    expect(ga.getEnemy('enemy_1500_skulsr')).toEqual({ name: '碎骨', level: 'BOSS' })
    expect(ga.getMissionCatalog().stage('main_01')).toMatchObject({ code: 'main_01', apCost: 6, zoneName: 'Main 1' })
    expect(ga.getMissionCatalog().stage('main_99')).toMatchObject({ code: 'main_99', name: '', apCost: 0 })
  })

  it('asks for a rebuild only when the item value config changes', () => {
    const ga = new ArknightsAdapter()
    expect(ga.applyPreferenceSnapshot({})).toBe(false)
    const changed = { [PreferenceKeys.ItemValue]: { stageScope: 'mainline' } }
    expect(ga.applyPreferenceSnapshot(changed)).toBe(true)
    expect(ga.applyPreferenceSnapshot(changed)).toBe(false)
    expect(ga.getItemValueConfig().stageScope).toBe('mainline')
  })

  it('shows potential unless turned off', () => {
    const ga = new ArknightsAdapter()
    expect(ga.readPreference(PreferenceKeys.ShowPotential, {})).toBe(true)
    const off = ga.writePreference(PreferenceKeys.ShowPotential, false, {})
    expect(ga.readPreference(PreferenceKeys.ShowPotential, off)).toBe(false)
    expect(ga.applyPreferenceSnapshot(off)).toBe(false)
    const on = ga.writePreference(PreferenceKeys.ShowPotential, true, off)
    expect(ga.readPreference(PreferenceKeys.ShowPotential, on)).toBe(true)
  })

  describe('module rows', () => {
    const equip = (id: string, typeName1: string, typeName2: string | null, order: number) => ({
      uniEquipId: id,
      uniEquipName: id,
      charId: 'char_4195_radian',
      typeName1,
      typeName2,
      charEquipOrder: order,
      unlockEvolvePhase: typeName2 ? 'PHASE_2' : 'PHASE_0',
    })

    beforeEach(() => {
      const k = remote.get('arknights-kengxxiao-zh_CN') as any
      k.exCharacters.char_4195_radian = { name: '电弧', rarity: 'TIER_6', profession: 'SUPPORT', skills: [] }
      k.exUniEquips.equipDict = {
        uniequip_001_radian: equip('uniequip_001_radian', 'ORIGINAL', null, 0),
        uniequip_002_radian: equip('uniequip_002_radian', 'SO', 'A', 4),
        uniequip_003_radian: equip('uniequip_003_radian', 'SO', 'B', 5),
      }
      k.exUniEquips.charEquip = {
        char_4195_radian: ['uniequip_001_radian', 'uniequip_002_radian', 'uniequip_003_radian'],
      }
      const counts = (count: number, rank1: number, rank2: number, rank3: number) => ({
        count,
        rank0: 1 - count,
        rank1,
        rank2,
        rank3,
      })
      const none = counts(0, 0, 0, 0)
      remote.set('arknights-yituliu-operatorsurvey', {
        result: [
          {
            charId: 'char_4195_radian',
            sampleSize: 1000,
            own: 0.9,
            elite: { count: 1, rank0: 0, rank1: 0.2, rank2: 0.8, rank3: 0 },
            modX: none,
            modY: none,
            modD: none,
            modA: counts(0.4, 0.1, 0, 0.3),
            modB: counts(0.6, 0.1, 0.1, 0.4),
          },
        ],
        userCount: 1000,
      })
      remote.set('arknights-heybox-operatorsurvey', {
        rows: [
          { i: 'char_4195_radian', e2m1: [0.55, 0.035, 0.415], e2m2: [0.068, 0.049, 0.883], e2m3: [null, null, null] },
        ],
      })
    })

    async function run(param: QueryParam, modLevel: Record<string, number> = {}) {
      const ga = new ArknightsAdapter()
      await ga.getDataManager().init('zh_CN')
      const character = ga.getCharacter('char_4195_radian')
      const current = { ...ga.getUserDataAdapter().getFrozenEmptyCharacterStatus(), elite: 2, level: 1, modLevel }
      const querier = new Querier<Arknights, any>(ga.getRootCharacterQuery(), param)
      querier.execute(
        (function* () {
          yield { character, current, goal: undefined }
        })(),
      )
      return querier.result.map((x) => ({
        name: querier.getFieldValue('mod.name', x),
        level: querier.getFieldValue('mod.level', x),
        unlock: querier.getFieldValue('mod.unlockrate.yituliu', x),
        yituliu3: querier.getFieldValue('mod.level3rate.yituliu', x),
        heybox3: querier.getFieldValue('mod.level3rate.heybox', x),
      }))
    }

    it('gives each module but the initial one a row, with its survey rates', async () => {
      const rows = await run({ join: 'mod' })
      expect(rows.map((x) => x.name)).toEqual(['uniequip_002_radian', 'uniequip_003_radian'])
      expect(rows[0].unlock).toBeCloseTo(0.4 / 0.8, 10)
      expect(rows[1].unlock).toBeCloseTo(0.6 / 0.8, 10)
      expect(rows[0].yituliu3).toBeCloseTo(0.3 / 0.8, 10)
      // Heybox's modules go by the number in the id and count only those who unlocked them
      expect(rows.map((x) => x.heybox3)).toEqual([0.415, 0.883])
    })

    it('sorts by unlock rate and leaves out the unlocked ones, as the yituliu preset does', async () => {
      const presets = ArknightsAdapter.prototype.getPredefinedQueries.call({ hasBaseSkills: () => false } as any)
      const preset = presets['mod.unlockrate.yituliu'].query
      const where = { _: 'field' as const, field: 'mod.level', op: '==', operand: 0 }
      expect(preset.where).toMatchObject({ operand: expect.arrayContaining([where]) })
      const all = await run({ join: 'mod', order: preset.order })
      expect(all.map((x) => x.name)).toEqual(['uniequip_003_radian', 'uniequip_002_radian'])
      const locked = await run({ join: 'mod', where, order: preset.order }, { uniequip_003_radian: 1 })
      expect(locked.map((x) => [x.name, x.level])).toEqual([['uniequip_002_radian', 0]])
    })

    it('has no rates for an operator neither survey knows', async () => {
      remote.set('arknights-yituliu-operatorsurvey', { result: [], userCount: 0 })
      remote.set('arknights-heybox-operatorsurvey', { rows: [] })
      const rows = await run({ join: 'mod' })
      for (const row of rows) {
        expect(row.unlock).toBeNaN()
        expect(row.yituliu3).toBeNaN()
        expect(row.heybox3).toBeNaN()
      }
    })
  })
})
