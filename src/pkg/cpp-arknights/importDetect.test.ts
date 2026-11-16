import { describe, expect, it } from 'vitest'
import { encodeArkntoolsBackup } from './arkntools'
import {
  detectArkntoolsBackup,
  detectMAADepot,
  detectMAAOperBox,
  detectMaaOperProgress,
  detectSkland,
} from './importDetect'

const knownItems = new Set(['4001', '3003', '30012', '30013'])
const isKnownItem = (id: string) => knownItems.has(id)

// 与粘贴框的尝试顺序相同
const detectors = {
  arkntools: detectArkntoolsBackup,
  skland: detectSkland,
  maaOperBox: detectMAAOperBox,
  maaOperProgress: detectMaaOperProgress,
  maaDepot: (text: string) => detectMAADepot(text, isKnownItem),
}
type Format = keyof typeof detectors

const arkntoolsBackup = {
  inputs: { '30012': [10, 3], '30013': { need: '', have: '7' } },
  presets: [{ name: '010_chen', setting: { evolve: [false, false], skills: { normal: [true, '4', '7'], elite: [] } } }],
  planStageBlacklist: ['1-7'],
}
const arkntoolsBase64 = Buffer.from(JSON.stringify(arkntoolsBackup), 'utf-8').toString('base64')

const samples: [Format, string, string][] = [
  ['arkntools', 'base64, wrapped', `\n${arkntoolsBase64.slice(0, 20)}\n${arkntoolsBase64.slice(20)}  `],
  ['arkntools', 'its own encoding', encodeArkntoolsBackup({ inputs: { '3301': [1, 2] } })],
  ['arkntools', 'decoded JSON', JSON.stringify(arkntoolsBackup)],
  ['arkntools', 'only excluded stages', '{"planStageBlacklist":[]}'],
  [
    'skland',
    'chars',
    JSON.stringify({
      chars: [
        {
          charId: 'char_010_chen',
          level: 70,
          evolvePhase: 2,
          potentialRank: 2,
          mainSkillLvl: 7,
          skills: [{ id: 'skchr_chen_3', specializeLevel: 3 }],
          equip: [],
          defaultEquipId: '',
        },
      ],
    }),
  ],
  ['skland', 'response envelope', '{"code":0,"message":"OK","data":{"chars":[]}}'],
  [
    'maaOperBox',
    'screenshot recognition',
    '[{"id":"char_2024_chyue","name":"重岳","elite":2,"level":90,"own":true,"potential":2,"rarity":6}]',
  ],
  ['maaOperProgress', 'plan', '[{"role":"Warrior","name":"陈","elite":2,"skill_level":7,"skill_mastery":[0,0,3]}]'],
  ['maaOperProgress', 'name only', '[{"name":"陈"}]'],
  ['maaDepot', '明日方舟工具箱', '{"4001":10836,"3003":30}'],
  [
    'maaDepot',
    '企鹅物流刷图规划',
    '{"@type":"@penguin-statistics/depot","items":[{"id":"4001","have":10836,"name":"龙门币"},{"id":"3003","have":30,"name":"赤金"}]}',
  ],
  ['maaDepot', 'CSV', 'ID,Name,Count\r\n4001,龙门币,10836\r\n3003,"赤,金",30'],
  [
    'maaDepot',
    'Markdown',
    '# Arknights Depot Export\n\n| ID | Name | Count |\n| --- | --- | --- |\n| 4001 | 龙门币 | 10836 |\n| 3003 | 赤金 | 30 |',
  ],
]

const cppDump = JSON.stringify({
  '@type': '@orz/cpp/dump',
  '@version': 1,
  game: 'arknights',
  instanceName: '',
  exportedAt: 1763290000000,
  userdata: { current: {}, goal: {}, items: { '4001': 1 }, goalOrder: [], starredTasks: [] },
  preference: { valueType: 'ap', forbiddenStageIds: [] },
  region: 'zh_CN',
})

const unrelated: [string, string][] = [
  ['a Closure++ dump', cppDump],
  ['an empty object', '{}'],
  ['an object of unknown counts', '{"a":1}'],
  ['an empty array', '[]'],
  ['a sentence', '今天也要好好刷图哦'],
  ['a word that looks like base64', 'hello'],
  ['nothing', ''],
]

describe('import format detection', () => {
  it.each(samples)('reads %s (%s) as that format and nothing else', (format, _, text) => {
    for (const [name, detect] of Object.entries(detectors)) {
      if (name === format) {
        expect(detect(text), name).toBeDefined()
      } else {
        expect(detect(text), name).toBeUndefined()
      }
    }
  })

  it.each(unrelated)('reads %s as no format', (_, text) => {
    for (const [name, detect] of Object.entries(detectors)) {
      expect(detect(text), name).toBeUndefined()
    }
  })

  it('needs a depot to hold at least one item cpp knows', () => {
    expect(detectMAADepot('{"4001":1,"abc":2}', isKnownItem)).toEqual({ '4001': 1, abc: 2 })
    expect(detectMAADepot('{"abc":2}', isKnownItem)).toBeUndefined()
    expect(detectMAADepot('名称,类型,数量\n龙门币,货币,1', isKnownItem)).toBeUndefined()
  })

  it('reads a backup that also has item counts as a backup first', () => {
    const text = JSON.stringify({ inputs: { '30012': [1, 2] }, '4001': 5 })
    // 仓库识别也收得下它，所以它必须排在最后
    expect(detectMAADepot(text, isKnownItem)).toEqual({ '4001': 5 })
    expect(Object.keys(detectors).find((name) => detectors[name as Format](text))).toBe('arkntools')
  })
})
