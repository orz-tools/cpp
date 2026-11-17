import { describe, expect, it } from 'vitest'
import fixture from './__fixtures__/details-quercus.json'
import type { DetailsData } from './details'
import { formatValue, mergeLevelTexts, parseRichText, resolvePlaceholders, richTextToString } from './richText'

const zh = fixture.data as unknown as DetailsData

describe('formatValue', () => {
  it('follows the template formats', () => {
    expect(formatValue(0.4, '0%')).toBe('40%')
    expect(formatValue(0.125, '0.0%')).toBe('12.5%')
    expect(formatValue(-0.3, '0%', true)).toBe('30%')
    expect(formatValue(1.25, '0.0')).toBe('1.3')
    expect(formatValue(2.6, '0')).toBe('3')
    expect(formatValue(0.15000000596046448, undefined)).toBe('0.15')
    expect(formatValue(60, undefined)).toBe('60')
    expect(formatValue(-0.001, '0')).toBe('0')
  })
})

describe('parseRichText', () => {
  it('shows what changes from skill level 7 to mastery 3', () => {
    const skill = zh.skills.skchr_quercu_2
    const template = skill.texts[skill.levels[9].text]
    const segments = parseRichText(template, skill.levels[6].bb, skill.levels[9].bb)
    expect(segments[0]).toEqual({ text: '攻击速度' })
    expect(segments[1]).toEqual({ text: '+45', to: '+60', style: 'vup' })
    expect(segments[3]).toEqual({ text: '1', style: 'vup' })
  })

  it('fills percentages in', () => {
    const skill = zh.skills.skchr_quercu_1
    const segments = parseRichText(skill.texts[0], skill.levels[9].bb)
    expect(segments[1]).toEqual({ text: '+40%', style: 'vup' })
    expect(parseRichText('{-def:0%}', [['def', -0.3]])).toEqual([{ text: '30%' }])
  })

  it('moves a % after a changed value into both values', () => {
    expect(parseRichText('<@ba.vup>+{atk}%</>', [['atk', 10]], [['atk', 20]])).toEqual([
      { text: '+10%', to: '+20%', style: 'vup' },
    ])
  })

  it('reads blackboard keys regardless of case', () => {
    expect(parseRichText('{Attack@ATK_scale:0%}', [['attack@atk_scale', 1.6]])).toEqual([{ text: '160%' }])
  })

  it('shows the key of a value the blackboard lacks', () => {
    expect(parseRichText('造成{atk_scale:0%}伤害', [])).toEqual([{ text: '造成atk_scale伤害' }])
  })

  it('breaks lines at \\n, written either way', () => {
    expect(parseRichText('a\\nb\nc', [])).toEqual([
      { text: 'a' },
      { text: '', br: true },
      { text: 'b' },
      { text: '', br: true },
      { text: 'c' },
    ])
  })

  it('keeps the text of markup it does not know', () => {
    expect(parseRichText('<@ba.talpu>（+2%）</>的<替身>', [])).toEqual([{ text: '（+2%）的<替身>' }])
  })

  it('marks terms, nested styles included', () => {
    expect(parseRichText('获得<$ba.protect>庇护</>', [])).toEqual([
      { text: '获得' },
      { text: '庇护', term: 'ba.protect' },
    ])
    expect(parseRichText('<$ba.root><@ba.vup>束缚</></>效果', [])).toEqual([
      { text: '束缚', term: 'ba.root', style: 'vup' },
      { text: '效果' },
    ])
    expect(parseRichText('<@ba.rem>自身<$ba.stun>晕眩</>{stun}秒</>', [['stun', 5]])).toEqual([
      { text: '自身', style: 'rem' },
      { text: '晕眩', style: 'rem', term: 'ba.stun' },
      { text: '5秒', style: 'rem' },
    ])
  })

  it('styles vdown, kw and rem', () => {
    expect(parseRichText('<@ba.vdown>-1</><@ba.kw>法术</><@cc.rem>注</>', []).map((x) => x.style)).toEqual([
      'vdown',
      'kw',
      'rem',
    ])
  })
})

describe('mergeLevelTexts', () => {
  const label = (level: number, value: string) => `${level} 级 ${value}`
  const join = (first: string, changes: string[]) => `${first}（${changes.join('，')}）`

  function talentText(phase: number) {
    const talent = zh.equips.uniequip_002_quercu.phases[phase].parts[1].talent[0]
    return richTextToString(parseRichText(resolvePlaceholders(talent.upgrade!, talent.bb), []))
  }

  it("merges 夏栎's talent, which only changes a number", () => {
    expect(
      mergeLevelTexts(
        [
          { level: 2, text: talentText(1) },
          { level: 3, text: talentText(2) },
        ],
        label,
        join,
      ),
    ).toEqual({ merged: true, text: '攻击范围内的友军生命大于70%（3 级 60%）时，使其获得16%的庇护' })
  })

  it('lists each later level where a number changes', () => {
    expect(
      mergeLevelTexts(
        [
          { level: 1, text: '+10' },
          { level: 2, text: '+10' },
          { level: 3, text: '+20' },
        ],
        label,
        join,
      ),
    ).toEqual({ merged: true, text: '+10（3 级 20）' })
  })

  it('keeps levels apart when more than numbers differ', () => {
    const entries = [
      { level: 2, text: '生命大于70%时获得庇护' },
      { level: 3, text: '生命大于60%时获得庇护并回复技力' },
    ]
    expect(mergeLevelTexts(entries, label, join)).toEqual({ merged: false, texts: entries })
  })
})
