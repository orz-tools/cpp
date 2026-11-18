import { describe, expect, it, vi } from 'vitest'
import { ArknightsAdapter } from '../pkg/cpp-arknights/GameAdapter'
import { PredefinedQuery, PredefinedQueryGroup } from '../pkg/cpp-basic'
import { presetMenu, presetRowKey } from './presetMenu'

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

  describe('with the Arknights presets', () => {
    const groups = ArknightsAdapter.prototype.getPredefinedQueryGroups.call(undefined)
    const presetsWith = (hasBaseSkills: boolean) =>
      ArknightsAdapter.prototype.getPredefinedQueries.call({ hasBaseSkills: () => hasBaseSkills } as any)
    const presets = presetsWith(true)
    const menu = presetMenu(groups, presets)

    it('puts every preset in a group the adapter names', () => {
      const ids = new Set(groups.map((x) => x.id))
      for (const [k, v] of Object.entries(presets)) expect(ids.has(v.group), k).toBe(true)
      expect(menu.map((x) => String(x.group.title))).toEqual(['练度统计', '养成成本', '基建技能'])
    })

    it('lists the survey presets first, each with 「全部」', () => {
      expect(shape(menu)[0]).toEqual([
        'stats',
        [
          ['skill.mastery3rate.yituliu', 'skill.mastery3rate.all.yituliu'],
          ['skill.mastery3rate.heybox', 'skill.mastery3rate.all.heybox'],
          ['elite2rate.yituliu', 'elite2rate.all.yituliu'],
          ['elite2rate.heybox', 'elite2rate.all.heybox'],
          ['elite2level90rate.heybox', 'elite2level90rate.all.heybox'],
          ['mod.unlockrate.yituliu', 'mod.unlockrate.all.yituliu'],
        ],
      ])
      for (const row of menu[0].rows) expect(row.segments.map((s) => String(s.label))).toEqual(['全部'])
    })

    it('lists the training costs after them, each with 「全部」', () => {
      expect(shape(menu)[1]).toEqual([
        'cost',
        [['cost.elite2', 'cost.elite2.all'], ['skill.cost.mastery3', 'skill.cost.mastery3.all'], ['cost.invested']],
      ])
      for (const row of menu[1].rows.slice(0, 2)) {
        expect(row.segments.map((s) => String(s.label))).toEqual(['全部'])
      }
    })

    it('replaces only presets that are gone, with ones that exist', () => {
      const replaced = ArknightsAdapter.prototype.getReplacedPredefinedQueries.call(undefined)
      for (const [from, to] of Object.entries(replaced)) {
        expect(Object.hasOwn(presets, from), from).toBe(false)
        expect(Object.hasOwn(presets, to), to).toBe(true)
      }
    })

    it('lists the base skills last, on one row of three', () => {
      expect(shape(menu)[2]).toEqual(['building', [['building.locked', 'building.owned', 'building.all']]])
      expect(menu[2].rows[0].segments.map((s) => String(s.label))).toEqual(['已持有', '全部'])
    })

    it('leaves the base skills out until the data has them', () => {
      expect(presetMenu(groups, presetsWith(false)).map((x) => x.group.id)).toEqual(['stats', 'cost'])
    })
  })
})

describe('presetRowKey', () => {
  it('gives a segment the key of its row, and any other preset its own key', () => {
    const presets = {
      x: preset('x', 'a', ['x.all']),
      'x.all': preset('x all', 'a'),
      y: preset('y', 'a'),
    }
    expect(presetRowKey(presets, 'x')).toBe('x')
    expect(presetRowKey(presets, 'x.all')).toBe('x')
    expect(presetRowKey(presets, 'y')).toBe('y')
    expect(presetRowKey(presets, 'gone')).toBe('gone')
  })
})
