import { MenuItem } from '@blueprintjs/core'
import { memo } from 'react'
import useEvent from 'react-use-event-hook'
import { useAtoms, useCpp, useGameAdapter, useStore } from '../../Cpp'
import { Arknights, ArknightsAdapter, Character } from '../../pkg/cpp-arknights'
import {
  arkntoolsCodesFromStageIds,
  buildArkntoolsBackup,
  encodeArkntoolsBackup,
} from '../../pkg/cpp-arknights/arkntools'
import { buildMaaOperProgressPlans, formatMaaOperProgressPlans } from '../../pkg/cpp-arknights/maaOperProgress'
import { gt } from '../../pkg/gt'
import { AppToaster } from '../Toaster'

export const ExporterMenuItems = memo(() => {
  const ga = useGameAdapter<Arknights>()
  const store = useStore()
  const atoms = useAtoms<Arknights>()

  const copyMaaPlan = useEvent(async () => {
    const data = store.get(atoms.allDataAtom)
    const { plans, partial, excluded, special } = buildMaaOperProgressPlans(
      data.goalOrder,
      data.current,
      data.goal,
      (key) => ga.getCharacter(key) as Character | undefined,
    )

    const toaster = await AppToaster
    if (plans.length === 0) {
      toaster.show({ icon: 'info-sign', message: gt.gettext('计划中没有 MAA「干员培养」能执行的目标') })
      return
    }

    try {
      await navigator.clipboard.writeText(formatMaaOperProgressPlans(plans))
    } catch {
      toaster.show({ icon: 'error', intent: 'danger', message: gt.gettext('无法写入剪贴板') })
      return
    }

    const notes = [
      gt
        .ngettext(
          '已复制 %d 名干员的培养计划，请在 MAA「干员培养」中点击「从剪贴板读取」。',
          '已复制 %d 名干员的培养计划，请在 MAA「干员培养」中点击「从剪贴板读取」。',
          plans.length,
        ) /* I10N: %d: number */
        .replaceAll('%d', String(plans.length)),
    ]
    if (partial > 0) {
      notes.push(
        gt
          .ngettext(
            '%d 名干员的等级或模组目标 MAA 不能执行，未包含在内。',
            '%d 名干员的等级或模组目标 MAA 不能执行，未包含在内。',
            partial,
          ) /* I10N: %d: number */
          .replaceAll('%d', String(partial)),
      )
    }
    if (excluded > 0) {
      notes.push(
        gt
          .ngettext(
            '%d 名干员尚未持有或是阿米娅，没有导出。',
            '%d 名干员尚未持有或是阿米娅，没有导出。',
            excluded,
          ) /* I10N: %d: number */
          .replaceAll('%d', String(excluded)),
      )
    }
    if (special > 0) {
      notes.push(
        gt
          .ngettext(
            '%d 名特殊干员靠集成战略的任务养成，MAA 不能执行，没有导出。',
            '%d 名特殊干员靠集成战略的任务养成，MAA 不能执行，没有导出。',
            special,
          ) /* I10N: %d: number */
          .replaceAll('%d', String(special)),
      )
    }
    toaster.show({
      icon: notes.length > 1 ? 'warning-sign' : 'tick',
      intent: notes.length > 1 ? 'warning' : 'success',
      message: notes.map((x) => <div key={x}>{x}</div>),
      timeout: notes.length > 1 ? 10000 : undefined,
    })
  })

  const cpp = useCpp<Arknights>()
  const copyArkntoolsBackup = useEvent(async () => {
    const aga = ga as ArknightsAdapter
    const uda = aga.getUserDataAdapter()
    const dm = aga.getDataManager()
    const stageCodes = Object.fromEntries(Object.values(aga.getStageInfos()).map((x) => [x.id, x.rawCode] as const))
    const forbiddenStageIds = store.get(cpp.preferenceAtoms.forbiddenStageIdsAtom)
    const { backup, presets, partial, excluded, special } = buildArkntoolsBackup(
      store.get(atoms.allDataAtom),
      uda.getFrozenEmptyCharacterStatus(),
      (key) => aga.getCharacter(key) as Character | undefined,
      (key, current, goal) => uda.generateTasksForCharacter(key, current, goal).flatMap((x) => x.requires),
      arkntoolsCodesFromStageIds(forbiddenStageIds, stageCodes),
    )

    const toaster = await AppToaster
    try {
      await navigator.clipboard.writeText(encodeArkntoolsBackup(backup))
    } catch {
      toaster.show({ icon: 'error', intent: 'danger', message: gt.gettext('无法写入剪贴板') })
      return
    }

    const notes = [
      gt
        .ngettext(
          '已复制含 %d 项干员计划的备份，请在明日方舟工具箱「精英材料计算」中点击「导入」→「恢复」并粘贴。恢复会覆盖明日方舟工具箱中现有的计划和库存。',
          '已复制含 %d 项干员计划的备份，请在明日方舟工具箱「精英材料计算」中点击「导入」→「恢复」并粘贴。恢复会覆盖明日方舟工具箱中现有的计划和库存。',
          presets,
        ) /* I10N: %d: number */
        .replaceAll('%d', String(presets)),
    ]
    // The stage codes come from the penguin matrix; without it no excluded stage can be named.
    if (dm.isMissing(dm.$penguin) && forbiddenStageIds.length > 0) {
      notes.push(gt.gettext('企鹅物流的掉落数据没有载入，排除的关卡没有导出。'))
    }
    if (partial > 0) {
      notes.push(
        gt
          .ngettext(
            '%d 名干员的等级目标明日方舟工具箱不计算，未包含在内。',
            '%d 名干员的等级目标明日方舟工具箱不计算，未包含在内。',
            partial,
          ) /* I10N: %d: number */
          .replaceAll('%d', String(partial)),
      )
    }
    if (excluded > 0) {
      notes.push(
        gt
          .ngettext(
            '%d 名一、二星干员在明日方舟工具箱中没有养成数据，没有导出。',
            '%d 名一、二星干员在明日方舟工具箱中没有养成数据，没有导出。',
            excluded,
          ) /* I10N: %d: number */
          .replaceAll('%d', String(excluded)),
      )
    }
    if (special > 0) {
      notes.push(
        gt
          .ngettext(
            '%d 名特殊干员靠集成战略的任务养成，不消耗材料，没有导出。',
            '%d 名特殊干员靠集成战略的任务养成，不消耗材料，没有导出。',
            special,
          ) /* I10N: %d: number */
          .replaceAll('%d', String(special)),
      )
    }
    toaster.show({
      icon: notes.length > 1 ? 'warning-sign' : 'tick',
      intent: notes.length > 1 ? 'warning' : 'success',
      message: notes.map((x) => <div key={x}>{x}</div>),
      timeout: 10000,
    })
  })

  return (
    <>
      <MenuItem icon={'log-out'} text={gt.gettext('复制为 MAA「干员培养」计划')} onClick={() => void copyMaaPlan()} />
      <MenuItem
        icon={'log-out'}
        text={gt.gettext('复制为明日方舟工具箱「精英材料计算」备份')}
        onClick={() => void copyArkntoolsBackup()}
      />
    </>
  )
})
