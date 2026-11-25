import { describe, expect, it, vi } from 'vitest'
import type { DataContainerObject, IDataContainer } from '../dccache'
import { ArknightsKengxxiaoDetailsObject } from './DataObjects'
import fixture from './__fixtures__/details-quercus.json'
import {
  Details,
  DetailsData,
  DetailsLoader,
  getBuildingBuffDetail,
  getEquipDetail,
  getPotentialDetail,
  getSkillDetail,
  getSkillLevel,
  getTermDetail,
  pickCandidate,
  skillLevelIndex,
} from './details'

vi.mock('localforage', () => ({
  default: {
    dropInstance: () => Promise.resolve(),
    createInstance: () => ({ removeItem: () => Promise.resolve() }),
  },
}))

const zh = fixture.data as unknown as DetailsData

describe('skillLevelIndex', () => {
  it('maps skill levels to 0–6 and masteries to 7–9', () => {
    expect(skillLevelIndex(1, 0)).toBe(0)
    expect(skillLevelIndex(7, 0)).toBe(6)
    expect(skillLevelIndex(7, 1)).toBe(7)
    expect(skillLevelIndex(7, 3)).toBe(9)
  })
})

describe('reading details', () => {
  it('reads a skill level', () => {
    const skill = getSkillDetail({ local: null, base: zh }, 'skchr_quercu_2')!
    const m3 = getSkillLevel(skill, 7, 3)!
    expect(m3.level).toMatchObject({ spCost: 25, initSp: 15, duration: 17 })
    expect(m3.level.bb).toContainEqual(['attack_speed', 60])
    expect(m3.text).toContain('{attack_speed}')
  })

  it('has no level past the last one', () => {
    const skill = { ...zh.skills.skchr_quercu_2, levels: zh.skills.skchr_quercu_2.levels.slice(0, 7) }
    expect(getSkillLevel(skill, 7, 1)).toBeNull()
  })

  it('prefers the local language and falls back to zh_CN', () => {
    const local: DetailsData = {
      skills: { skchr_quercu_2: { ...zh.skills.skchr_quercu_2, texts: ['ASPD +{attack_speed}'] } },
      equips: {},
      terms: {},
      buildingBuffs: {},
      potentials: {},
    }
    const details: Details = { local, base: zh }
    expect(getSkillDetail(details, 'skchr_quercu_2')!.texts).toEqual(['ASPD +{attack_speed}'])
    expect(getSkillDetail(details, 'skchr_quercu_1')).toBe(zh.skills.skchr_quercu_1)
    expect(getEquipDetail(details, 'uniequip_002_quercu')).toBe(zh.equips.uniequip_002_quercu)
    expect(getTermDetail(details, 'ba.protect')!.name).toBe('庇护')
  })

  it('returns null for what neither has', () => {
    const details: Details = { local: null, base: zh }
    expect(getSkillDetail(details, 'skchr_nobody_1')).toBeNull()
    expect(getEquipDetail(details, 'uniequip_002_nobody')).toBeNull()
    expect(getSkillDetail(details, 'toString')).toBeNull()
  })
})

describe('getBuildingBuffDetail', () => {
  const zhBuff = {
    text: '进驻制造站时，生产力<@cc.vup>+15%</>',
    effects: [{ k: 'flat' as const, m: 'prod' as const, v: 15 }],
  }
  const base: DetailsData = { ...zh, buildingBuffs: { 'manu_prod_spd[000]': zhBuff, 'manu_prod_spd[010]': zhBuff } }

  it("takes the region's text and effects together when it has the skill", () => {
    // en_US has its own text but no effects: zh_CN's are not borrowed
    const enBuff = { text: 'When this Operator is assigned to a Factory, productivity <@cc.vup>+15%</>' }
    const local: DetailsData = {
      skills: {},
      equips: {},
      terms: {},
      buildingBuffs: { 'manu_prod_spd[000]': enBuff },
      potentials: {},
    }
    const details: Details = { local, base }
    expect(getBuildingBuffDetail(details, 'manu_prod_spd[000]')).toBe(enBuff)
    expect(getBuildingBuffDetail(details, 'manu_prod_spd[010]')).toBe(zhBuff)
    expect(getBuildingBuffDetail(details, 'manu_nobody[000]')).toBeNull()
  })

  it('reads a copy from before base skills as having none', () => {
    const old = { skills: {}, equips: {}, terms: {} } as unknown as DetailsData
    expect(getBuildingBuffDetail({ local: null, base: old }, 'manu_prod_spd[000]')).toBeNull()
  })
})

describe('getPotentialDetail', () => {
  const empty = { skills: {}, equips: {}, terms: {}, buildingBuffs: {} }
  const zhHuang = {
    ranks: ['部署费用-1', '第一天赋效果增强', '攻击力+28', '第二天赋效果增强', '部署费用-1'],
    talents: [],
  }
  const zhAmiya2 = { ranks: ['生命上限+200', '部署费用-1', '攻击力+28', '部署费用-1', '防御力+22'], talents: [] }
  const base: DetailsData = { ...empty, potentials: { char_017_huang: zhHuang, char_1001_amiya2: zhAmiya2 } }

  it("takes the region's entry when it has the operator, otherwise zh_CN's", () => {
    const enHuang = { ranks: ['DP Cost -1', 'Improves First Talent', 'ATK +28', 'Improves Second Talent'], talents: [] }
    const local: DetailsData = { ...empty, potentials: { char_017_huang: enHuang } }
    const details: Details = { local, base }
    expect(getPotentialDetail(details, 'char_017_huang')).toBe(enHuang)
    expect(getPotentialDetail(details, 'char_1001_amiya2')).toBe(zhAmiya2)
  })

  it('returns null when neither has the operator', () => {
    expect(getPotentialDetail({ local: null, base }, 'char_9999_nobody')).toBeNull()
    expect(getPotentialDetail({ local: null, base }, 'toString')).toBeNull()
  })

  it('reads a copy from before potentials as having none', () => {
    const old = empty as unknown as DetailsData
    expect(getPotentialDetail({ local: null, base: old }, 'char_017_huang')).toBeNull()
    expect(getPotentialDetail({ local: old, base }, 'char_017_huang')).toBe(zhHuang)
  })
})

describe('pickCandidate', () => {
  const talent = zh.equips.uniequip_002_quercu.phases[1].parts[1].talent

  it('takes the highest candidate the potential reaches', () => {
    expect(talent.map((x) => x.potential)).toEqual([0, 4])
    expect(pickCandidate(talent, 0)).toBe(talent[0])
    expect(pickCandidate(talent, 3)).toBe(talent[0])
    expect(pickCandidate(talent, 4)).toBe(talent[1])
    expect(pickCandidate(talent, 5)).toBe(talent[1])
  })

  it('takes the first without a recorded potential', () => {
    expect(pickCandidate(talent, undefined)).toBe(talent[0])
  })

  it('returns null when there is none', () => {
    expect(pickCandidate([], 5)).toBeNull()
    expect(pickCandidate([{ potential: 2 }], 1)).toBeNull()
  })
})

describe('DetailsLoader', () => {
  const base = new ArknightsKengxxiaoDetailsObject('zh_CN')
  const local = new ArknightsKengxxiaoDetailsObject('en_US')

  // 'v2@1' is version v2 of schema 1; without @ the schema is 3
  function container(obj: DataContainerObject<any>, version: string): IDataContainer<DetailsData> {
    const [id, schema = '3'] = version.split('@')
    return {
      '@type': '@orz/cpp/data-container',
      '@version': 1,
      name: obj.name,
      version: { id, text: id, timestamp: 1, sources: [], schema: Number(schema) },
      data: obj === base ? zh : { skills: {}, equips: {}, terms: {}, buildingBuffs: {}, potentials: {} },
    }
  }

  function fakeLoad(versions: Record<string, string[]>) {
    const calls: [string, boolean | undefined][] = []
    const load = vi.fn((obj: DataContainerObject<any>, refresh?: boolean) => {
      calls.push([obj.name, refresh])
      const next = versions[obj.name].shift()
      if (!next) return Promise.reject(new Error('offline'))
      return Promise.resolve(container(obj, next))
    })
    return { load: load as any, calls }
  }

  it('reads once when the version matches the game data, and keeps the result', async () => {
    const { load, calls } = fakeLoad({ [base.name]: ['v2'] })
    const loader = new DetailsLoader(load)
    const a = await loader.get({ obj: base, versionId: 'v2' }, null)
    const b = await loader.get({ obj: base, versionId: 'v2' }, null)
    expect(a.base).toBe(zh)
    expect(b).toBe(a)
    expect(calls).toEqual([[base.name, undefined]])
  })

  it('refreshes once when the stored copy lags, and keeps what it gets', async () => {
    const { load, calls } = fakeLoad({ [base.name]: ['v1', 'v1'] })
    const loader = new DetailsLoader(load)
    const d = await loader.get({ obj: base, versionId: 'v2' }, null)
    expect(d.base).toBe(zh)
    expect(calls).toEqual([
      [base.name, undefined],
      [base.name, true],
    ])
  })

  it('refreshes once a stored copy from before base skills, even of the same version', async () => {
    const { load, calls } = fakeLoad({ [base.name]: ['v2@1', 'v2'] })
    const loader = new DetailsLoader(load)
    await loader.get({ obj: base, versionId: 'v2' }, null)
    expect(calls).toEqual([
      [base.name, undefined],
      [base.name, true],
    ])
  })

  it('refreshes once a stored copy from before potentials, even of the same version', async () => {
    const { load, calls } = fakeLoad({ [base.name]: ['v2@2', 'v2'] })
    const loader = new DetailsLoader(load)
    await loader.get({ obj: base, versionId: 'v2' }, null)
    expect(calls).toEqual([
      [base.name, undefined],
      [base.name, true],
    ])
  })

  it('loads the local language beside zh_CN', async () => {
    const { load, calls } = fakeLoad({ [base.name]: ['v2'], [local.name]: ['l2'] })
    const loader = new DetailsLoader(load)
    const d = await loader.get({ obj: base, versionId: 'v2' }, { obj: local, versionId: 'l2' })
    expect(d.local).toEqual({ skills: {}, equips: {}, terms: {}, buildingBuffs: {}, potentials: {} })
    expect(calls).toHaveLength(2)
  })

  it('loads again when the game data moves on', async () => {
    const { load, calls } = fakeLoad({ [base.name]: ['v1', 'v2'] })
    const loader = new DetailsLoader(load)
    await loader.get({ obj: base, versionId: 'v1' }, null)
    await loader.get({ obj: base, versionId: 'v2' }, null)
    expect(calls).toEqual([
      [base.name, undefined],
      [base.name, undefined],
    ])
  })

  it('keeps the lagging copy when checking it for an update fails, and does not check again', async () => {
    const { load, calls } = fakeLoad({ [base.name]: ['v1'] })
    const loader = new DetailsLoader(load)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const d = await loader.get({ obj: base, versionId: 'v2' }, null)
    expect(d.base).toBe(zh)
    expect(await loader.get({ obj: base, versionId: 'v2' }, null)).toBe(d)
    expect(calls).toEqual([
      [base.name, undefined],
      [base.name, true],
    ])
    expect(warn).toHaveBeenCalledOnce()
    warn.mockRestore()
  })

  it('forgets a failed load, so a retry downloads again', async () => {
    const versions = { [base.name]: [] as string[] }
    const { load, calls } = fakeLoad(versions)
    const loader = new DetailsLoader(load)
    await expect(loader.get({ obj: base, versionId: 'v2' }, null)).rejects.toThrow('offline')
    versions[base.name].push('v2')
    await expect(loader.get({ obj: base, versionId: 'v2' }, null)).resolves.toMatchObject({ base: zh })
    expect(calls).toHaveLength(2)
  })
})
