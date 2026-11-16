import deepEqual from 'deep-equal'
import useEvent from 'react-use-event-hook'
import { Preference, useCpp } from '../Cpp'
import { CppDump, parseCppDump } from '../pkg/cpp-core/dump'
import { replaceProfileExtras } from '../pkg/cpp-core/profileExtras'
import { newUserData } from '../pkg/cpp-core/UserData'
import { gt } from '../pkg/gt'
import { formatProfileName } from '../profiles'
import { ImportFormat, useStartImportSession } from './Importer'

export function useCppDumpImportFormat(): ImportFormat {
  const cpp = useCpp()
  const startImportSession = useStartImportSession()
  const label = gt.pgettext('import format', 'Closure++ 用户数据')

  const start = useEvent((dump: CppDump) => {
    const game = cpp.gameAdapter.getCodename()
    const prefix = cpp.storagePrefix
    let replaced: Promise<Record<string, unknown>> | undefined
    const onUndo = () => void replaced?.then((old) => replaceProfileExtras(prefix, old)).catch(console.error)
    const written = startImportSession(
      label,
      () => (draft, ctx) => {
        const userdata: Record<string, unknown> = { ...newUserData(), ...dump.userdata }
        const target = draft as Record<string, unknown>
        for (const key of Object.keys(target)) {
          if (!(key in userdata)) delete target[key]
        }
        Object.assign(target, userdata)

        if (dump.instanceName === cpp.instanceName) {
          ctx.addWarning(gt.gettext('这是 Closure++ 用户数据。'))
        } else if (dump.exportedAt != null) {
          ctx.addWarning(
            gt
              .gettext(
                '这是 Closure++ 从档案 %s$profile 导出的用户数据，导出于 %s$time。',
              ) /* I10N: %s$profile: profile name, %s$time: date and time */
              .replaceAll('%s$profile', formatProfileName(game, dump.instanceName))
              .replaceAll('%s$time', new Date(dump.exportedAt).toLocaleString()),
          )
        } else {
          ctx.addWarning(
            gt
              .gettext('这是 Closure++ 从档案 %s 导出的用户数据。') /* I10N: %s: profile name */
              .replaceAll('%s', formatProfileName(game, dump.instanceName)),
          )
        }

        if (dump.preference) {
          ctx.addWarning(gt.gettext('偏好设置（排除关卡、价值类型等）已一并覆盖，「撤销」不会恢复这一项。'))
          // The game adapter reads its part of the preferences only at start-up (applyPreferenceSnapshot).
          const current = cpp.store.get(cpp.preferenceAtoms.preferenceAtom)
          if (!deepEqual(current.game || {}, dump.preference.game || {})) {
            ctx.addWarning(gt.gettext('价值计算等设置需重新载入页面后生效。'))
          }
        }

        if (dump.region && dump.region !== cpp.region) {
          const regions = cpp.gameAdapterStatic.getRegions() || []
          const regionName = (id: string) => regions.find((x) => x.id === id)?.name ?? id
          ctx.addWarning(
            gt
              .gettext(
                '这份用户数据的区域是 %s$from，当前是 %s$to；区域没有改动，如需切换请使用工具栏上的区域按钮。',
              ) /* I10N: %s$from: region of the data, %s$to: current region */
              .replaceAll('%s$from', regionName(dump.region))
              .replaceAll('%s$to', regionName(cpp.region)),
          )
        }
      },
      { onUndo },
    )
    // Unlike preferences, extras are put back by the import's undo (onUndo above).
    if (written && dump.extras) {
      replaced = replaceProfileExtras(prefix, dump.extras)
      replaced.catch(console.error)
    }
    // Preferences are not user data, so the import's undo cannot take this back; the result dialog says so.
    if (written && dump.preference) {
      cpp.store.set(cpp.preferenceAtoms.preferenceAtom, dump.preference as Preference)
    }
  })

  return {
    label,
    match: (text) => {
      const result = parseCppDump(text, cpp.gameAdapter.getCodename())
      if (!result) return undefined
      if ('dump' in result) return { start: () => start(result.dump) }
      if (result.rejected === 'game') {
        return {
          rejected: gt
            .gettext('这是 Closure++ 的 %s 用户数据，不能导入到当前游戏。') /* I10N: %s: game codename */
            .replaceAll('%s', result.game.toUpperCase()),
        }
      }
      return { rejected: gt.gettext('这份 Closure++ 用户数据的版本无法识别。') }
    },
  }
}
