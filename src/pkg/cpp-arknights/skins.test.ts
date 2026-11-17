import { describe, expect, it } from 'vitest'
import {
  DAY,
  ExShop,
  ExSkin,
  OTHER_BRAND,
  SkinWindow,
  availableWindows,
  buildSkinCatalog,
  canUseVoucher,
  defaultSkins,
  groupWindows,
  isAvailable,
  matchesQuery,
  mergeWindows,
  packLanes,
  periodsOf,
  replaceSkins,
  setSkinsOwned,
  shopWindowsFromGame,
  windowsFromPrts,
} from './skins'

const T0 = 1_700_000_000 // 发售的那一刻，秒

type RawSkin = NonNullable<ExSkin['charSkins']>['']

function raw(
  skinId: string,
  opts: Partial<RawSkin['displaySkin']> & { dynIllust?: boolean; tmplId?: string | null } = {},
): RawSkin {
  const { dynIllust = false, tmplId = null, ...display } = opts
  return {
    skinId,
    charId: skinId.split('@')[0],
    tmplId,
    dynIllust,
    displaySkin: {
      skinName: skinId,
      skinGroupId: 'g_witch',
      skinGroupName: '巫异盛宴',
      sortId: 1,
      getTime: T0,
      obtainApproach: '采购中心',
      displayTagId: null,
      ...display,
    },
  }
}

function exSkin(skins: RawSkin[], extra: Partial<ExSkin> = {}): ExSkin {
  return {
    buildinEvolveMap: {},
    buildinPatchMap: {},
    charSkins: Object.fromEntries(skins.map((s) => [s.skinId, s])),
    brandList: {
      witch: { brandId: 'witch', brandName: '巫异盛宴', brandCapitalName: 'WITCH FEAST', sortId: 2, groupList: [] },
      sale: { brandId: 'sale', brandName: '忒斯特收藏', brandCapitalName: null, sortId: 1, groupList: [] },
    },
    ...extra,
  }
}

const base = exSkin([
  raw('char_a@witch#1'),
  raw('char_b@witch#1', { getTime: T0 - 400 * 86400 }),
  raw('char_c@witch#1', { obtainApproach: '活动获得' }),
  raw('char_d@sale#1', { skinGroupId: 'g_sale', skinGroupName: '忒斯特收藏/II', sortId: 0 }),
  raw('char_e@nobrand#1', { skinGroupId: 'g_lost', skinGroupName: '孤儿' }),
])
base.brandList!.witch.groupList = [{ skinGroupId: 'g_witch' }]
base.brandList!.sale.groupList = [{ skinGroupId: 'g_sale' }]
const catalog = buildSkinCatalog({ base, local: null })

function tab(tagName: string, skins: ExShop['recommendList'][0]['skins'], start = T0, end = T0 + 14 * 86400) {
  return { tagName, startDatetime: start, endDatetime: end, skins }
}

function win(skinId: string, w: Partial<SkinWindow> = {}): SkinWindow {
  return {
    skinId,
    kind: 'first',
    n: 0,
    channel: 'shop',
    start: T0 * 1000,
    end: (T0 + 14 * 86400) * 1000,
    price: null,
    unit: null,
    ...w,
  }
}

describe('buildSkinCatalog', () => {
  it('sorts brands, puts skins without a brand last, and reads the voucher kind', () => {
    expect(catalog.brands.map((b) => b.id)).toEqual(['sale', 'witch', OTHER_BRAND])
    expect(catalog.brands[1].skins.map((s) => s.id)).toEqual(['char_b@witch#1', 'char_a@witch#1', 'char_c@witch#1'])
    expect(catalog.byId.get('char_a@witch#1')).toMatchObject({ inStore: true, voucherType: true, brandId: 'witch' })
    expect(catalog.byId.get('char_c@witch#1')).toMatchObject({ inStore: false, voucherType: false })
  })

  it('rules out animated art and collaborations for vouchers', () => {
    const c = buildSkinCatalog({
      base: exSkin([raw('char_a@witch#1', { dynIllust: true }), raw('char_b@witch#1', { displayTagId: '联动获得' })]),
      local: null,
    })
    expect(c.skins.map((s) => s.voucherType)).toEqual([false, false])
  })

  it('lists the region’s own skins in its language, and judges vouchers by zh_CN', () => {
    const local = exSkin([
      raw('char_a@witch#1', { skinName: 'Elegy', skinGroupName: 'Witch Feast', obtainApproach: 'Store' }),
    ])
    const c = buildSkinCatalog({ base, local })
    expect(c.skins.map((s) => [s.id, s.name, s.groupName, s.voucherType])).toEqual([
      ['char_a@witch#1', 'Elegy', 'Witch Feast', true],
    ])
  })
})

describe('defaultSkins', () => {
  it('lists each elite phase’s art once', () => {
    const s = exSkin([], { buildinEvolveMap: { char_x: { '0': 'char_x#1', '1': 'char_x#1', '2': 'char_x#2' } } })
    expect(defaultSkins(s, 'char_x')).toEqual([
      { id: 'char_x#1', elite: 0, tmplId: null },
      { id: 'char_x#2', elite: 2, tmplId: null },
    ])
  })

  it('adds Amiya’s other forms', () => {
    const s = exSkin([], {
      buildinEvolveMap: {
        char_002_amiya: { '0': 'char_002_amiya#1', '1': 'char_002_amiya#1+', '2': 'char_002_amiya#2' },
      },
      buildinPatchMap: {
        char_002_amiya: { char_1001_amiya2: 'char_1001_amiya2#2', char_1037_amiya3: 'char_1037_amiya3#2' },
      },
    })
    expect(defaultSkins(s, 'char_002_amiya')).toEqual([
      { id: 'char_002_amiya#1', elite: 0, tmplId: null },
      { id: 'char_002_amiya#1+', elite: 1, tmplId: null },
      { id: 'char_002_amiya#2', elite: 2, tmplId: null },
      { id: 'char_1001_amiya2#2', elite: null, tmplId: 'char_1001_amiya2' },
      { id: 'char_1037_amiya3#2', elite: null, tmplId: 'char_1037_amiya3' },
    ])
  })
})

describe('shopWindowsFromGame', () => {
  const shop = (recommendList: ExShop['recommendList'], carousels: ExShop['carousels'] = []) =>
    shopWindowsFromGame({ recommendList, carousels }, catalog)

  it('reads a tab that names its skins, with the rerun number from the good id', () => {
    const w = shop([
      tab('巫异盛宴/IV', [
        { skinId: 'char_a@witch#1', goodId: 'SS_char_a@witch#1' },
        { skinId: 'char_b@witch#1', goodId: 'SS_char_b@witch#1_r2' },
      ]),
    ])
    expect(w.map((x) => [x.skinId, x.kind, x.n, x.channel])).toEqual([
      ['char_a@witch#1', 'first', 0, 'shop'],
      ['char_b@witch#1', 'rerun', 2, 'shop'],
    ])
    expect(w[0]).toMatchObject({ start: T0 * 1000, end: (T0 + 14 * 86400) * 1000 })
  })

  it('reads a tab titled after a series as its store-bought skins', () => {
    expect(shop([tab('巫异盛宴', [])]).map((x) => x.skinId)).toEqual(['char_a@witch#1', 'char_b@witch#1'])
  })

  it('counts nothing for a brand tab or 罗德岛风尚回顾', () => {
    expect(shop([tab('忒斯特收藏', []), tab('罗德岛风尚回顾', [])])).toEqual([])
  })

  it('skips a tab without a start, or one that ends before it starts', () => {
    expect(shop([tab('巫异盛宴', [], 0), tab('巫异盛宴', [], T0, T0 - 1)])).toEqual([])
  })

  it('reads carousel slots, once when a tab sells the same skin', () => {
    const w = shop(
      [tab('巫异盛宴/IV', [{ skinId: 'char_a@witch#1', goodId: null }])],
      [
        { skinId: 'char_a@witch#1', startTime: T0 + 60, endTime: T0 + 7 * 86400 },
        { skinId: 'char_d@sale#1', startTime: T0, endTime: T0 + 7 * 86400 },
      ],
    )
    expect(w.map((x) => x.skinId)).toEqual(['char_a@witch#1', 'char_d@sale#1'])
  })

  it('tells a first sale from a rerun by the release time when there is no good id', () => {
    const w = shop([tab('巫异盛宴/IV', [{ skinId: 'char_a@witch#1', goodId: null }], T0 + 3600)])
    const r = shop([
      tab('巫异盛宴/IV', [{ skinId: 'char_a@witch#1', goodId: null }], T0 + 86400 * 300, T0 + 86400 * 314),
    ])
    expect(w[0].kind).toBe('first')
    expect(r[0]).toMatchObject({ kind: 'rerun', n: 0 })
  })
})

describe('mergeWindows', () => {
  it('joins windows that open within a day, taking the game data’s times', () => {
    const game = [win('char_a@witch#1', { start: 1000, end: 50_000 })]
    const prts = windowsFromPrts({
      skins: {
        'char_a@witch#1': {
          windows: [{ kind: 'rerun', n: 3, channel: 'shop', start: 30, end: 40, price: '18', unit: null }],
          noVoucher: false,
          dynamic: false,
        },
      },
    })
    expect(mergeWindows(game, prts)).toEqual([
      win('char_a@witch#1', { kind: 'rerun', n: 3, start: 1000, end: 50_000, price: '18' }),
    ])
  })

  it('keeps what only one side has, sorted by start', () => {
    const game = [win('a', { start: 5 * DAY }), win('b', { start: 0 })]
    const prts = [win('a', { start: 3 * DAY }), win('a', { channel: 'retro', kind: 'retro', start: 5 * DAY })]
    expect(mergeWindows(game, prts).map((x) => [x.skinId, x.channel, x.start])).toEqual([
      ['b', 'shop', 0],
      ['a', 'shop', 3 * DAY],
      ['a', 'retro', 5 * DAY],
      ['a', 'shop', 5 * DAY],
    ])
  })
})

describe('availability and vouchers', () => {
  const skin = catalog.byId.get('char_a@witch#1')!
  const now = 10 * DAY

  it('treats a window without an end as permanent, and one whose end just passed as over', () => {
    expect(isAvailable(win('a', { start: 0, end: null }), now)).toBe(true)
    expect(isAvailable(win('a', { start: 0, end: now }), now)).toBe(true)
    expect(isAvailable(win('a', { start: 0, end: now - 1 }), now)).toBe(false)
    expect(isAvailable(win('a', { start: now + 1, end: null }), now)).toBe(false)
    expect(availableWindows([win('a', { start: 0, end: now - 1 }), win('a', { start: 0, end: null })], now)).toEqual([
      win('a', { start: 0, end: null }),
    ])
  })

  it('needs a store sale now, the voucher kind, and not owning it', () => {
    const shop = [win(skin.id, { start: 0, end: now + DAY })]
    expect(canUseVoucher(skin, shop, false, now)).toBe(true)
    expect(canUseVoucher(skin, [win(skin.id, { channel: 'retro', start: 0, end: now })], false, now)).toBe(true)
    expect(canUseVoucher(skin, [win(skin.id, { channel: 'certificate', start: 0, end: null })], false, now)).toBe(false)
    expect(canUseVoucher({ ...skin, voucherType: false }, shop, false, now)).toBe(false)
    expect(canUseVoucher(skin, shop, true, now)).toBe(false)
  })
})

describe('periodsOf', () => {
  it('groups sales by channel, lane and times, and permanent channels by channel', () => {
    const now = 10 * DAY
    const periods = periodsOf(
      groupWindows([
        win('a', { start: DAY, end: 20 * DAY }),
        win('b', { start: DAY, end: 20 * DAY }),
        win('c', { kind: 'rerun', start: DAY, end: 20 * DAY }),
        win('a', { channel: 'retro', kind: 'retro', start: 2 * DAY, end: 15 * DAY }),
        win('d', { channel: 'certificate', start: 3 * DAY, end: null }),
        win('e', { channel: 'certificate', start: 0, end: null }),
        win('f', { channel: 'milestone', start: now + DAY, end: null }),
      ]),
      now,
    )
    expect(periods.map((p) => [p.key, p.lane, p.skinIds])).toEqual([
      ['certificate:open', null, ['d', 'e']],
      [`shop:first:${DAY}:${20 * DAY}`, 'first', ['a', 'b']],
      [`shop:rerun:${DAY}:${20 * DAY}`, 'rerun', ['c']],
      [`retro:retro:${2 * DAY}:${15 * DAY}`, 'retro', ['a']],
    ])
  })
})

describe('packLanes', () => {
  it('puts each period into the first row that has ended before it', () => {
    const p = [
      { start: 0, end: 10 },
      { start: 5, end: 8 },
      { start: 11, end: 20 },
      { start: 9, end: 12 },
    ]
    const { rows, placed } = packLanes(p)
    expect(rows).toBe(2)
    expect(placed.map((x) => [x.period.start, x.row])).toEqual([
      [0, 0],
      [5, 1],
      [9, 1],
      [11, 0],
    ])
    expect(packLanes(p, 2).rows).toBe(3)
  })
})

describe('matchesQuery', () => {
  it('matches the skin, its series, and the operator’s names, in any case', () => {
    const skin = { ...catalog.byId.get('char_a@witch#1')!, name: '挽歌' }
    const op = { name: '夜莺', appellation: 'Nightingale' }
    expect(['挽歌', '巫异', '夜莺', 'night', ''].map((q) => matchesQuery(skin, op, q))).toEqual([
      true,
      true,
      true,
      true,
      true,
    ])
    expect(matchesQuery(skin, op, '陈')).toBe(false)
  })
})

describe('owned skins', () => {
  it('replaces them with the Skland list, counting what came and went', () => {
    const draft = { skins: { 'a@x#1': 0, 'b@x#1': 100 } as Record<string, number> }
    const result = replaceSkins(draft, [
      { id: 'b@x#1', ts: 200 },
      { id: 'c@x#1', ts: 300 },
      { id: 'char_x#1', ts: 1 },
    ])
    expect(result).toEqual({ added: 1, removed: 1 })
    expect(draft.skins).toEqual({ 'b@x#1': 200, 'c@x#1': 300 })
  })

  it('keeps the acquired time of a skin marked owned again, and records 0 for a new one', () => {
    const draft = { skins: { 'a@x#1': 100 } as Record<string, number> }
    setSkinsOwned(draft, ['a@x#1', 'b@x#1'], true)
    expect(draft.skins).toEqual({ 'a@x#1': 100, 'b@x#1': 0 })
    setSkinsOwned(draft, ['a@x#1'], false)
    expect(draft.skins).toEqual({ 'b@x#1': 0 })
  })
})
