import { describe, expect, it, vi } from 'vitest'
import { ArknightsAdapter } from '../pkg/cpp-arknights/GameAdapter'
import { PredefinedQuery, PredefinedQueryGroup } from '../pkg/cpp-basic'
import { presetMenu } from './presetMenu'

// 预设取自 ArknightsAdapter；导入它会顺带初始化 localforage，测试环境里没有存储后端
vi.mock('localforage', () => {
  const noop = new Proxy({}, { get: () => () => Promise.resolve(null) })
  return { default: { createInstance: () => noop, dropInstance: () => Promise.resolve() } }
})

const group = (id: string): PredefinedQueryGroup => ({ id, title: id })
const preset = (name: string, groupId: string, segments?: string[]): PredefinedQuery => ({
  name,
  group: groupId,
  segments: segments?.map((key) => ({ key, label: key, title: key })),
  query: {},
})

const shape = (menu: ReturnType<typeof presetMenu>) =>
  menu.map(({ group, rows }) => [group.id, rows.map((r) => [r.key, ...r.segments.map((s) => s.key)])])

describe('presetMenu', () => {
  it('folds the segments into their row and keeps the groups in order', () => {
    const menu = presetMenu([group('b'), group('a'), group('empty')], {
      x: preset('x', 'a', ['x.all', 'x.missing']),
      'x.all': preset('x all', 'a'),
      y: preset('y', 'b'),
      z: preset('z', 'a', ['z.usable', 'z.all']),
      'z.usable': preset('z usable', 'a'),
      'z.all': preset('z all', 'a'),
      lost: preset('lost', 'nowhere'),
    })
    expect(shape(menu)).toEqual([
      ['b', [['y']]],
      [
        'a',
        [
          ['x', 'x.all'],
          ['z', 'z.usable', 'z.all'],
        ],
      ],
    ])
  })

  it('reads the Arknights presets', () => {
    const groups = ArknightsAdapter.prototype.getPredefinedQueryGroups.call(undefined)
    const presets = ArknightsAdapter.prototype.getPredefinedQueries.call(undefined)
    const menu = presetMenu(groups, presets)
    expect(menu.map((x) => String(x.group.title))).toEqual(['练度统计'])
    expect(shape(menu)).toEqual([
      [
        'stats',
        [
          ['skill.mastery3rate.yituliu', 'skill.mastery3rate.all.yituliu'],
          ['skill.mastery3rate.heybox', 'skill.mastery3rate.all.heybox'],
          ['elite2rate.yituliu', 'elite2rate.all.yituliu'],
          ['elite2rate.heybox', 'elite2rate.all.heybox'],
          ['elite2level90rate.heybox', 'elite2level90rate.all.heybox'],
        ],
      ],
    ])
    for (const row of menu[0].rows) expect(row.segments.map((s) => String(s.label))).toEqual(['全部'])
  })
})
