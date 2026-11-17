import { makeNumericSortable } from '../cpp-basic/sort'

export const ArknightsStageCategory = {
  Main: 'main',
  Activity: 'activity',
  Sidestory: 'sidestory',
  Branchline: 'branchline',
  Resource: 'resource',
  Other: 'other',
} as const

export function arknightsZoneCategory(type: string | undefined): string {
  switch (type) {
    case 'MAINLINE':
    case 'MAINLINE_ACTIVITY':
    case 'MAINLINE_RETRO':
      return ArknightsStageCategory.Main
    case 'ACTIVITY':
      return ArknightsStageCategory.Activity
    case 'SIDESTORY':
      return ArknightsStageCategory.Sidestory
    case 'BRANCHLINE':
      return ArknightsStageCategory.Branchline
    case 'WEEKLY':
      return ArknightsStageCategory.Resource
    default:
      return ArknightsStageCategory.Other
  }
}

// 新格式主线的 zoneId（act2mainss_zone1、permanent_main_3_zone1）与章节号对不上，章节号只能从关卡代号里取
export function arknightsChapterOf(stageCodes: string[]): number | undefined {
  let chapter: number | undefined
  for (const code of stageCodes) {
    const m = /(\d+)-\d/.exec(code)
    if (!m) continue
    const n = Number(m[1])
    if (chapter === undefined || n < chapter) chapter = n
  }
  return chapter
}

const HAN_DIGITS = '〇一二三四五六七八九'

function hanNumber(n: number): string | undefined {
  if (!Number.isInteger(n) || n < 1 || n > 99) return undefined
  const tens = Math.floor(n / 10)
  const ones = n % 10
  return (tens > 1 ? HAN_DIGITS[tens] : '') + (tens > 0 ? '十' : '') + (ones > 0 ? HAN_DIGITS[ones] : '')
}

/**
 * 按 template 写第 templateChapter 章的写法写出第 chapter 章，例如「第十四章」写成「第十五章」，「Episode 14」写成
 * 「Episode 15」。template 里找不到章节号时返回 undefined
 */
export function arknightsChapterLabel(template: string, templateChapter: number, chapter: number): string | undefined {
  const target = hanNumber(chapter)
  const source = hanNumber(templateChapter)
  if (!target || !source) return undefined
  // 只匹配完整的数：「140」里的「14」、「二十四」里的「十四」都不算
  const arabic = new RegExp(`(?<!\\d)${templateChapter}(?!\\d)`)
  if (arabic.test(template)) return template.replace(arabic, String(chapter))
  const han = new RegExp(`(?<![${HAN_DIGITS}十])${source}(?![${HAN_DIGITS}十])`)
  if (han.test(template)) return template.replace(han, target)
  return undefined
}

export function arknightsZoneSortKey(zoneId: string, type: string | undefined, stageCodes: string[]): string {
  switch (type) {
    case 'MAINLINE':
      return '0 ' + makeNumericSortable(zoneId)
    case 'MAINLINE_ACTIVITY':
    case 'MAINLINE_RETRO': {
      const chapter = arknightsChapterOf(stageCodes)
      if (chapter === undefined) return '1 ' + makeNumericSortable(zoneId)
      return '1 ' + makeNumericSortable(String(chapter)) + ' ' + makeNumericSortable(zoneId)
    }
    default:
      return makeNumericSortable(zoneId)
  }
}
