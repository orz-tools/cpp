import { Button, HTMLSelect, Icon, NonIdealState } from '@blueprintjs/core'
import { format } from 'date-fns'
import { useAtom, useSetAtom } from 'jotai'
import { memo, useEffect, useRef } from 'react'
import { useGameAdapter } from '../../Cpp'
import { Arknights, ArknightsAdapter } from '../../pkg/cpp-arknights'
import { SkinPeriod } from '../../pkg/cpp-arknights/skins'
import { gt } from '../../pkg/gt'
import {
  SkinOwnSwitch,
  SkinSearch,
  SkinToggles,
  missingCount,
  periodOrder,
  useActivateSkin,
  useMarkingLifetime,
  useOpenSkland,
} from './SkinControls'
import {
  SkinMarks,
  SkinPicture,
  acquiredText,
  channelName,
  channelTone,
  formatMinute,
  onButtonKey,
  periodName,
  periodTimeText,
  priceText,
  readLabel,
  skinSubtitle,
  stateText,
  untilText,
} from './SkinImages'
import { TimelineHead, TimelineToggle, WideGantt } from './SkinTimeline'
import {
  SkinModel,
  SkinState,
  WideSort,
  selectedPeriodAtom,
  skinPrefsAtom,
  useSelectedPeriod,
  useSkinFilter,
  useSkinModel,
  wideSortAtom,
} from './skinsModel'

function useArknights() {
  return useGameAdapter<Arknights>() as ArknightsAdapter
}

const yearMonth = (ms: number) => format(ms, 'yyyy-MM')

const SkinCard = memo(({ state, marking, now }: { state: SkinState; marking: boolean; now: number }) => {
  const ga = useArknights()
  const activate = useActivateSkin()
  const character = ga.getCharacter(state.skin.charId)
  const w = state.owned ? undefined : state.available[0]
  const sub = skinSubtitle(state, character)
  const status = stateText(state, now)
  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={marking ? state.owned : undefined}
      aria-label={readLabel(state.skin.name, sub, status)}
      title={`${state.skin.name}\n${sub}\n${status}`}
      className="cpp-skins-card"
      onClick={() => activate(state)}
      onKeyDown={onButtonKey}
    >
      <span className="cpp-skins-card-pic">
        <SkinPicture id={state.skin.id} kind="portrait" name={state.skin.name} />
        <SkinMarks state={state} marking={marking} />
      </span>
      <span className="cpp-skins-card-name">{state.skin.name}</span>
      <span className="cpp-skins-card-sub">{sub}</span>
      {state.owned ? (
        <span className="cpp-skins-card-state cpp-skins-muted">{acquiredText(state.acquiredAt ?? 0)}</span>
      ) : w ? (
        <span className={`cpp-skins-card-state cpp-skins-tone-${channelTone(w.channel)}`}>
          {[channelName(w.channel), priceText(w)].filter(Boolean).join(' ')}
          <br />
          {untilText(w.end)}
        </span>
      ) : (
        <span className="cpp-skins-card-state cpp-skins-muted">{gt.pgettext('skins', '暂时拿不到')}</span>
      )}
    </div>
  )
})

interface CardGroup {
  key: string
  title: string
  note?: string
  /** 按品牌排时，品牌的第一组带上品牌，左边点品牌格子时滚到这里 */
  brand?: { id: string; name: string; capitalName: string | null; owned: number; total: number }
  states: SkinState[]
}

function groupCards(model: SkinModel, sort: WideSort, keep: (s: SkinState) => boolean): CardGroup[] {
  const groups: CardGroup[] = []
  const byKey = new Map<string, CardGroup>()
  const add = (key: string, make: () => Omit<CardGroup, 'states'>, s: SkinState) => {
    let g = byKey.get(key)
    if (!g) {
      byKey.set(key, (g = { ...make(), states: [] }))
      groups.push(g)
    }
    g.states.push(s)
  }

  if (sort === 'brand') {
    for (const brand of model.catalog.brands) {
      const all = brand.skins.map((x) => model.states.get(x.id)!)
      const shown = all.filter(keep)
      let first = true
      for (const s of shown) {
        const series = s.skin.groupName || brand.name
        add(
          `${brand.id}\n${series}`,
          () => {
            const g: Omit<CardGroup, 'states'> = {
              key: `${brand.id}\n${series}`,
              title: series,
              note: yearMonth(s.skin.releasedAt),
            }
            if (first) {
              first = false
              g.brand = {
                id: brand.id,
                name: brand.name || gt.pgettext('skins', '其他'),
                capitalName: brand.capitalName,
                owned: all.filter((x) => x.owned).length,
                total: all.length,
              }
            }
            return g
          },
          s,
        )
      }
    }
    return groups
  }

  const shown = [...model.states.values()].filter(keep)
  if (sort === 'release') {
    shown.sort((a, b) => b.skin.releasedAt - a.skin.releasedAt || b.skin.sortId - a.skin.sortId)
    for (const s of shown) {
      const ym = yearMonth(s.skin.releasedAt)
      add(ym, () => ({ key: ym, title: ym }), s)
    }
    return groups
  }

  // 按获得时间：新的在前，不知道获得时间的一组，缺的放在最后
  const rank = (s: SkinState) => (s.owned ? (s.acquiredAt ? 0 : 1) : 2)
  shown.sort((a, b) => rank(a) - rank(b) || (b.acquiredAt ?? 0) - (a.acquiredAt ?? 0))
  for (const s of shown) {
    if (!s.owned) add('missing', () => ({ key: 'missing', title: gt.pgettext('skins', '缺') }), s)
    else if (!s.acquiredAt) add('unknown', () => ({ key: 'unknown', title: gt.pgettext('skins', '不知道获得时间') }), s)
    else {
      const ym = yearMonth(s.acquiredAt * 1000)
      add(ym, () => ({ key: ym, title: ym }), s)
    }
  }
  return groups
}

const CardWall = memo(({ model, marking }: { model: SkinModel; marking: boolean }) => {
  const filter = useSkinFilter()
  const [sort] = useAtom(wideSortAtom)
  const groups = groupCards(model, sort, filter)
  if (groups.length === 0) return <NonIdealState icon="search" title={gt.pgettext('skins', '没有符合的时装')} />
  return groups.map((g) => (
    <section key={g.key} data-brand={g.brand?.id}>
      {g.brand ? (
        <div className="cpp-skins-wide-brand">
          <h3>{g.brand.name}</h3>
          <span className="cpp-skins-brand-cap">{g.brand.capitalName}</span>
          <span className="cpp-skins-muted">
            {g.brand.owned}/{g.brand.total}
          </span>
        </div>
      ) : null}
      <h4 className="cpp-skins-wide-group">
        {g.title}
        {g.note ? <span className="cpp-skins-muted">{g.note}</span> : null}
        <span className="cpp-skins-muted">{g.states.length}</span>
      </h4>
      <div className="cpp-skins-cards">
        {g.states.map((s) => (
          <SkinCard key={s.skin.id} state={s} marking={marking} now={model.now} />
        ))}
      </div>
    </section>
  ))
})

const PeriodCards = memo(({ model, period, marking }: { model: SkinModel; period: SkinPeriod; marking: boolean }) => {
  const filter = useSkinFilter()
  const setSelected = useSetAtom(selectedPeriodAtom)
  const states = period.skinIds
    .map((id) => model.states.get(id)!)
    .filter(filter)
    .sort(periodOrder)
  const miss = missingCount(model, period)
  const when = period.end == null ? untilText(null) : `${formatMinute(period.start)} – ${formatMinute(period.end)}`
  return (
    <>
      <div className="cpp-skins-wide-period">
        <h3>{periodName(period)}</h3>
        <span className="cpp-skins-muted">
          {when} ·{' '}
          {gt
            .pgettext('skins', '%1 件，缺 %2') /* I10N: %1: total, %2: missing */
            .replace('%1', String(period.skinIds.length))
            .replace('%2', String(miss))}
        </span>
        <span className="cpp-skins-spacer" />
        <span className="cpp-skins-days-left">{periodTimeText(period, model.now)}</span>
        <Button
          variant="minimal"
          size="small"
          icon="cross"
          text={gt.pgettext('skins', '回到全部')}
          onClick={() => setSelected(null)}
        />
      </div>
      {states.length === 0 ? <NonIdealState icon="search" title={gt.pgettext('skins', '没有符合的时装')} /> : null}
      <div className="cpp-skins-cards">
        {states.map((s) => (
          <SkinCard key={s.skin.id} state={s} marking={marking} now={model.now} />
        ))}
      </div>
    </>
  )
})

/**
 * 左边的品牌格子：高度按件数，浅蓝底是已有的比例，橙色斜纹是缺但现在能拿的比例。
 * 和右边按品牌排的墙一样，筛掉一件不剩的品牌不列，列出的仍按整个品牌计数
 */
const BrandSteps = memo(
  ({ model, period, onPick }: { model: SkinModel; period: SkinPeriod | null; onPick: (brandId: string) => void }) => {
    const filter = useSkinFilter()
    const inPeriod = period ? new Set(period.skinIds) : null
    return (
      <div className="cpp-skins-steps">
        <div className="cpp-skins-steps-head cpp-skins-muted">
          <span>{gt.pgettext('skins', '品牌')}</span>
          <span>{gt.pgettext('skins', '已有 / 全部')}</span>
        </div>
        {model.catalog.brands.map((brand) => {
          const shown = brand.skins.filter((skin) => filter(model.states.get(skin.id)!))
          if (shown.length === 0) return null
          let owned = 0
          let obtainable = 0
          for (const skin of brand.skins) {
            const s = model.states.get(skin.id)!
            if (s.owned) owned++
            if (s.obtainable) obtainable++
          }
          const total = brand.skins.length
          const name = brand.name || gt.pgettext('skins', '其他')
          // 右边那一期的清单也筛过：筛剩的这几件都不在这一期时变暗
          const dim = inPeriod != null && !shown.some((s) => inPeriod.has(s.id))
          return (
            <button
              key={brand.id}
              type="button"
              className={'cpp-skins-step' + (dim ? ' is-dimmed' : '')}
              style={{ height: Math.round(18 + total * 0.42) }}
              title={name}
              onClick={() => onPick(brand.id)}
            >
              <i style={{ width: `${(owned / total) * 100}%` }} />
              <em style={{ left: `${(owned / total) * 100}%`, width: `${(obtainable / total) * 100}%` }} />
              <span className="cpp-skins-step-name">{name}</span>
              <span className="cpp-skins-step-count">
                {owned}/{total}
              </span>
            </button>
          )
        })}
      </div>
    )
  },
)

/** 甘特图可以收起，和面板的档期各记各的；收起时选中的一期照旧 */
const WideTimeline = memo(({ model }: { model: SkinModel }) => {
  const [prefs, setPrefs] = useAtom(skinPrefsAtom)
  const open = !prefs.wideTimelineCollapsed
  const onToggle = () => setPrefs({ ...prefs, wideTimelineCollapsed: open })
  return (
    <div className={'cpp-skins-wide-chart' + (open ? '' : ' is-collapsed')}>
      {open ? (
        <WideGantt model={model} corner={<TimelineToggle open onToggle={onToggle} />} />
      ) : (
        <TimelineHead open={false} onToggle={onToggle} now={model.now} />
      )}
    </div>
  )
})

export const SkinsWide = memo(() => {
  const model = useSkinModel()
  const period = useSelectedPeriod(model)
  const [marking, setMarking] = useMarkingLifetime()
  const [sort, setSort] = useAtom(wideSortAtom)
  const setSelected = useSetAtom(selectedPeriodAtom)
  const openSkland = useOpenSkland()
  const contentRef = useRef<HTMLDivElement>(null)
  const pendingBrand = useRef<string | null>(null)

  const scrollToBrand = (id: string) =>
    contentRef.current?.querySelector(`[data-brand="${CSS.escape(id)}"]`)?.scrollIntoView({ block: 'start' })

  // 先回到按品牌排、不选档期的半身像墙，画出来以后再滚过去
  useEffect(() => {
    if (!pendingBrand.current) return
    scrollToBrand(pendingBrand.current)
    pendingBrand.current = null
  })

  const pickBrand = (id: string) => {
    if (!period && sort === 'brand') return scrollToBrand(id)
    pendingBrand.current = id
    setSelected(null)
    setSort('brand')
  }

  return (
    <div className="cpp-skins-wide">
      <div className="cpp-skins-wide-bar">
        <SkinOwnSwitch />
        <SkinToggles model={model} />
        <SkinSearch className="cpp-skins-wide-search" />
        <HTMLSelect
          minimal
          value={sort}
          aria-label={gt.pgettext('skins', '排序')}
          onChange={(e) => setSort(e.currentTarget.value as WideSort)}
          options={[
            { value: 'brand', label: gt.pgettext('skins', '按品牌') },
            { value: 'release', label: gt.pgettext('skins', '按上线时间') },
            { value: 'acquired', label: gt.pgettext('skins', '按获得时间') },
          ]}
        />
        <span className="cpp-skins-wide-actions">
          {model.prts.status === 'error' ? (
            <span className="cpp-skins-wide-error">
              <Icon icon="warning-sign" size={12} />
              {gt.pgettext('skins', 'PRTS 数据载入失败')}
              <Button variant="minimal" size="small" text={gt.pgettext('skins', '重试')} onClick={model.prts.retry} />
            </span>
          ) : null}
          {model.canImportSkland ? (
            <Button
              variant="minimal"
              size="small"
              icon="import"
              text={gt.pgettext('skins', '从森空岛导入')}
              onClick={openSkland}
            />
          ) : null}
          {marking ? (
            <>
              <span className="cpp-skins-muted">{gt.pgettext('skins', '点半身像切换已有 / 缺')}</span>
              <Button
                size="small"
                intent="primary"
                text={gt.pgettext('skins', '完成')}
                onClick={() => setMarking(false)}
              />
            </>
          ) : (
            <Button
              variant="minimal"
              size="small"
              icon="edit"
              text={gt.pgettext('skins', '手动标记')}
              onClick={() => setMarking(true)}
            />
          )}
        </span>
      </div>
      <WideTimeline model={model} />
      <div className="cpp-skins-wide-main">
        <BrandSteps model={model} period={period} onPick={pickBrand} />
        <div className="cpp-skins-wide-content" ref={contentRef} key={period?.key ?? sort}>
          {period ? (
            <PeriodCards model={model} period={period} marking={marking} />
          ) : (
            <CardWall model={model} marking={marking} />
          )}
        </div>
      </div>
    </div>
  )
})
