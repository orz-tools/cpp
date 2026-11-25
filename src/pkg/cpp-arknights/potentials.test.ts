import { describe, expect, it } from 'vitest'
import type { PotentialDetail } from './details'
import { potentialReached, potentialSteps, stripIncrements, talentChange } from './potentials'
import { parseRichText } from './richText'

// Texts from the game data of 2026-11-25.

const huang: PotentialDetail = {
  ranks: ['部署费用-1', '第一天赋效果增强', '攻击力+28', '第二天赋效果增强', '部署费用-1'],
  talents: [
    {
      candidates: [
        { potential: 0, name: '紧急除颤', desc: '在生命值低于25%时，仅一次回复50%的生命值并在6秒内使生命值不低于50%' },
        {
          potential: 2,
          name: '紧急除颤',
          desc: '在生命值低于25%时，仅一次回复50%的生命值并在7<@ba.talpu>（+1）</>秒内使生命值不低于50%',
        },
      ],
    },
    {
      candidates: [
        { potential: 0, name: '严酷训练', desc: '在战场停留15秒后获得<$ba.buffres>抵抗</>' },
        { potential: 4, name: '严酷训练', desc: '在战场停留12<@ba.talpu>（-3）</>秒后获得<$ba.buffres>抵抗</>' },
      ],
    },
  ],
}

const amiya: PotentialDetail = {
  ranks: ['生命上限+200', '部署费用-1', '攻击力+30', '部署费用-1', '天赋效果增强'],
  talents: [
    {
      candidates: [
        { potential: 0, name: '情绪吸收', desc: '攻击敌人时额外回复2点技力，消灭敌人后额外获得8点技力' },
        {
          potential: 5,
          name: '情绪吸收',
          desc: '攻击敌人时额外回复3<@ba.talpu>（+1）</>点技力，消灭敌人后额外获得10<@ba.talpu>（+2）</>点技力',
        },
      ],
    },
  ],
}

const amiyaGuard: PotentialDetail = {
  ranks: ['生命上限+200', '部署费用-1', '攻击力+28', '部署费用-1', '防御力+22'],
  talents: [],
}

const lancet: PotentialDetail = {
  ranks: ['天赋效果增强', '天赋效果增强', '天赋效果增强', '天赋效果增强', '天赋效果增强'],
  talents: [
    {
      candidates: ['I', 'II', 'III', 'IV', 'V', 'VI'].map((n, i) => ({
        potential: i,
        name: `救援喷雾·${n}`,
        desc: `部署后立即恢复全场友方单位${200 + 60 * i}点生命`,
      })),
    },
  ],
}

const changes = (detail: PotentialDetail) =>
  potentialSteps(detail).map((step) => [step.potential, step.talents.map((t) => t.name)])

describe('potentialSteps', () => {
  it("lists 煌's potentials, and the talent each one improves", () => {
    const steps = potentialSteps(huang)
    expect(steps.map((s) => [s.potential, s.text])).toEqual([
      [2, '部署费用-1'],
      [3, '第一天赋效果增强'],
      [4, '攻击力+28'],
      [5, '第二天赋效果增强'],
      [6, '部署费用-1'],
    ])
    expect(changes(huang)).toEqual([
      [2, []],
      [3, ['紧急除颤']],
      [4, []],
      [5, ['严酷训练']],
      [6, []],
    ])
    expect(steps[1].talents[0].segments).toEqual([
      { text: '在生命值低于25%时，仅一次回复50%的生命值并在' },
      { text: '6', to: '7' },
      { text: '秒内使生命值不低于50%' },
    ])
    expect(steps[3].talents[0].segments).toEqual([
      { text: '在战场停留' },
      { text: '15', to: '12' },
      { text: '秒后获得' },
      { text: '抵抗', term: 'ba.buffres' },
    ])
  })

  it("keeps Amiya's forms apart: only the caster's talent changes", () => {
    const steps = potentialSteps(amiya)
    expect(changes(amiya).at(-1)).toEqual([6, ['情绪吸收']])
    expect(steps[4].talents[0].segments!.filter((s) => s.to !== undefined)).toEqual([
      { text: '2', to: '3' },
      { text: '8', to: '10' },
    ])
    expect(potentialSteps(amiyaGuard).map((s) => s.talents)).toEqual([[], [], [], [], []])
    expect(potentialSteps(amiyaGuard)[4].text).toBe('防御力+22')
  })

  it("follows Lancet-2's talent through every potential, its name too", () => {
    const steps = potentialSteps(lancet)
    expect(steps.map((s) => s.talents.map((t) => t.name))).toEqual([
      ['救援喷雾·II'],
      ['救援喷雾·III'],
      ['救援喷雾·IV'],
      ['救援喷雾·V'],
      ['救援喷雾·VI'],
    ])
    expect(steps.map((s) => s.talents[0].segments!.find((x) => x.to !== undefined))).toEqual([
      { text: '200', to: '260' },
      { text: '260', to: '320' },
      { text: '320', to: '380' },
      { text: '380', to: '440' },
      { text: '440', to: '500' },
    ])
  })

  it('has no text before a talent that a potential unlocks', () => {
    const detail: PotentialDetail = {
      ranks: ['部署费用-1', '天赋效果增强'],
      talents: [{ candidates: [{ potential: 2, name: '新天赋', desc: '攻击力+<@ba.vup>10%</>' }] }],
    }
    expect(potentialSteps(detail)[1].talents).toEqual([
      { name: '新天赋', segments: parseRichText('攻击力+<@ba.vup>10%</>') },
    ])
  })

  it('writes the name alone when the talent has no text', () => {
    const detail: PotentialDetail = {
      ranks: ['天赋效果增强'],
      talents: [
        {
          candidates: [
            { potential: 0, name: '天赋', desc: '10秒' },
            { potential: 1, name: '天赋', desc: null },
          ],
        },
      ],
    }
    expect(potentialSteps(detail)[0].talents).toEqual([{ name: '天赋', segments: null }])
  })

  it('lists nothing for an operator without potential', () => {
    expect(potentialSteps({ ranks: [], talents: [] })).toEqual([])
  })
})

describe('talentChange', () => {
  it('moves the sign and the % into both sides (浊心斯卡蒂)', () => {
    const segments = talentChange(
      '自身或海嗣攻击范围内存在我方干员时，自身攻击力+6%；存在【深海猎人】干员时改为攻击力+15%',
      '自身或海嗣攻击范围内存在我方干员时，自身攻击力+9%<@ba.talpu>（+3%）</>；存在【深海猎人】干员时改为攻击力+18%<@ba.talpu>（+3%）</>',
    )
    expect(segments).toEqual([
      { text: '自身或海嗣攻击范围内存在我方干员时，自身攻击力' },
      { text: '+6%', to: '+9%' },
      { text: '；存在【深海猎人】干员时改为攻击力' },
      { text: '+15%', to: '+18%' },
    ])
  })

  it('drops the increment with the space before it (en_US 煌)', () => {
    const segments = talentChange(
      'Gains <$ba.buffres>status resistance</> after being deployed for 15 seconds',
      'Gains <$ba.buffres>status resistance</> after being deployed for 12 <@ba.talpu>(-3)</> seconds',
    )
    expect(segments).toEqual([
      { text: 'Gains ' },
      { text: 'status resistance', term: 'ba.buffres' },
      { text: ' after being deployed for ' },
      { text: '15', to: '12' },
      { text: ' seconds' },
    ])
  })

  it('keeps a value the increment is wrapped with (en_US Pozëmka)', () => {
    const segments = talentChange(
      "Attacks from the 'Typewriter' reduce the target's DEF by 18% for 4 seconds; if the 'Typewriter' is placed within the 4 tiles adjacent to Pozëmka, this effect increases to 23%",
      "Attacks from the 'Typewriter' reduce the target's DEF by 20% <@ba.talpu>(+2%)</> for 5 <@ba.talpu>(+1)</> seconds; if the 'Typewriter' is placed within the 4 tiles adjacent to Pozëmka, this effect increases to <@ba.talpu>25% (+2%)</>",
    )
    expect(segments!.filter((s) => s.to !== undefined)).toEqual([
      { text: '18%', to: '20%' },
      { text: '4', to: '5' },
      { text: '23%', to: '25%' },
    ])
    expect(segments!.at(-2)!.text).toMatch(/this effect increases to $/)
    expect(segments!.at(-1)).toEqual({ text: '23%', to: '25%' })
  })

  it('writes the text after the potential when the wording changes (远山)', () => {
    const after =
      '部署后随机永久获得下列一项增益：攻击力+15%<@ba.talpu>（+2%）</>；攻击速度+15<@ba.talpu>（+2）</>；生命上限+22%<@ba.talpu>（+2%）</>'
    const segments = talentChange('部署后随机永久获得下列一项增益：攻击力+13%；攻击速度+13；生命上限提升20%', after)
    expect(segments).toEqual(parseRichText(after))
    expect(segments).toContainEqual({ text: '（+2%）', style: 'vup' })
  })

  it('writes the text after the potential when only the wording changes (地灵)', () => {
    const after = '稍微延长特性<$ba.sluggish>停顿</>的持续时间'
    expect(talentChange('略微延长特性<$ba.sluggish>停顿</>的持续时间', after)).toEqual(parseRichText(after))
  })

  it('writes the text after the potential when no number changes (en_US Gravel)', () => {
    const after = 'DP Cost -1; All units that cost 10 or less DP gain +6% <@ba.talpu>(+2%)</> DEF'
    expect(talentChange('DP Cost -1; All units that cost 10 or less DP gain +6% DEF', after)).toEqual(
      parseRichText(after),
    )
  })

  it("leaves a number in a tag's name alone", () => {
    expect(talentChange('<$ba.dt.apoptosis2>凋亡</>损伤10', '<$ba.dt.apoptosis2>凋亡</>损伤12')).toEqual([
      { text: '凋亡', term: 'ba.dt.apoptosis2' },
      { text: '损伤' },
      { text: '10', to: '12' },
    ])
  })

  it('takes the text after the potential when there is none before, and nothing when there is none after', () => {
    expect(talentChange(null, '7<@ba.talpu>（+1）</>秒')).toEqual(parseRichText('7<@ba.talpu>（+1）</>秒'))
    expect(talentChange('6秒', null)).toBeNull()
  })
})

describe('stripIncrements', () => {
  it('drops full-width and half-width increments', () => {
    expect(stripIncrements('7<@ba.talpu>（+1）</>秒')).toBe('7秒')
    expect(stripIncrements('2.5%<@ba.talpu>（+0.5%）</>的生命')).toBe('2.5%的生命')
    expect(stripIncrements('7<@ba.talpu>(+1)</> seconds')).toBe('7 seconds')
    expect(stripIncrements('cooldown 10<@ba.talpu>(+1s)</>.')).toBe('cooldown 10.')
  })

  it('drops the space before the increment, keeping one between the words', () => {
    expect(stripIncrements('for 12 <@ba.talpu>(-3)</> seconds')).toBe('for 12 seconds')
    expect(stripIncrements('by 20% <@ba.talpu>(+2%)</> for')).toBe('by 20% for')
    expect(stripIncrements('increases to <@ba.talpu>25% (+2%)</>')).toBe('increases to 25%')
  })

  it('keeps the text of a run without an increment, and other markup', () => {
    expect(stripIncrements('<@ba.talpu>25%</>的<$ba.buffres>抵抗</>（持续10秒）')).toBe(
      '25%的<$ba.buffres>抵抗</>（持续10秒）',
    )
  })
})

describe('potentialReached', () => {
  it('counts potentialRank from 0 for 潜能 1', () => {
    expect(potentialReached(0, 2)).toBe(false)
    expect(potentialReached(1, 2)).toBe(true)
    expect(potentialReached(4, 6)).toBe(false)
    expect(potentialReached(5, 6)).toBe(true)
  })
})
