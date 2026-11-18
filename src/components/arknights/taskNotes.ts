import type { Arknights, ArknightsAdapter } from '../../pkg/cpp-arknights'
import { type SpecialOperator, levelExp, nodeForTask } from '../../pkg/cpp-arknights/specialOperators'
import type { IGameAdapter, Task } from '../../pkg/cpp-basic'
import { gt } from '../../pkg/gt'
import type { TaskNote } from '../types'
import { countText } from './statusEditor/text'

/** 档案「特勤任务」页的 id；记在 cpp_dossier 里，发布之后不能改 */
export const SPECIAL_OPERATOR_SECTION = 'specialOperator'

/** 「特勤任务」页里一行的框选目标；key 是 SoNode 或 SoExpRow 的 key */
export function soFrame(charId: string, key: string) {
  return `so:${charId}:${key}`
}

/** 「集成战略：沉沦者的黑流树海」 */
export function soTopicText(so: SpecialOperator) {
  // I10N: %1: game mode, e.g. 集成战略; %2: its topic, e.g. 沉沦者的黑流树海
  const text = gt.pgettext('special operator', '%1：%2')
  return text.replace('%1', so.mode).replace('%2', so.topic)
}

/** 特殊干员的每条任务下面写出解锁它的那条游戏任务；等级任务写要多少特勤经验 */
export function taskNotes(ga: IGameAdapter<any>, task: Task<any>): TaskNote[] {
  const so = (ga as ArknightsAdapter).getCharacter(task.charId)?.specialOperator
  if (!so) return []
  const type = (task as Task<Arknights>).type
  if (type._ === 'level') {
    // I10N: %s: game mode and topic, e.g. 集成战略：沉沦者的黑流树海
    const title = gt.pgettext('special operator', '特殊干员的等级靠%s里的探索得分按比例换成的特勤经验')
    return [
      {
        key: 'exp',
        icon: 'trending-up',
        text: gt
          .pgettext('special operator', '特勤经验 %s') /* I10N: %s: special operator experience a level task takes */
          .replace('%s', countText(levelExp(so, type.elite, type.from, type.to))),
        title: title.replace('%s', soTopicText(so)),
        dossier: { section: SPECIAL_OPERATOR_SECTION, frame: soFrame(so.charId, `exp${type.elite}`) },
      },
    ]
  }
  const node = nodeForTask(so, type)
  if (!node) return []
  return [
    {
      key: 'mission',
      icon: 'flag',
      text: node.mission.text,
      title: node.mission.full,
      dossier: { section: SPECIAL_OPERATOR_SECTION, frame: soFrame(so.charId, node.key) },
    },
  ]
}
