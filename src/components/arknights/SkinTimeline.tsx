import { Tag } from '@blueprintjs/core'
import { useAtom } from 'jotai'
import { memo, useMemo, useRef } from 'react'
import useResizeObserver from 'use-resize-observer'
import { DAY, PeriodLane, SkinPeriod, packLanes } from '../../pkg/cpp-arknights/skins'
import { gt } from '../../pkg/gt'
import { missingCount, periodSummary } from './SkinControls'
import { channelName, formatDay, formatMinute, formatMonthDay, onButtonKey, periodName } from './SkinImages'
import { SkinModel, selectedPeriodAtom } from './skinsModel'

/** 读屏读的：「风尚回顾，10-24 至 11-21，缺 11 件」 */
function periodLabel(model: SkinModel, period: SkinPeriod) {
  const miss = missingCount(model, period)
  const missing = gt.ngettext('缺 %d 件', '缺 %d 件', miss).replaceAll('%d', String(miss))
  const when =
    period.end == null
      ? gt.pgettext('skins', '常驻')
      : gt
          .pgettext('skins', '%1 至 %2') /* I10N: %1: start date, %2: end date */
          .replace('%1', formatMonthDay(period.start))
          .replace('%2', formatMonthDay(period.end))
  return [periodName(period), when, missing].join(gt.pgettext('skins', '，'))
}

/** 一期在档期图上的文字：「风尚回顾 缺11」 */
function barText(model: SkinModel, period: SkinPeriod) {
  return gt
    .pgettext('skins', '%1 缺%2') /* I10N: %1: period name, %2: missing count */
    .replace('%1', periodName(period))
    .replace('%2', String(missingCount(model, period)))
}

// SVG text cannot be measured before it is drawn; CJK glyphs are about one em, the rest a little over half
function textWidth(text: string, size: number) {
  let w = 0
  for (const ch of text) w += ch.codePointAt(0)! > 0x2e80 ? size : size * 0.6
  return w
}

/** 放不下时截短，结尾加省略号；按钮的 title 有全文 */
function fitText(text: string, size: number, max: number) {
  if (textWidth(text, size) <= max) return text
  let out = ''
  for (const ch of text) {
    if (textWidth(out + ch + '…', size) > max) break
    out += ch
  }
  return out + '…'
}

const PANEL_WIDTH = 284
const PANEL_ROW = 20
const PANEL_TOP = 14
const PANEL_FONT = 11

/** 条够宽就写在条里，否则写在左边或右边放得下的一边；哪边都放不下时选最宽的一边截短 */
function panelLabel(x: number, w: number, text: string) {
  const need = textWidth(text, PANEL_FONT)
  const rooms = { inside: w - 10, left: x - 4, right: PANEL_WIDTH - (x + w) - 4 }
  const fits = (['inside', 'left', 'right'] as const).find((k) => need <= rooms[k])
  const place = fits ?? (['inside', 'left', 'right'] as const).reduce((a, b) => (rooms[b] > rooms[a] ? b : a))
  const shown = fitText(text, PANEL_FONT, rooms[place])
  const tw = textWidth(shown, PANEL_FONT)
  return {
    shown,
    inside: place === 'inside',
    textX: place === 'inside' ? x + 5 : place === 'left' ? x - 4 : x + w + 4,
    anchor: place === 'left' ? ('end' as const) : ('start' as const),
    // 按钮连文字一起盖住
    hitLeft: place === 'left' ? x - 4 - tw : x,
    hitRight: place === 'right' ? x + w + 4 + tw : x + w,
  }
}

function usePeriodToggle() {
  const [selected, setSelected] = useAtom(selectedPeriodAtom)
  return { selected, toggle: (key: string) => setSelected(selected === key ? null : key) }
}

/**
 * 面板的档期图：今天往前 26 天到往后 21 天，只画还没结束的；下面一排常驻渠道。每一条都是按钮，点一下选中这一期，再点取消。
 */
export const PanelTimeline = memo(({ model }: { model: SkinModel }) => {
  const { selected, toggle } = usePeriodToggle()
  const { now } = model
  const x0 = now - 26 * DAY
  const x1 = now + 21 * DAY
  const X = (t: number) => ((Math.min(Math.max(t, x0), x1) - x0) / (x1 - x0)) * PANEL_WIDTH

  const bars = model.periods.filter((p) => p.lane != null && p.end != null && p.end >= now && p.start < x1)
  const permanent = model.periods
    .filter((p) => p.lane == null)
    .sort((a, b) => missingCount(model, b) - missingCount(model, a) || b.skinIds.length - a.skinIds.length)

  const ticks: number[] = []
  for (let d = new Date(x0); d.getTime() <= x1; d.setDate(d.getDate() + 1)) {
    if (d.getDate() === 1 || d.getDate() === 15) ticks.push(new Date(d).setHours(0, 0, 0, 0))
  }
  const height = PANEL_TOP + Math.max(bars.length, 1) * PANEL_ROW

  return (
    <>
      {bars.length === 0 ? (
        <div className="cpp-skins-muted cpp-skins-time-empty">{gt.pgettext('skins', '现在没有在卖的时装')}</div>
      ) : (
        <div className="cpp-skins-time-chart" style={{ height }}>
          <svg width={PANEL_WIDTH} height={height} aria-hidden="true">
            {ticks.map((t) => (
              <g key={t} className="cpp-skins-tick">
                <line x1={X(t)} x2={X(t)} y1={PANEL_TOP - 2} y2={height} />
                <text x={X(t)} y={PANEL_TOP - 4} textAnchor="middle">
                  {formatMonthDay(t)}
                </text>
              </g>
            ))}
            {bars.map((p, i) => {
              const x = X(p.start)
              const w = Math.max(4, X(p.end!) - x)
              const y = PANEL_TOP + i * PANEL_ROW + 2
              const label = panelLabel(x, w, barText(model, p))
              return (
                <g
                  key={p.key}
                  className={
                    `cpp-skins-bar cpp-skins-lane-${p.lane}` +
                    (p.start > now ? ' is-upcoming' : '') +
                    (selected === p.key ? ' is-selected' : selected ? ' is-dimmed' : '')
                  }
                >
                  <rect x={x} y={y} width={w} height={16} rx={2} />
                  <text
                    x={label.textX}
                    y={y + 12}
                    className={label.inside ? 'is-inside' : undefined}
                    textAnchor={label.anchor}
                  >
                    {label.shown}
                  </text>
                </g>
              )
            })}
            <line className="cpp-skins-today" x1={X(now)} x2={X(now)} y1={PANEL_TOP - 2} y2={height} />
          </svg>
          {bars.map((p, i) => {
            const x = X(p.start)
            const w = Math.max(4, X(p.end!) - x)
            const { hitLeft: left, hitRight: right } = panelLabel(x, w, barText(model, p))
            return (
              <button
                key={p.key}
                type="button"
                className="cpp-skins-bar-button"
                style={{ left, top: PANEL_TOP + i * PANEL_ROW, width: right - left, height: PANEL_ROW }}
                aria-pressed={selected === p.key}
                aria-label={periodLabel(model, p)}
                title={`${periodName(p)} ${formatMinute(p.start)} – ${formatMinute(p.end!)}`}
                onClick={() => toggle(p.key)}
              />
            )
          })}
        </div>
      )}
      {permanent.length > 0 ? (
        <div className="cpp-skins-channels">
          {permanent.map((p) => (
            <Tag
              key={p.key}
              interactive
              minimal={selected !== p.key}
              intent={selected === p.key ? 'primary' : undefined}
              role="button"
              tabIndex={0}
              aria-pressed={selected === p.key}
              aria-label={periodLabel(model, p)}
              onClick={() => toggle(p.key)}
              onKeyDown={onButtonKey}
            >
              {barText(model, p)}
            </Tag>
          ))}
        </div>
      ) : null}
    </>
  )
})

const laneOrder: PeriodLane[] = ['first', 'rerun', 'retro', 'event']
const laneNames: Record<PeriodLane, () => string> = {
  first: () => gt.pgettext('skins', '新装'),
  rerun: () => gt.pgettext('skins', '复刻'),
  retro: () => channelName('retro'),
  event: () => channelName('event'),
}

const monthNames = [
  () => gt.pgettext('month', '1 月'),
  () => gt.pgettext('month', '2 月'),
  () => gt.pgettext('month', '3 月'),
  () => gt.pgettext('month', '4 月'),
  () => gt.pgettext('month', '5 月'),
  () => gt.pgettext('month', '6 月'),
  () => gt.pgettext('month', '7 月'),
  () => gt.pgettext('month', '8 月'),
  () => gt.pgettext('month', '9 月'),
  () => gt.pgettext('month', '10 月'),
  () => gt.pgettext('month', '11 月'),
  () => gt.pgettext('month', '12 月'),
]

const LABEL = 80
const ROW = 15
const BAR = 12
const TOP = 18

/**
 * 大窗口的甘特图：五个半月前到三周后，四条泳道，同一泳道里重叠的往下错开一行；最下面一行「你的获得」，每件已有时装在获得那天画一个点。
 */
export const WideGantt = memo(({ model }: { model: SkinModel }) => {
  const { selected, toggle } = usePeriodToggle()
  const ref = useRef<HTMLDivElement>(null)
  const { width = 1000 } = useResizeObserver({ ref })
  const { now } = model
  const x0 = useMemo(() => {
    const d = new Date(now - 167 * DAY)
    return d.setHours(0, 0, 0, 0)
  }, [now])
  const x1 = now + 21 * DAY
  const X = (t: number) => LABEL + ((Math.min(Math.max(t, x0), x1) - x0) / (x1 - x0)) * (width - LABEL - 4)

  const lanes = useMemo(
    () =>
      laneOrder.map((lane) => {
        const periods = model.periods.filter((p) => p.lane === lane && p.end! > x0 && p.start < x1)
        return { lane, ...packLanes(periods as (SkinPeriod & { end: number })[], 2 * DAY) }
      }),
    [model.periods, x0, x1],
  )

  // 同一天获得的几件叠成一列点
  const acquired = useMemo(() => {
    const days = new Map<number, string[]>()
    for (const s of model.states.values()) {
      if (!s.acquiredAt) continue
      const t = s.acquiredAt * 1000
      if (t < x0 || t > x1) continue
      const day = new Date(t).setHours(12, 0, 0, 0)
      days.set(day, [...(days.get(day) ?? []), s.skin.name])
    }
    return [...days]
  }, [model.states, x0, x1])

  const ticks: number[] = []
  for (let d = new Date(x0); d.getTime() <= x1; d.setMonth(d.getMonth() + 1, 1)) {
    const t = new Date(d).setDate(1)
    if (t >= x0) ticks.push(t)
  }

  const blocks: ((typeof lanes)[0] & { top: number; h: number; odd: boolean })[] = []
  let y = TOP
  for (const [i, l] of lanes.entries()) {
    const h = Math.max(1, l.rows) * ROW + 4
    blocks.push({ ...l, top: y, h, odd: i % 2 === 1 })
    y += h
  }
  const mineTop = y
  const height = mineTop + 26

  return (
    <div className="cpp-skins-gantt" ref={ref} style={{ height: height + 2 }}>
      <svg width={width} height={height + 2} aria-hidden="true">
        {blocks.map((b) => (
          <g key={b.lane}>
            <rect
              className={'cpp-skins-gantt-band' + (b.odd ? ' is-odd' : '')}
              x={0}
              y={b.top}
              width={width}
              height={b.h}
            />
            <text className="cpp-skins-gantt-lane" x={6} y={b.top + 12}>
              {laneNames[b.lane]()}
            </text>
          </g>
        ))}
        <rect className="cpp-skins-gantt-band" x={0} y={mineTop} width={width} height={24} />
        <text className="cpp-skins-gantt-lane" x={6} y={mineTop + 15}>
          {gt.pgettext('skins', '你的获得')}
        </text>
        {ticks.map((t) => (
          <g key={t} className="cpp-skins-tick">
            <line x1={X(t)} x2={X(t)} y1={TOP - 4} y2={height} />
            <text x={X(t) + 4} y={TOP - 7}>
              {monthNames[new Date(t).getMonth()]()}
            </text>
          </g>
        ))}
        {blocks.flatMap((b) =>
          b.placed.map(({ period: p, row }) => {
            const x = X(p.start)
            const w = Math.max(4, X(p.end) - x)
            const live = p.start <= now && now <= p.end
            const summary = periodSummary(model, p)
            return (
              <g
                key={p.key}
                className={
                  `cpp-skins-bar cpp-skins-lane-${b.lane}` +
                  (selected === p.key ? ' is-selected' : live ? ' is-live' : ' is-faded')
                }
              >
                <rect x={x} y={b.top + 2 + row * ROW} width={w} height={BAR} rx={2} />
                {w - 8 >= textWidth(summary, 10) ? (
                  <text className="is-inside is-small" x={x + 4} y={b.top + 2 + row * ROW + 9.5}>
                    {summary}
                  </text>
                ) : null}
              </g>
            )
          }),
        )}
        {acquired.map(([day, names]) => (
          <g key={day} className="cpp-skins-acquired">
            <title>{`${formatDay(day)}\n${names.join('\n')}`}</title>
            {names.map((name, i) => (
              <circle key={i} cx={X(day)} cy={mineTop + 16 - i * 5} r={2.4} />
            ))}
          </g>
        ))}
        <line className="cpp-skins-today" x1={X(now)} x2={X(now)} y1={2} y2={height} />
        <text className="cpp-skins-today-label" x={X(now) - 4} y={TOP - 7} textAnchor="end">
          {gt.pgettext('skins', '今天')}
        </text>
      </svg>
      {blocks.flatMap((b) =>
        b.placed.map(({ period: p, row }) => {
          const x = X(p.start)
          const w = Math.max(4, X(p.end) - x)
          return (
            <button
              key={p.key}
              type="button"
              className="cpp-skins-bar-button"
              style={{ left: x, top: b.top + 1 + row * ROW, width: w, height: ROW - 1 }}
              aria-pressed={selected === p.key}
              aria-label={periodLabel(model, p)}
              title={`${periodName(p)} ${formatMinute(p.start)} – ${formatMinute(p.end)}`}
              onClick={() => toggle(p.key)}
            />
          )
        }),
      )}
    </div>
  )
})
