import type { CharacterLevel } from '../../../pkg/cpp-arknights'
import type { Prerequisite } from '../../../pkg/cpp-arknights/statusEdit'
import { gt } from '../../../pkg/gt'

export function eliteName(elite: number) {
  return [
    gt.pgettext('arknights status group', '精零'),
    gt.pgettext('arknights status group', '精一'),
    gt.pgettext('arknights status group', '精二'),
  ][elite]
}

export function eliteLevelText({ elite, level }: CharacterLevel) {
  return gt
    .pgettext('arknights status editor', '%s %d') /* I10N: %s: elite phase, e.g. 精二; %d: level */
    .replaceAll('%s', eliteName(elite))
    .replaceAll('%d', `${level}`)
}

export function skillLevelText(skillLevel: number, mastery: number) {
  if (mastery > 0) {
    return gt
      .pgettext('arknights status editor', '专精 %d') /* I10N: %d: mastery, 1-3 */
      .replaceAll('%d', `${mastery}`)
  }
  return gt
    .pgettext('arknights status editor', '%d 级') /* I10N: %d: skill or module level */
    .replaceAll('%d', `${skillLevel}`)
}

export function percentText(share: number) {
  return `${(share * 100).toFixed(1)}%`
}

export function countText(n: number) {
  return Math.round(n).toLocaleString('en-US')
}

export function prerequisiteText(p: Prerequisite, forMod: boolean) {
  // I10N: %s: elite and level, e.g. 精二 50
  const toModUnlock = gt.pgettext('arknights status editor', '还会把等级提到 %s（模组解锁）')
  // I10N: %s: elite and level, e.g. 精二 1
  const toLevel = gt.pgettext('arknights status editor', '还会把等级提到 %s')
  // I10N: follows 还会把等级提到 …; %d: skill level
  const andSkillLevel = gt.pgettext('arknights status editor', '技能等级提到 %d')
  // I10N: %d: skill level
  const toSkillLevel = gt.pgettext('arknights status editor', '还会把技能等级提到 %d')

  const parts: string[] = []
  if (p.eliteLevel) {
    parts.push((forMod ? toModUnlock : toLevel).replaceAll('%s', eliteLevelText(p.eliteLevel)))
  }
  if (p.skillLevel) {
    parts.push((parts.length ? andSkillLevel : toSkillLevel).replaceAll('%d', `${p.skillLevel}`))
  }
  return parts.join(gt.pgettext('arknights status editor', '，')) /* I10N: separates two parts of one hint */
}
