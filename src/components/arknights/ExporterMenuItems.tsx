import { MenuItem } from '@blueprintjs/core'
import { memo } from 'react'
import useEvent from 'react-use-event-hook'
import { useAtoms, useGameAdapter, useStore } from '../../Cpp'
import { Arknights, Character } from '../../pkg/cpp-arknights'
import { buildMaaOperProgressPlans, formatMaaOperProgressPlans } from '../../pkg/cpp-arknights/maaOperProgress'
import { gt } from '../../pkg/gt'
import { AppToaster } from '../Toaster'

export const ExporterMenuItems = memo(() => {
  const ga = useGameAdapter<Arknights>()
  const store = useStore()
  const atoms = useAtoms<Arknights>()

  const copyMaaPlan = useEvent(async () => {
    const data = store.get(atoms.allDataAtom)
    const { plans, partial, excluded } = buildMaaOperProgressPlans(
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
    toaster.show({
      icon: notes.length > 1 ? 'warning-sign' : 'tick',
      intent: notes.length > 1 ? 'warning' : 'success',
      message: notes.map((x) => <div key={x}>{x}</div>),
      timeout: notes.length > 1 ? 10000 : undefined,
    })
  })

  return (
    <MenuItem icon={'log-out'} text={gt.gettext('复制为 MAA「干员培养」计划')} onClick={() => void copyMaaPlan()} />
  )
})
