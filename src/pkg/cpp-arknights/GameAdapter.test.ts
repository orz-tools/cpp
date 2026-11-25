import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Assertion, Querier, QueryParam } from '../cpp-basic'
import type { DataContainerObject } from '../dccache'
import { Character } from './DataManager'
import { ArknightsAdapter } from './GameAdapter'
import { recruitAssertion } from './recruit'
import { HeyboxSurveySource, YituliuSurveySource } from './survey'
import { Arknights, ArknightsRegion, PreferenceKeys, SurveySourceKey } from './types'

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
      }))
    }

    it('gives each module but the initial one a row, with its survey rates', async () => {
      const rows = await run({ join: 'mod' })
      expect(rows.map((x) => x.name)).toEqual(['uniequip_002_radian', 'uniequip_003_radian'])
      expect(rows[0].unlock).toBeCloseTo(0.4 / 0.8, 10)
      expect(rows[1].unlock).toBeCloseTo(0.6 / 0.8, 10)
      expect(rows[0].yituliu3).toBeCloseTo(0.3 / 0.8, 10)
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

    it('has no rates for an operator the survey does not know', async () => {
      remote.set('arknights-yituliu-operatorsurvey', { result: [], userCount: 0 })
      const rows = await run({ join: 'mod' })
      for (const row of rows) {
        expect(row.unlock).toBeNaN()
        expect(row.yituliu3).toBeNaN()
      }
    })
  })

  describe('elite 2 voucher rows', () => {
    const operator = (name: string, spTargetType: string) => ({
      name,
      appellation: name,
      displayNumber: name,
      rarity: 'TIER_6',
      profession: 'TANK',
      position: 'MELEE',
      spTargetType,
      skills: [],
      allSkillLvlup: [],
      phases: [
        { maxLevel: 50, evolveCost: null },
        { maxLevel: 80, evolveCost: [{ id: '30011', count: 5, type: 'MATERIAL' }] },
        { maxLevel: 90, evolveCost: [{ id: '30012', count: 4, type: 'MATERIAL' }] },
      ],
    })

    beforeEach(() => {
      const k = remote.get('arknights-kengxxiao-zh_CN') as any
      // 机械师 has its elite phase materials in the game data, which are never paid
      k.exCharacters.char_4230_mcnist = operator('机械师', 'ROGUE')
      k.exCharacters.char_test_tank = operator('重装', 'NONE')
    })

    it('leave out a special operator, whose elite 2 is worth 0', async () => {
      const ga = new ArknightsAdapter()
      await ga.getDataManager().init('zh_CN')
      const current = { ...ga.getUserDataAdapter().getFrozenEmptyCharacterStatus(), elite: 1, level: 1 }
      const run = (param: QueryParam) => {
        const querier = new Querier<Arknights, any>(ga.getRootCharacterQuery(), param)
        querier.execute(
          (function* () {
            for (const key of ['char_4230_mcnist', 'char_test_tank']) {
              yield { character: ga.getCharacter(key), current, goal: undefined }
            }
          })(),
        )
        return querier
      }
      const all = run({})
      const value = (key: string) =>
        all.getFieldValue(
          'cost.elite2',
          all.result.find((x) => x.character.key === key)!,
        )
      expect(value('char_4230_mcnist')).toBe(0)
      expect(value('char_test_tank')).not.toBe(0)

      const presets = ga.getPredefinedQueries()
      expect(run(presets['cost.elite2.all'].query).result.map((x) => x.character.key)).toEqual(['char_test_tank'])
      // The default segment also asks for `own`, a field of the shell's, so it is only checked to drop the zeros too
      const where = { _: 'field' as const, field: 'cost.elite2', op: '!=', operand: 0 }
      expect(presets['cost.elite2'].query.where).toMatchObject({ operand: expect.arrayContaining([where]) })
    })
  })

  describe('optional data', () => {
    const someone = { key: 'char_x' } as Character

    beforeEach(() => {
      vi.spyOn(console, 'warn').mockImplementation(() => {})
      remote.set('arknights-yituliu-operatorsurvey', {
        result: [{ charId: 'char_x', rarity: 5, own: 0.5, elite: {} }],
        userCount: 10,
      })
      remote.set('arknights-heybox-operatorsurvey', { rows: [{ i: 'char_x', o: 0.4, e: [null, null, null] }] })
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('starts without the penguin matrix, with no stages and no item values', async () => {
      remote.delete('arknights-penguin-CN')
      const ga = new ArknightsAdapter()
      const dm = ga.getDataManager()
      await dm.init('zh_CN')
      expect(dm.isMissing(dm.$penguin)).toBe(true)
      expect(ga.getStageInfos()).toEqual({})
      expect(ga.getItemValues()).toEqual({ status: 'unavailable' })
      expect(ga.getItem('30011').valueAsAp).toBeUndefined()
    })

    it('starts without a survey, whose source then has nothing for anyone', async () => {
      remote.delete('arknights-yituliu-operatorsurvey')
      const ga = new ArknightsAdapter()
      const dm = ga.getDataManager()
      await dm.init('zh_CN')
      expect(dm.isMissing(dm.$surveyYituliu)).toBe(true)
      expect(new YituliuSurveySource(dm).own(someone)).toBeNull()
      expect(new HeyboxSurveySource(dm).own(someone)).toMatchObject({ percent: 0.4 })
    })

    it('does not start without the game data', async () => {
      remote.delete('arknights-kengxxiao-zh_CN')
      await expect(new ArknightsAdapter().getDataManager().init('zh_CN')).rejects.toThrow('no remote')
    })

    it('takes the penguin matrix in once loadMissing gets it', async () => {
      const matrix = remote.get('arknights-penguin-CN')
      remote.delete('arknights-penguin-CN')
      const ga = new ArknightsAdapter()
      const dm = ga.getDataManager()
      await dm.init('zh_CN')

      remote.set('arknights-penguin-CN', matrix)
      expect(await dm.loadMissing()).toMatchObject({ applied: true, failed: [] })
      expect(dm.isMissing(dm.$penguin)).toBe(false)
      expect(Object.keys(ga.getStageInfos())).toContain('main_01')
      expect(ga.getItemValues().status).not.toBe('unavailable')
    })
  })

  describe('recruitment', () => {
    const recruit = (tagName: string) => ({
      tags: [
        { tagId: 11, tagName: '高级资深干员' },
        { tagId: 19, tagName },
      ],
      pool: [
        { charId: 'char_103_angel', tags: [2, 10, 11, 19] },
        { charId: 'char_2013_cerber', tags: [6, 10, 14, 19] },
      ],
    })

    beforeEach(() => {
      const k = remote.get('arknights-kengxxiao-zh_CN') as any
      k.exCharacters = {
        char_103_angel: { name: '能天使', rarity: 'TIER_6', profession: 'SNIPER', skills: [] },
        char_2013_cerber: { name: '刻俄柏', rarity: 'TIER_5', profession: 'CASTER', skills: [] },
        char_002_amiya: { name: '阿米娅', rarity: 'TIER_5', profession: 'CASTER', skills: [] },
      }
      k.exRecruit = recruit('输出')
    })

    function setGlobal(exRecruit: unknown) {
      const k = structuredClone(remote.get('arknights-kengxxiao-zh_CN')) as any
      if (exRecruit) k.exRecruit = exRecruit
      else delete k.exRecruit
      remote.set('arknights-kengxxiao-en_US', k)
      remote.set('arknights-penguin-US', remote.get('arknights-penguin-CN'))
    }

    it('reads the pool of zh_CN', async () => {
      const dm = new ArknightsAdapter().getDataManager()
      await dm.init('zh_CN')
      expect(dm.recruit).toEqual(recruit('输出'))
    })

    it('has an empty pool in data published before it', async () => {
      delete (remote.get('arknights-kengxxiao-zh_CN') as any).exRecruit
      const dm = new ArknightsAdapter().getDataManager()
      await dm.init('zh_CN')
      expect(dm.recruit).toEqual({ tags: [], pool: [] })
    })

    it('reads a global server’s own pool, never zh_CN’s', async () => {
      setGlobal(recruit('DPS'))
      const dm = new ArknightsAdapter().getDataManager()
      await dm.init('en_US')
      expect(dm.recruit).toEqual(recruit('DPS'))

      setGlobal(null)
      const old = new ArknightsAdapter().getDataManager()
      await old.init('en_US')
      expect(old.recruit).toEqual({ tags: [], pool: [] })
    })

    async function query(where?: Assertion) {
      const ga = new ArknightsAdapter()
      await ga.getDataManager().init('zh_CN')
      const empty = ga.getUserDataAdapter().getFrozenEmptyCharacterStatus()
      const querier = new Querier<Arknights, any>(ga.getRootCharacterQuery(), { where })
      querier.execute(
        (function* () {
          for (const key of ['char_103_angel', 'char_2013_cerber', 'char_002_amiya'])
            yield { character: ga.getCharacter(key), current: empty, goal: undefined }
        })(),
      )
      return querier.result.map((x) => [x.character.key, querier.getFieldValue('recruit', x)])
    }

    it('gives the tags as strings, and none to an operator outside the pool', async () => {
      expect(await query()).toEqual([
        ['char_103_angel', ['2', '10', '11', '19']],
        ['char_2013_cerber', ['6', '10', '14', '19']],
        ['char_002_amiya', []],
      ])
    })

    it('leaves a 6★ out of the quick filter until 高级资深干员 is picked', async () => {
      expect((await query(recruitAssertion(['19']))).map((x) => x[0])).toEqual(['char_2013_cerber'])
      expect((await query(recruitAssertion(['11', '19']))).map((x) => x[0])).toEqual(['char_103_angel'])
    })

    it('offers the tags of the data as the field’s options', async () => {
      const ga = new ArknightsAdapter()
      await ga.getDataManager().init('zh_CN')
      expect(ga.getRootCharacterQuery().fields.get('recruit')!.options!()).toEqual([
        { value: '11', label: '高级资深干员' },
        { value: '19', label: '输出' },
      ])
    })
  })
})

describe('ArknightsAdapter', () => {
  const adapter = new ArknightsAdapter()

  it('exposes the codename and regions', () => {
    expect(adapter.getCodename()).toBe('arknights')
    expect(ArknightsAdapter.getRegions().map((r) => r.id)).toEqual([
      ArknightsRegion.zh_CN,
      ArknightsRegion.en_US,
      ArknightsRegion.ja_JP,
      ArknightsRegion.ko_KR,
    ])
  })

  it('reads and writes the survey source preference with validation', () => {
    expect(adapter.readPreference(PreferenceKeys.SurveySource, {})).toBe(SurveySourceKey.None)
    expect(adapter.readPreference(PreferenceKeys.SurveySource, { surveySource: 'yituliu' })).toBe(
      SurveySourceKey.Yituliu,
    )
    expect(adapter.readPreference(PreferenceKeys.SurveySource, { surveySource: 'bogus' })).toBe(SurveySourceKey.None)
    expect(adapter.writePreference(PreferenceKeys.SurveySource, SurveySourceKey.Heybox, { a: 1 })).toEqual({
      a: 1,
      surveySource: 'heybox',
    })
  })

  it('exposes static game configuration', async () => {
    setRemote()
    await adapter.getDataManager().init('zh_CN')
    expect(adapter.getFormulaTagNames()).toEqual(expect.any(Object))
    expect(adapter.getInventoryPages()).toEqual({ material: expect.any(String) })
    expect(adapter.getInventoryCategories()).toEqual(expect.any(Object))
    expect(adapter.getDefaultCharacterQueryOrder()).toEqual([
      ['rarity', 'DESC'],
      ['elite', 'DESC'],
      ['level', 'DESC'],
    ])
    expect(adapter.getFavCharacterQueryWhere()).toMatchObject({ _: 'field', field: 'elite', op: '<', operand: 2 })
    const groups = adapter.getPredefinedQueryGroups().map((x) => x.id)
    const presets = Object.values(adapter.getPredefinedQueries())
    expect(presets.length).toBeGreaterThan(0)
    for (const preset of presets) expect(groups).toContain(preset.group)
    expect(() => adapter.getRootCharacterQuery()).not.toThrow()
  })
})
