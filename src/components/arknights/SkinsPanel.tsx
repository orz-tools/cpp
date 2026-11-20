import { Button, Callout, Icon, NonIdealState, Tag } from '@blueprintjs/core'
import { useAtom, useSetAtom } from 'jotai'
import { Fragment, memo } from 'react'
import useEvent from 'react-use-event-hook'
import { useGameAdapter } from '../../Cpp'
import { Arknights, ArknightsAdapter } from '../../pkg/cpp-arknights'
import { SkinBrand, SkinPeriod } from '../../pkg/cpp-arknights/skins'
import { gt, lpstr } from '../../pkg/gt'
import { networkAdvice } from '../Err'
import { SidebarPanel } from '../types'
import {
  SkinOwnSwitch,
  SkinSearch,
  SkinToggles,
  periodOrder,
  periodSummary,
  useActivateSkin,
  useMarkingLifetime,
  useNarrowed,
  useOpenSkland,
} from './SkinControls'
import {
  MarkCheck,
  SkinPicture,
  SkinTile,
  VoucherMark,
  acquiredText,
  onButtonKey,
  periodName,
  periodTimeText,
  priceText,
  skinSubtitle,
  untilText,
} from './SkinImages'
import { PanelTimeline, TimelineHead } from './SkinTimeline'
import { SkinsWide } from './SkinsWide'
import {
  SkinModel,
  SkinState,
  markingAtom,
  openBrandsAtom,
  selectedPeriodAtom,
  skinPrefsAtom,
  useSelectedPeriod,
  useSkinFilter,
  useSkinModel,
} from './skinsModel'

function useArknights() {
  return useGameAdapter<Arknights>() as ArknightsAdapter
}

const SkinsToolbar = memo(() => {
  const model = useSkinModel()
  return (
    <Tag minimal className="cpp-skins-total" title={gt.pgettext('skins', '已有 / 全部')}>
      {model.owned}/{model.catalog.skins.length}
    </Tag>
  )
})

const EmptyCallout = memo(({ model }: { model: SkinModel }) => {
  const setMarking = useSetAtom(markingAtom)
  const openSkland = useOpenSkland()
  return (
    <Callout intent="primary" icon={null} compact className="cpp-skins-empty">
      {gt.pgettext('skins', '还没有记下你有哪些时装，下面全算「缺」。')}
      <div className="cpp-skins-empty-actions">
        {model.canImportSkland ? (
          <Button
            size="small"
            intent="primary"
            icon="import"
            text={gt.pgettext('skins', '从森空岛导入')}
            onClick={openSkland}
          />
        ) : null}
        <Button size="small" icon="edit" text={gt.pgettext('skins', '手动标记')} onClick={() => setMarking(true)} />
      </div>
    </Callout>
  )
})

/** 档期图可以收起：它约 230px 高，把品牌墙往下挤 */
const TimelineBlock = memo(({ model }: { model: SkinModel }) => {
  const [prefs, setPrefs] = useAtom(skinPrefsAtom)
  const open = !prefs.timelineCollapsed
  return (
    <div className="cpp-skins-time">
      <TimelineHead open={open} onToggle={() => setPrefs({ ...prefs, timelineCollapsed: open })} now={model.now} />
      {open ? <PanelTimeline model={model} /> : null}
    </div>
  )
})

const BrandRow = memo(
  ({
    model,
    brand,
    shown,
    open,
    onToggle,
    marking,
  }: {
    model: SkinModel
    brand: SkinBrand
    shown: SkinState[]
    open: boolean
    onToggle: (id: string) => void
    marking: boolean
  }) => {
    const ga = useArknights()
    const activate = useActivateSkin()
    let owned = 0
    let obtainable = 0
    for (const skin of brand.skins) {
      const s = model.states.get(skin.id)!
      if (s.owned) owned++
      if (s.obtainable) obtainable++
    }
    const name = brand.name || gt.pgettext('skins', '其他')
    return (
      <div className="cpp-skins-brand">
        <button
          type="button"
          className="cpp-skins-brand-head"
          aria-expanded={open}
          title={brand.capitalName ? `${name} ${brand.capitalName}` : name}
          onClick={() => onToggle(brand.id)}
        >
          <Icon icon={open ? 'chevron-down' : 'chevron-right'} size={14} />
          <span className="cpp-skins-brand-name">{name}</span>
          <span className="cpp-skins-brand-cap">{brand.capitalName}</span>
          {obtainable > 0 ? (
            <span className="cpp-skins-avail" title={gt.pgettext('skins', '缺的里面现在能拿到的件数')}>
              {gt.pgettext('skins', '可获得 %d').replaceAll('%d', String(obtainable))}
            </span>
          ) : null}
          <span className="cpp-skins-brand-count" title={gt.pgettext('skins', '已有 / 全部')}>
            {owned}/{brand.skins.length}
          </span>
        </button>
        <div className="cpp-skins-progress" aria-hidden="true">
          <i style={{ width: `${(owned / brand.skins.length) * 100}%` }} />
        </div>
        {open ? (
          <div className="cpp-skins-wall">
            {shown.map((s) => (
              <SkinTile
                key={s.skin.id}
                state={s}
                character={ga.getCharacter(s.skin.charId)}
                marking={marking}
                now={model.now}
                onActivate={activate}
              />
            ))}
          </div>
        ) : null}
      </div>
    )
  },
)

const BrandWall = memo(({ model, marking }: { model: SkinModel; marking: boolean }) => {
  const filter = useSkinFilter()
  const [openBrands, setOpenBrands] = useAtom(openBrandsAtom)
  const narrowed = useNarrowed()
  const onToggle = useEvent((id: string) => setOpenBrands((x) => ({ ...x, [id]: !x[id] })))
  const rows = model.catalog.brands
    .map((brand) => ({ brand, shown: brand.skins.map((s) => model.states.get(s.id)!).filter(filter) }))
    .filter((x) => x.shown.length > 0)
  if (rows.length === 0) return <NonIdealState icon="search" title={gt.pgettext('skins', '没有符合的时装')} />
  return rows.map(({ brand, shown }) => (
    <BrandRow
      key={brand.id}
      model={model}
      brand={brand}
      shown={shown}
      open={narrowed || !!openBrands[brand.id]}
      onToggle={onToggle}
      marking={marking}
    />
  ))
})

const PeriodRow = memo(({ period, state, marking }: { period: SkinPeriod; state: SkinState; marking: boolean }) => {
  const ga = useArknights()
  const activate = useActivateSkin()
  const w = period.windows.get(state.skin.id)
  const character = ga.getCharacter(state.skin.charId)
  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={marking ? state.owned : undefined}
      className={'cpp-skins-row' + (state.owned ? ' is-owned' : '')}
      onClick={() => activate(state)}
      onKeyDown={onButtonKey}
    >
      <span className="cpp-skins-row-pic">
        <SkinPicture id={state.skin.id} kind="avatar" name={state.skin.name} />
        {/* 渠道就是这一期，右边写着「券」和价格，头像上只打勾 */}
        {state.owned || marking ? <MarkCheck owned={state.owned} /> : null}
      </span>
      <span className="cpp-skins-row-text">
        <span className="cpp-skins-row-name">{state.skin.name}</span>
        <span className="cpp-skins-row-sub">{skinSubtitle(state, character)}</span>
      </span>
      <span className="cpp-skins-row-right">
        {state.owned ? (
          <span className="cpp-skins-muted">{acquiredText(state.acquiredAt ?? 0)}</span>
        ) : (
          <>
            {state.voucher ? <VoucherMark /> : null}
            {w ? <span>{priceText(w)}</span> : null}
          </>
        )}
      </span>
    </div>
  )
})

const PeriodList = memo(({ model, period, marking }: { model: SkinModel; period: SkinPeriod; marking: boolean }) => {
  const filter = useSkinFilter()
  const setSelected = useSetAtom(selectedPeriodAtom)
  const states = period.skinIds
    .map((id) => model.states.get(id)!)
    .filter(filter)
    .sort(periodOrder)
  const parts = [untilText(period.end), periodSummary(model, period), periodTimeText(period, model.now)]
  return (
    <>
      <div className="cpp-skins-period-head">
        <Tag intent="primary" round onRemove={() => setSelected(null)} className="cpp-skins-period-tag">
          {periodName(period)}
        </Tag>
        <span className="cpp-skins-muted">
          {/* 窄的时候在两段之间换行，不把一段拆开 */}
          {parts.filter(Boolean).map((x, i) => (
            <Fragment key={i}>
              {i > 0 ? ' · ' : null}
              <span className="cpp-skins-nowrap">{x}</span>
            </Fragment>
          ))}
        </span>
      </div>
      {states.length === 0 ? <NonIdealState icon="search" title={gt.pgettext('skins', '没有符合的时装')} /> : null}
      {states.map((s) => (
        <PeriodRow key={s.skin.id} period={period} state={s} marking={marking} />
      ))}
    </>
  )
})

const Footer = memo(({ model, marking }: { model: SkinModel; marking: boolean }) => {
  const setMarking = useSetAtom(markingAtom)
  const openSkland = useOpenSkland()
  return (
    <>
      {model.prts.status === 'error' ? (
        <div className="cpp-skins-foot cpp-skins-foot-error">
          <Icon icon="warning-sign" size={12} />
          <span>
            {gt.pgettext('skins', 'PRTS 数据载入失败')}
            <span className="cpp-skins-advice">{networkAdvice()}</span>
          </span>
          <Button variant="minimal" size="small" text={gt.pgettext('skins', '重试')} onClick={model.prts.retry} />
        </div>
      ) : null}
      {marking ? (
        <div className="cpp-skins-foot cpp-skins-foot-marking">
          <Icon icon="edit" size={12} />
          <span>{gt.pgettext('skins', '标记中：点头像切换「已有」和「缺」')}</span>
          <Button size="small" intent="primary" text={gt.pgettext('skins', '完成')} onClick={() => setMarking(false)} />
        </div>
      ) : model.owned > 0 ? (
        <div className="cpp-skins-foot">
          <span>{gt.pgettext('skins', '拥有情况')}</span>
          <span className="cpp-skins-foot-links">
            {model.canImportSkland ? (
              <Button
                variant="minimal"
                size="small"
                intent="primary"
                icon="import"
                text={gt.pgettext('skins', '从森空岛导入')}
                onClick={openSkland}
              />
            ) : null}
            <Button
              variant="minimal"
              size="small"
              intent="primary"
              icon="edit"
              text={gt.pgettext('skins', '手动标记')}
              onClick={() => setMarking(true)}
            />
          </span>
        </div>
      ) : null}
    </>
  )
})

const SkinsBody = memo(() => {
  const model = useSkinModel()
  const period = useSelectedPeriod(model)
  const [marking] = useMarkingLifetime()
  return (
    <div className="cpp-skins-body">
      {/* 手机上这一块整个滚动；底栏留在外面，标记中的「完成」一直看得见 */}
      <div className="cpp-skins-scroll">
        <div className="cpp-skins-filter">
          <SkinOwnSwitch fill />
          <SkinSearch />
          <div className="cpp-skins-toggles">
            <SkinToggles model={model} />
          </div>
        </div>
        {model.owned === 0 && !marking ? <EmptyCallout model={model} /> : null}
        <TimelineBlock model={model} />
        {/* 换一期时从列表顶上开始 */}
        <div className="cpp-skins-list" key={period?.key ?? ''}>
          {period ? (
            <PeriodList model={model} period={period} marking={marking} />
          ) : (
            <BrandWall model={model} marking={marking} />
          )}
        </div>
      </div>
      <Footer model={model} marking={marking} />
    </div>
  )
})

export const skinsPanel: SidebarPanel = {
  id: 'skins',
  icon: 'mugshot',
  label: lpstr(() => gt.pgettext('sidebar panel', '时装')),
  title: lpstr(() => gt.pgettext('sidebar panel', '时装')),
  Body: SkinsBody,
  Toolbar: SkinsToolbar,
  Wide: SkinsWide,
  isAvailable: (ga) => (ga as ArknightsAdapter).hasSkins(),
}
