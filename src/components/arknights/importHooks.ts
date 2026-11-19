import { Draft } from 'immer'
import { pick, pickBy } from 'ramda'
import useEvent from 'react-use-event-hook'
import { useCpp, useGameAdapter } from '../../Cpp'
import { Arknights, ArknightsAdapter } from '../../pkg/cpp-arknights'
import {
  ArkntoolsBackup,
  isArkntoolsStageBlacklistDifferent,
  mergeArkntoolsBackup,
} from '../../pkg/cpp-arknights/arkntools'
import { MAAOperBox, mergeMAAOperBox } from '../../pkg/cpp-arknights/maa'
import { MaaOperProgressPlanInput, mergeMaaOperProgressPlans } from '../../pkg/cpp-arknights/maaOperProgress'
import {
  SklandCharacterNotFoundError,
  SklandInput,
  mergeSklandData,
  nextSklandSnapshot,
  readSklandSnapshot,
  sklandUid,
} from '../../pkg/cpp-arknights/skland'
import { loadProfileExtras, saveProfileExtra } from '../../pkg/cpp-core/profileExtras'
import { UserData } from '../../pkg/cpp-core/UserData'
import { gt } from '../../pkg/gt'
import { ImportContext, useStartImportSession } from '../Importer'

export const importFormatLabels = {
  arkntools: () => gt.pgettext('import format', '明日方舟工具箱「精英材料计算」备份'),
  skland: () => gt.pgettext('import format', '森空岛数据'),
  maaOperBox: () => gt.pgettext('import format', 'MAA「干员识别」数据'),
  maaOperProgress: () => gt.pgettext('import format', 'MAA「干员培养」计划'),
  maaDepot: () => gt.pgettext('import format', 'MAA「仓库识别」数据'),
}

const pickRetainableItems = pick([
  '4001', // 龙门币
  '4006', // 采购凭证
])

export function useMAADepotImport() {
  const ga = useGameAdapter<Arknights>()
  const startImportSession = useStartImportSession()
  return useEvent((data: Record<string, number>) =>
    startImportSession(importFormatLabels.maaDepot(), () => {
      return (draft: Draft<UserData<Arknights>>, ctx: ImportContext) => {
        void ctx

        const quans = Object.fromEntries(
          Object.entries(data).filter(([key, value]) => {
            return !!ga.getItem(key) && key[0] !== '#' && typeof value === 'number'
          }),
        )

        const list = new Set(
          Object.keys(ga.getInventoryPages())
            .map((x) => ga.getInventoryItems(x))
            .flat()
            .map((x) => x.key),
        )
        const pickByNotInTheList = pickBy<Record<string, number>>((_, k) => !list.has(k))

        draft.items = {
          ...quans,
          ...pickRetainableItems(draft.items),
          ...pickByNotInTheList(draft.items),
        }
      }
    }),
  )
}

export function useMAAOperBoxImport() {
  const ga = useGameAdapter<Arknights>() as ArknightsAdapter
  const startImportSession = useStartImportSession()
  return useEvent((opers: MAAOperBox) =>
    startImportSession(importFormatLabels.maaOperBox(), () => {
      const empty = ga.getUserDataAdapter().getFrozenEmptyCharacterStatus()
      return (draft: Draft<UserData<Arknights>>, ctx: ImportContext) => {
        const { unknown, hasDetails } = mergeMAAOperBox(ga, draft.current, empty, opers)
        if (!hasDetails) {
          ctx.addWarning(
            gt.gettext(
              'MAA「干员识别」的截图识别结果只有精英化、等级和潜能，不含技能等级、专精和模组；这些保持导入前的值，请自行核对。',
            ),
          )
        }
        if (unknown.length > 0) {
          ctx.addWarning(
            gt
              .gettext(
                '尚不支持这些干员，已跳过：%s。可能游戏数据尚未更新，请静候数据更新。游戏数据通常需要 2~24 小时解析。',
              ) /* I10N: %s: character names */
              .replaceAll('%s', unknown.join(gt.pgettext('list separator', '、'))),
          )
        }
      }
    }),
  )
}

export function useMaaOperProgressImport() {
  const ga = useGameAdapter<Arknights>() as ArknightsAdapter
  const startImportSession = useStartImportSession()
  return useEvent((plans: MaaOperProgressPlanInput[]) =>
    startImportSession(importFormatLabels.maaOperProgress(), () => {
      const uda = ga.getUserDataAdapter()
      const characters = uda.getAllCharacterIds().map((x) => ga.getCharacter(x))
      const empty = uda.getFrozenEmptyCharacterStatus()
      return (draft: Draft<UserData<Arknights>>, ctx: ImportContext) => {
        const { unknown, invalid, inferred } = mergeMaaOperProgressPlans(characters, draft, empty, plans)
        const sep = gt.pgettext('list separator', '、')
        if (inferred.length > 0) {
          ctx.addWarning(
            gt
              .gettext(
                '这些干员在 cpp 中尚未持有，已按计划所需的最低状态设为持有，请自行核对：%s。',
              ) /* I10N: %s: character names */
              .replaceAll('%s', inferred.map((x) => ga.getCharacter(x).name).join(sep)),
          )
        }
        if (invalid.length > 0) {
          ctx.addWarning(
            gt
              .gettext(
                '这些干员的目标超出了可培养的上限（精英化次数或技能），已跳过：%s。',
              ) /* I10N: %s: character names */
              .replaceAll('%s', invalid.join(sep)),
          )
        }
        if (unknown.length > 0) {
          ctx.addWarning(
            gt
              .gettext(
                '认不出这些干员，已跳过：%s。cpp 只认识简体中文名、西文代号和当前区服语言的名字；如果是新干员，可能游戏数据尚未更新。',
              ) /* I10N: %s: character names */
              .replaceAll('%s', unknown.join(sep)),
          )
        }
      }
    }),
  )
}

export function useArkntoolsImport() {
  const cpp = useCpp<Arknights>()
  const ga = cpp.gameAdapter as ArknightsAdapter
  const startImportSession = useStartImportSession()
  return useEvent((backup: ArkntoolsBackup) =>
    startImportSession(importFormatLabels.arkntools(), () => {
      const empty = ga.getUserDataAdapter().getFrozenEmptyCharacterStatus()
      return (draft: Draft<UserData<Arknights>>, ctx: ImportContext) => {
        const { unknown, inferred } = mergeArkntoolsBackup(ga, draft, empty, backup, (id) => !!ga.getItem(id))
        if (inferred.length > 0) {
          ctx.addWarning(
            gt
              .gettext(
                '这些干员在 cpp 中尚未持有，已按明日方舟工具箱计划的起点设为持有，等级按计划所需的最低值填写，请自行核对：%s。',
              ) /* I10N: %s: character names */
              .replaceAll('%s', inferred.map((x) => ga.getCharacter(x).name).join(gt.pgettext('list separator', '、'))),
          )
        }
        if (unknown.length > 0) {
          ctx.addWarning(
            gt
              .gettext(
                '尚不支持这些干员，已跳过：%s。可能游戏数据尚未更新，请静候数据更新。游戏数据通常需要 2~24 小时解析。',
              ) /* I10N: %s: character names */
              .replaceAll('%s', unknown.join(gt.pgettext('list separator', '、'))),
          )
        }
        if (backup.planStageBlacklist) {
          const stageCodes = Object.fromEntries(
            Object.values(ga.getStageInfos()).map((x) => [x.id, x.rawCode] as const),
          )
          const forbidden = cpp.store.get(cpp.preferenceAtoms.forbiddenStageIdsAtom)
          // 排除关卡是偏好而不是用户数据，撤销不了，所以不导入，只在与当前设置不同时提示
          if (isArkntoolsStageBlacklistDifferent(backup.planStageBlacklist, forbidden, stageCodes)) {
            ctx.addWarning(
              gt
                .ngettext(
                  '备份中排除了 %d 个关卡，与 cpp 当前的设置不同；排除关卡没有导入，如需一致请在「关卡」菜单中自行设置。',
                  '备份中排除了 %d 个关卡，与 cpp 当前的设置不同；排除关卡没有导入，如需一致请在「关卡」菜单中自行设置。',
                  backup.planStageBlacklist.length,
                ) /* I10N: %d: number */
                .replaceAll('%d', String(backup.planStageBlacklist.length)),
            )
          }
        }
      }
    }),
  )
}

class CharacterNotFoundError extends Error {
  public friendly: string
  public constructor(key: string) {
    super(`Character Not Found: ${key}`)
    this.name = 'CharacterNotFoundError'
    this.friendly = gt
      .gettext(
        '尚不支持这名干员：%s。可能游戏数据尚未更新，请静候数据更新。游戏数据通常需要 2~24 小时解析。',
      ) /* I10N: %s: character key */
      .replaceAll('%s', key)
  }
}

export function useSklandImport() {
  const ga = useGameAdapter<Arknights>() as ArknightsAdapter
  const cpp = useCpp()
  const startImportSession = useStartImportSession()
  return useEvent(async ({ data, raw }: SklandInput) => {
    const prefix = cpp.storagePrefix
    // 先读旧快照再开会话：UID 不同的提示要在结果对话框打开时就在
    const stored = await loadProfileExtras(prefix).then(
      (extras) => extras.skland,
      (e) => console.error(e),
    )
    const previous = readSklandSnapshot(stored)
    const uid = sklandUid(raw)

    const written = startImportSession(
      importFormatLabels.skland(),
      () => {
        const empty = ga.getUserDataAdapter().getFrozenEmptyCharacterStatus()
        return (draft: Draft<UserData<Arknights>>, ctx: ImportContext) => {
          let result
          try {
            result = mergeSklandData(ga, draft, empty, data)
          } catch (e) {
            if (e instanceof SklandCharacterNotFoundError) throw new CharacterNotFoundError(e.key)
            throw e
          }
          if (result.ambiguousEquip) {
            ctx.addWarning(gt.gettext('森空岛的数据分不清模组是未解锁还是 1 级，这些模组保持导入前的值，请自行核对。'))
          }
          if (result.trainingAmiya) {
            ctx.addWarning(
              gt.gettext('森空岛的数据分不清训练室里的阿米娅是哪个升变形态，正在训练的专精没有计入，请自行核对。'),
            )
          }
          if (result.trainingError) {
            ctx.addWarning(
              gt.gettext('解析训练室数据失败，正在训练的专精没有计入。请尽量把下面的信息发给开发者：') +
                '\n' +
                result.trainingError,
            )
          }
          if (uid && previous?.uid && uid !== previous.uid) {
            ctx.addWarning(
              gt
                .gettext(
                  '这份森空岛数据的 UID 是 %s$new，与这个档案上次导入的 %s$old 不同；如果导入错了档案，请点「撤销」。',
                ) /* I10N: %s$new: UID in this data, %s$old: UID imported into this profile before */
                .replaceAll('%s$new', uid)
                .replaceAll('%s$old', previous.uid),
            )
          }
        }
      },
      // 写回原先存的东西本身，哪怕 readSklandSnapshot 不认它的形状
      { onUndo: () => void saveProfileExtra(prefix, 'skland', stored).catch(console.error) },
    )
    if (written) {
      void saveProfileExtra(prefix, 'skland', nextSklandSnapshot(previous, raw, Date.now())).catch(console.error)
    }
    return written
  })
}
