import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DataContainerObject } from '../dccache'
import { ArknightsAdapter } from './GameAdapter'
import { PreferenceKeys } from './types'

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

    await dm.rebuild()
    expect(ga.getStageInfos()).not.toBe(stages)
    expect(ga.getExpItems()).not.toBe(expItems)
    expect(ga.getItemValues()).not.toBe(values)
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

  it('asks for a rebuild only when the item value config changes', () => {
    const ga = new ArknightsAdapter()
    expect(ga.applyPreferenceSnapshot({})).toBe(false)
    const changed = { [PreferenceKeys.ItemValue]: { stageScope: 'mainline' } }
    expect(ga.applyPreferenceSnapshot(changed)).toBe(true)
    expect(ga.applyPreferenceSnapshot(changed)).toBe(false)
    expect(ga.getItemValueConfig().stageScope).toBe('mainline')
  })
})
