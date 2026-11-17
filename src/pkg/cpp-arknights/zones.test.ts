import { describe, expect, it } from 'vitest'
import { arknightsChapterLabel, arknightsZoneCategory, arknightsZoneSortKey } from './zones'

describe('arknightsZoneCategory', () => {
  it('maps every zone type to its category', () => {
    expect(arknightsZoneCategory('MAINLINE')).toBe('main')
    expect(arknightsZoneCategory('MAINLINE_ACTIVITY')).toBe('main')
    expect(arknightsZoneCategory('MAINLINE_RETRO')).toBe('main')
    expect(arknightsZoneCategory('ACTIVITY')).toBe('activity')
    expect(arknightsZoneCategory('SIDESTORY')).toBe('sidestory')
    expect(arknightsZoneCategory('BRANCHLINE')).toBe('branchline')
    expect(arknightsZoneCategory('WEEKLY')).toBe('resource')
  })

  it('puts unknown and missing types in other', () => {
    expect(arknightsZoneCategory('CAMPAIGN')).toBe('other')
    expect(arknightsZoneCategory(undefined)).toBe('other')
  })
})

describe('arknightsZoneSortKey', () => {
  it('orders the new-format main story chapters after chapter 14', () => {
    const zones: [string, string, string[]][] = [
      ['permanent_main_3_zone1', 'MAINLINE_RETRO', ['17-3', 'H17-1']],
      ['act3mainss_zone1', 'MAINLINE_ACTIVITY', ['16-2']],
      ['main_14', 'MAINLINE', ['14-1']],
      ['act2mainss_zone1', 'MAINLINE_ACTIVITY', ['15-3', 'H15-1']],
      ['main_9', 'MAINLINE', ['9-1']],
      ['main_0', 'MAINLINE', ['0-1']],
    ]
    const sorted = [...zones]
      .sort((a, b) => {
        const ka = arknightsZoneSortKey(...a)
        const kb = arknightsZoneSortKey(...b)
        return ka < kb ? -1 : ka > kb ? 1 : 0
      })
      .map((x) => x[0])
    expect(sorted).toEqual([
      'main_0',
      'main_9',
      'main_14',
      'act2mainss_zone1',
      'act3mainss_zone1',
      'permanent_main_3_zone1',
    ])
  })

  it('takes the smallest chapter number among the stage codes', () => {
    expect(arknightsZoneSortKey('x', 'MAINLINE_ACTIVITY', ['H15-1', '15-3'])).toBe(
      arknightsZoneSortKey('x', 'MAINLINE_ACTIVITY', ['15-1']),
    )
  })

  it('falls back to the zone id without a chapter, still after every MAINLINE zone', () => {
    const fallback = arknightsZoneSortKey('act9mainss_zone1', 'MAINLINE_ACTIVITY', ['ST-1'])
    expect(fallback).toBe(arknightsZoneSortKey('act9mainss_zone1', 'MAINLINE_RETRO', []))
    expect(fallback > arknightsZoneSortKey('main_14', 'MAINLINE', ['14-1'])).toBe(true)
  })
})

describe('arknightsChapterLabel', () => {
  it("writes a later chapter number in the template's numerals", () => {
    expect(arknightsChapterLabel('第十四章', 14, 15)).toBe('第十五章')
    expect(arknightsChapterLabel('第十四章', 14, 21)).toBe('第二十一章')
    expect(arknightsChapterLabel('第十四章', 14, 10)).toBe('第十章')
    expect(arknightsChapterLabel('Episode 14', 14, 15)).toBe('Episode 15')
    expect(arknightsChapterLabel('에피소드 14', 14, 15)).toBe('에피소드 15')
  })

  it('matches only the whole template number', () => {
    expect(arknightsChapterLabel('第二十四章', 14, 15)).toBeUndefined()
    expect(arknightsChapterLabel('Episode 140', 14, 15)).toBeUndefined()
  })

  it('gives up on a template without its chapter number', () => {
    expect(arknightsChapterLabel('Prologue', 14, 15)).toBeUndefined()
  })

  it('gives up outside 1 to 99', () => {
    expect(arknightsChapterLabel('第十四章', 14, 0)).toBeUndefined()
    expect(arknightsChapterLabel('第十四章', 14, 100)).toBeUndefined()
  })
})
