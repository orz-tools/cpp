import { describe, expect, it } from 'vitest'
import type { IStageCategory, IStageInfo, IZoneInfo } from '../pkg/cpp-basic'
import { groupStages } from './stageGroups'

function stage(id: string, code: string, name: string, zoneId: string): IStageInfo {
  return { id, code, name, zoneId, sortKey: id } as IStageInfo
}

const stageInfos: Record<string, IStageInfo> = Object.fromEntries(
  [
    stage('main_01-10', '1-10', '紧急授课', 'main_1'),
    stage('main_01-07', '1-7', '暴君', 'main_1'),
    stage('main_00-01', '0-1', '坍塌', 'main_0'),
    stage('act2mainss_01', '15-1', 'Shining', 'act2mainss_zone1'),
    stage('act99side_01', 'XX-1', 'Party', 'act99side_zone1'),
    stage('wk_melee_6', 'CE-6', '货物运送', 'weekly_chips'),
    stage('mystery_01', 'MY-1', 'Mystery', 'mystery_zone'),
  ].map((x) => [x.id, x]),
)

const zoneInfos: Record<string, IZoneInfo> = {
  main_0: { id: 'main_0', name: '序章', categoryId: 'main', sortKey: '0 a' },
  main_1: { id: 'main_1', name: '第一章', categoryId: 'main', sortKey: '0 b' },
  act2mainss_zone1: { id: 'act2mainss_zone1', name: '15', categoryId: 'main', sortKey: '1 a' },
  act99side_zone1: { id: 'act99side_zone1', name: 'XX', categoryId: 'sidestory', sortKey: 'act99' },
  weekly_chips: { id: 'weekly_chips', name: '芯片', categoryId: 'resource', sortKey: 'weekly' },
}

const categories: IStageCategory[] = [
  { id: 'main', name: '主线' },
  { id: 'activity', name: '活动' },
  { id: 'sidestory', name: '别传' },
  { id: 'resource', name: '资源收集' },
  { id: 'other', name: '其他' },
]

const all = Object.keys(stageInfos)

function shape(query = '', ids = all) {
  return groupStages(ids, stageInfos, zoneInfos, categories, query).map((c) => [
    c.category.id,
    c.zones.map((z) => [z.zone.id, z.stageIds]),
  ])
}

describe('groupStages', () => {
  it('orders categories, zones and stages, and drops empty categories', () => {
    expect(shape()).toEqual([
      [
        'main',
        [
          ['main_0', ['main_00-01']],
          ['main_1', ['main_01-07', 'main_01-10']],
          ['act2mainss_zone1', ['act2mainss_01']],
        ],
      ],
      ['sidestory', [['act99side_zone1', ['act99side_01']]]],
      ['resource', [['weekly_chips', ['wk_melee_6']]]],
      ['other', [['mystery_zone', ['mystery_01']]]],
    ])
  })

  it('puts an unknown zone in other, named by its id', () => {
    const other = groupStages(all, stageInfos, zoneInfos, categories, '').find((c) => c.category.id === 'other')!
    expect(other.zones[0].zone).toMatchObject({ id: 'mystery_zone', name: 'mystery_zone', categoryId: 'other' })
  })

  it('adds an other category when the game does not list one', () => {
    const groups = groupStages(['mystery_01'], stageInfos, zoneInfos, categories.slice(0, 2), '')
    expect(groups.map((c) => c.category.id)).toEqual(['other'])
  })

  it('filters by code or name, case-insensitive and trimmed, dropping empty zones and categories', () => {
    expect(shape('  1-7 ')).toEqual([['main', [['main_1', ['main_01-07']]]]])
    expect(shape('shin')).toEqual([['main', [['act2mainss_zone1', ['act2mainss_01']]]]])
    expect(shape('ce-')).toEqual([['resource', [['weekly_chips', ['wk_melee_6']]]]])
    expect(shape('nothing matches')).toEqual([])
  })

  it('returns nothing for no stages', () => {
    expect(shape('', [])).toEqual([])
  })
})
