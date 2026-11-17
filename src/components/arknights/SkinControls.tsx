import { Button, InputGroup, SegmentedControl } from '@blueprintjs/core'
import { useAtom, useAtomValue } from 'jotai'
import { memo, useEffect } from 'react'
import useEvent from 'react-use-event-hook'
import { SkinPeriod } from '../../pkg/cpp-arknights/skins'
import { gt } from '../../pkg/gt'
import { useChamber } from '../Chamber'
import { SklandImporterDialog, openSklandDevice } from './SklandImporter'
import {
  OwnFilter,
  SkinModel,
  SkinState,
  markingAtom,
  skinObtainableOnlyAtom,
  skinOrphanOnlyAtom,
  skinOwnFilterAtom,
  skinQueryAtom,
  skinVoucherOnlyAtom,
  useShowSkin,
  useToggleSkinOwned,
} from './skinsModel'

// 面板和大窗口共用的控件

/** 点一件时装：标记中是切换已有 / 缺，否则打开档案 */
export function useActivateSkin() {
  const marking = useAtomValue(markingAtom)
  const show = useShowSkin()
  const toggle = useToggleSkinOwned()
  return useEvent((state: SkinState) => (marking ? toggle(state) : show(state.skin)))
}

export function useOpenSkland() {
  const { add } = useChamber()
  return useEvent(() => add(SklandImporterDialog, { popup: openSklandDevice() }))
}

/** 面板或大窗口卸载时、按 Esc 时退出标记；是否在标记中不记在本机 */
export function useMarkingLifetime() {
  const [marking, setMarking] = useAtom(markingAtom)
  useEffect(() => () => setMarking(false), [setMarking])
  useEffect(() => {
    if (!marking) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMarking(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [marking, setMarking])
  return [marking, setMarking] as const
}

export const SkinOwnSwitch = memo(({ fill }: { fill?: boolean }) => {
  const [own, setOwn] = useAtom(skinOwnFilterAtom)
  return (
    <SegmentedControl
      intent="primary"
      size="small"
      fill={fill}
      value={own}
      onValueChange={(x) => setOwn(x as OwnFilter)}
      options={[
        { label: gt.pgettext('skins', '全部'), value: 'all' },
        { label: gt.pgettext('skins', '缺'), value: 'missing' },
        { label: gt.pgettext('skins', '已有'), value: 'owned' },
      ]}
    />
  )
})

const FilterToggle = memo(
  ({
    on,
    onChange,
    text,
    count,
    title,
  }: {
    on: boolean
    onChange: (on: boolean) => void
    text: string
    count: number
    title: string
  }) => (
    <Button
      variant="minimal"
      size="small"
      active={on}
      intent={on ? 'primary' : undefined}
      aria-pressed={on}
      title={title}
      className="cpp-skins-toggle"
      onClick={() => onChange(!on)}
    >
      {text}
      <span className="cpp-skins-n">{count}</span>
    </Button>
  ),
)

export const SkinToggles = memo(({ model }: { model: SkinModel }) => {
  const [obtainable, setObtainable] = useAtom(skinObtainableOnlyAtom)
  const [voucher, setVoucher] = useAtom(skinVoucherOnlyAtom)
  const [orphan, setOrphan] = useAtom(skinOrphanOnlyAtom)
  return (
    <>
      <FilterToggle
        on={obtainable}
        onChange={setObtainable}
        text={gt.pgettext('skins', '可获得')}
        count={model.obtainableCount}
        title={gt.pgettext('skins', '只看缺的、现在能拿到的')}
      />
      <FilterToggle
        on={voucher}
        onChange={setVoucher}
        text={gt.pgettext('skins', '可用券')}
        count={model.voucherCount}
        title={gt.pgettext('skins', '只看现在能用时装自选凭证兑换的')}
      />
      <FilterToggle
        on={orphan}
        onChange={setOrphan}
        text={gt.pgettext('skins', '有时装没干员')}
        count={model.orphanCount}
        title={gt.pgettext('skins', '只看已有、但干员还没有的时装')}
      />
    </>
  )
})

export const SkinSearch = memo(({ className }: { className?: string }) => {
  const [query, setQuery] = useAtom(skinQueryAtom)
  return (
    <InputGroup
      type="search"
      size="small"
      leftIcon="search"
      className={className}
      placeholder={gt.pgettext('skins', '干员或时装名')}
      aria-label={gt.pgettext('skins', '干员或时装名')}
      value={query}
      onChange={(e) => setQuery(e.currentTarget.value)}
    />
  )
})

/** 搜索或开着开关时，结果不多，有符合的品牌都展开 */
export function useNarrowed() {
  const query = useAtomValue(skinQueryAtom)
  const obtainable = useAtomValue(skinObtainableOnlyAtom)
  const voucher = useAtomValue(skinVoucherOnlyAtom)
  const orphan = useAtomValue(skinOrphanOnlyAtom)
  return obtainable || voucher || orphan || query.trim() !== ''
}

/** 一期的清单：缺的在前，能用券的再往前；已有的排在后面 */
export function periodOrder(a: SkinState, b: SkinState) {
  return Number(a.owned) - Number(b.owned) || Number(b.voucher) - Number(a.voucher)
}

export function missingCount(model: SkinModel, period: SkinPeriod) {
  return period.skinIds.filter((id) => !model.states.get(id)?.owned).length
}

/** 「缺 11/13」 */
export function periodSummary(model: SkinModel, period: SkinPeriod) {
  return gt
    .pgettext('skins', '缺 %1/%2') /* I10N: %1: missing, %2: total */
    .replace('%1', String(missingCount(model, period)))
    .replace('%2', String(period.skinIds.length))
}
