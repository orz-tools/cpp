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
function chapterOf(stageCodes: string[]): number | undefined {
  let chapter: number | undefined
  for (const code of stageCodes) {
    const m = /(\d+)-\d/.exec(code)
    if (!m) continue
    const n = Number(m[1])
    if (chapter === undefined || n < chapter) chapter = n
  }
  return chapter
}

export function arknightsZoneSortKey(zoneId: string, type: string | undefined, stageCodes: string[]): string {
  switch (type) {
    case 'MAINLINE':
      return '0 ' + makeNumericSortable(zoneId)
    case 'MAINLINE_ACTIVITY':
    case 'MAINLINE_RETRO': {
      const chapter = chapterOf(stageCodes)
      if (chapter === undefined) return '1 ' + makeNumericSortable(zoneId)
      return '1 ' + makeNumericSortable(String(chapter)) + ' ' + makeNumericSortable(zoneId)
    }
    default:
      return makeNumericSortable(zoneId)
  }
}
